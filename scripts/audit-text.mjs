// Auditoria de cor de TEXTO (obrigatório #000) via CDP. Uso: node scripts/audit-text.mjs <url>
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const url = process.argv[2];
if (!url) {
  console.error("usage: node scripts/audit-text.mjs <url>");
  process.exit(2);
}

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9900 + Math.floor(Math.random() * 80);
const profileDir = mkdtempSync(join(tmpdir(), "vw-text-"));
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

await send("Page.enable");
await send("Runtime.enable");
await send("Page.navigate", { url });
await sleep(7000);

const res = await send("Runtime.evaluate", {
  expression: `(() => {
    const els = [...document.querySelectorAll("main h1, main h2, main h3, main h4, main p, main span, main a, main button, main time, main strong, main li")];
    const counts = {};
    const naoPreto = [];
    for (const el of els) {
      const c = getComputedStyle(el).color;
      counts[c] = (counts[c] || 0) + 1;
      if (c !== "rgb(0, 0, 0)") {
        naoPreto.push({ tag: el.tagName.toLowerCase(), cls: (typeof el.className === "string" ? el.className : "").slice(0, 80), color: c, text: (el.textContent || "").slice(0, 40) });
      }
    }
    const mainBg = getComputedStyle(document.querySelector("main")).backgroundImage;
    const mainBgColor = getComputedStyle(document.querySelector("main")).backgroundColor;
    return { totalElementos: els.length, counts, naoPreto, mainBg, mainBgColor };
  })()`,
  returnByValue: true,
});

const result = res.result.value;
console.log(JSON.stringify(
  {
    url,
    totalElementos: result.totalElementos,
    distribuicaoCores: result.counts,
    naoPreto: result.naoPreto,
    fundoPagina: { mainBg: result.mainBg, mainBgColor: result.mainBgColor },
  },
  null,
  2
));

ws.close();
browser.kill();
await sleep(1200);
try {
  rmSync(profileDir, { recursive: true, force: true });
} catch {}
