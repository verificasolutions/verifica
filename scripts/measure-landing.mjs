// Medição de performance da landing via CDP (Edge/Chrome headless), sem dependências.
// Uso: node scripts/measure-landing.mjs <url> [mobile|desktop]
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const url = process.argv[2];
const viewport = process.argv[3] === "mobile" ? "mobile" : "desktop";
if (!url) {
  console.error("usage: node scripts/measure-landing.mjs <url> [mobile|desktop]");
  process.exit(2);
}

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9333 + Math.floor(Math.random() * 200);
const profileDir = mkdtempSync(join(tmpdir(), "vw-measure-"));
const width = viewport === "mobile" ? 390 : 1440;
const height = viewport === "mobile" ? 844 : 1000;
const dpr = viewport === "mobile" ? 3 : 1;

const browser = spawn(EDGE, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profileDir}`,
  "--no-first-run",
  "--disable-gpu",
  "--no-default-browser-check",
  "--disable-extensions",
  "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(endpoint) {
  const res = await fetch(`http://127.0.0.1:${PORT}${endpoint}`);
  return res.json();
}

let wsUrl = null;
for (let i = 0; i < 60; i++) {
  try {
    const list = await getJson("/json/list");
    const page = list.find((t) => t.type === "page");
    if (page) {
      wsUrl = page.webSocketDebuggerUrl;
      break;
    }
  } catch {
    /* ainda subindo */
  }
  await sleep(250);
}

if (!wsUrl) {
  console.error("FALHA: Edge CDP não respondeu");
  browser.kill();
  process.exit(1);
}

const ws = new WebSocket(wsUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let nextId = 1;
const pending = new Map();
const events = [];

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message));
    else resolve(msg.result);
  } else if (msg.method) {
    events.push(msg);
  }
};

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

const waitForEvent = (method, timeoutMs = 30000) =>
  new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      const found = events.find((e) => e.method === method);
      if (found) {
        clearInterval(timer);
        resolve(found);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        reject(new Error(`timeout waiting ${method}`));
      }
    }, 50);
  });

const evaluate = async (expression) => {
  const res = await send("Runtime.evaluate", { expression, returnByValue: true });
  return res.result.value;
};

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");
await send("Performance.enable");
try {
  await send("Performance.setResourceTimingBufferSize", { maxSize: 2000 });
} catch {}
await send("Emulation.setDeviceMetricsOverride", {
  width,
  height,
  deviceScaleFactor: dpr,
  mobile: viewport === "mobile",
});

await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `
    window.__vwMetrics = { lcp: null, lcpUrl: null };
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) {
          window.__vwMetrics.lcp = last.startTime;
          window.__vwMetrics.lcpUrl = last.url || null;
        }
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch (e) {}
  `,
});

const navPromise = waitForEvent("Page.loadEventFired");
await send("Page.navigate", { url });
await navPromise.catch(() => {});

// Fase 1: métricas acima da dobra (antes de rolar)
await sleep(3000);
const aboveFold = await evaluate(`(() => {
  const nav = performance.getEntriesByType("navigation")[0] || {};
  const paints = Object.fromEntries(performance.getEntriesByType("paint").map((e) => [e.name, Math.round(e.startTime)]));
  const resources = performance.getEntriesByType("resource");
  const imgs = resources.filter((r) => r.initiatorType === "img" || (r.initiatorType === "css" && r.name.includes("supabase.co")));
  return {
    ttfb: Math.round(nav.responseStart || 0),
    domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
    loadEventEnd: Math.round(nav.loadEventEnd || 0),
    paints,
    lcp: Math.round(window.__vwMetrics?.lcp ?? -1),
    lcpUrl: window.__vwMetrics?.lcpUrl || null,
    imgStarted: imgs.length,
    imgBytes: imgs.reduce((s, r) => s + (r.transferSize || 0), 0),
    imgPending: [...document.images].filter((i) => !i.complete).length,
  };
})()`);

// Fase 2: rola até o fim para disparar imagens lazy e aguarda conclusão
await evaluate(`(async () => {
  const step = window.innerHeight / 2;
  let y = 0;
  while (y < document.body.scrollHeight) {
    window.scrollTo(0, y);
    y += step;
    await new Promise((r) => setTimeout(r, 60));
  }
  window.scrollTo(0, document.body.scrollHeight);
})()`);
for (let i = 0; i < 30; i++) {
  const state = await evaluate(`({ pending: [...document.images].filter((i) => !i.complete).length })`);
  if (state.pending === 0) break;
  await sleep(500);
}

const full = await evaluate(`(() => {
  const resources = performance.getEntriesByType("resource");
  const imgs = resources.filter((r) => r.initiatorType === "img" || (r.initiatorType === "css" && r.name.includes("supabase.co")));
  const countByName = {};
  for (const img of imgs) {
    const key = img.name.split("?")[0];
    countByName[key] = (countByName[key] || 0) + 1;
  }
  const dupes = Object.entries(countByName).filter(([, c]) => c > 1);
  const totalTransfer = imgs.reduce((s, i) => s + (i.transferSize || 0), 0);
  const totalDecoded = imgs.reduce((s, i) => s + (i.decodedBodySize || 0), 0);
  const slowest = imgs.slice().sort((a, b) => (b.duration || 0) - (a.duration || 0))[0] || null;
  return {
    imgTotal: imgs.length,
    imgTotalTransfer: totalTransfer,
    imgTotalDecoded: totalDecoded,
    imgDuplicates: dupes.map(([k, c]) => ({ file: k.split("/").pop(), count: c })),
    imgSlowest: slowest ? { file: slowest.name.split("/").pop().split("?")[0], ms: Math.round(slowest.duration || 0), bytes: slowest.transferSize || 0 } : null,
    imgPending: [...document.images].filter((i) => !i.complete).length,
  };
})()`);

console.log(JSON.stringify({ viewport, url, ...aboveFold, ...full }, null, 2));

ws.close();
browser.kill();
await sleep(1500);
try {
  rmSync(profileDir, { recursive: true, force: true });
} catch {}
