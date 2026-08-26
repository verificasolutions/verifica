// Validação real de carregamento de imagens da landing (naturalWidth > 0) via CDP.
// Uso: node scripts/audit-images.mjs <url>
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const url = process.argv[2];
if (!url) {
  console.error("usage: node scripts/audit-images.mjs <url>");
  process.exit(2);
}

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 10050 + Math.floor(Math.random() * 30);
const profileDir = mkdtempSync(join(tmpdir(), "vw-img-"));
const browser = spawn(EDGE, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profileDir}`,
  "--no-first-run",
  "--disable-gpu",
  "--no-default-browser-check",
  "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 60; i++) {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const list = await res.json();
    const page = list.find((t) => t.type === "page");
    if (page) {
      wsUrl = page.webSocketDebuggerUrl;
      break;
    }
  } catch {}
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
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message));
    else resolve(msg.result);
  }
};
function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
const evaluate = async (expression) => {
  const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return res.result.value;
};

await send("Page.enable");
await send("Runtime.enable");
await send("Page.navigate", { url });
await sleep(4000);

// rola a página para disparar o lazy load das imagens abaixo da dobra
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

// aguarda imagens terminarem (máx. 25s)
for (let i = 0; i < 50; i++) {
  const pending = await evaluate(`[...document.images].filter((i) => !i.complete).length`);
  if (pending === 0) break;
  await sleep(500);
}

const snapshot = await evaluate(`(() => {
  const imgs = [...document.images].map((el) => ({
    alt: el.alt || "",
    file: (el.currentSrc || el.src || "").split("/").pop().split("?")[0].slice(0, 60),
    viaOptimizer: (el.currentSrc || el.src || "").includes("_next/image"),
    complete: el.complete,
    naturalWidth: el.naturalWidth,
    naturalHeight: el.naturalHeight,
    loading: el.loading,
    fetchPriority: el.fetchPriority,
  }));
  return imgs;
})()`);

// clique no carrossel do 1º post (BMW) para provar 0001 -> 0002 -> 0003
const carouselProbe = await evaluate(`(async () => {
  const article = document.querySelector('article[id^="post-"]');
  if (!article) return { error: "sem article de post" };
  article.scrollIntoView({ block: "center" });
  await new Promise((r) => setTimeout(r, 1500));
  const results = [];
  const pushCurrent = async (step) => {
    const cur = article.querySelector("img");
    results.push({
      step,
      file: (cur.currentSrc || cur.src || "").split("/").pop().split("?")[0],
      complete: cur.complete,
      naturalWidth: cur.naturalWidth,
    });
  };
  await pushCurrent("inicial");
  for (const step of ["apos-1", "apos-2"]) {
    // re-consulta o botão a cada clique (React pode substituir o nó)
    const btn = article.querySelector('button[aria-label="Próxima imagem"]');
    if (!btn) break;
    btn.click();
    let changed = false;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 300));
      const cur = article.querySelector("img");
      const file = (cur.currentSrc || cur.src || "").split("/").pop().split("?")[0];
      if (file !== "bmw-0001.jpg") {
        changed = true;
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 800));
    await pushCurrent(step);
    if (!changed) break;
  }
  return { results, error: null, noCarousel: false };
})()`);

// prova direta: as 3 URLs do BMW carregam com naturalWidth > 0
const directProbe = await evaluate(`(async () => {
  const urls = [...new Set(
    [...document.images].map((el) => el.currentSrc || el.src).filter((s) => s.includes("bmw-"))
  )];
  const loaded = [];
  for (const u of urls) {
    const probe = new Image();
    probe.src = u;
    await new Promise((resolve) => {
      probe.onload = () => resolve(true);
      probe.onerror = () => resolve(false);
      setTimeout(() => resolve(false), 8000);
    });
    loaded.push({ file: u.split("/").pop().split("?")[0], ok: probe.naturalWidth > 0, naturalWidth: probe.naturalWidth });
  }
  return loaded;
})()`);

console.log(JSON.stringify({ url, imagens: snapshot, carrossel: carouselProbe, bmwDirect: directProbe }, null, 2));

ws.close();
browser.kill();
await sleep(1200);
try {
  rmSync(profileDir, { recursive: true, force: true });
} catch {}
