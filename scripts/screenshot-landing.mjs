// Screenshot full-page da landing via CDP (Edge headless), sem dependências.
// Uso: node scripts/screenshot-landing.mjs <url> <saida.png> [mobile|desktop]
import { spawn } from "node:child_process";
import { mkdtempSync, openSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const url = process.argv[2];
const output = process.argv[3];
const viewport = process.argv[4] === "mobile" ? "mobile" : "desktop";
if (!url || !output) {
  console.error("usage: node scripts/screenshot-landing.mjs <url> <out.png> [mobile|desktop]");
  process.exit(2);
}

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9600 + Math.floor(Math.random() * 200);
const profileDir = mkdtempSync(join(tmpdir(), "vw-shot-"));
const width = viewport === "mobile" ? 390 : 1440;
const height = viewport === "mobile" ? 844 : 1000;
const dpr = viewport === "mobile" ? 2 : 1;

const errLogPath = join(profileDir, "edge-stderr.log");
const errFd = openSync(errLogPath, "w");
const browser = spawn(EDGE, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profileDir}`,
  "--no-first-run",
  "--disable-gpu",
  "--no-default-browser-check",
  "--disable-features=msEdgeFirstRunExperience,msEdgeUpdate",
  "about:blank",
], { stdio: ["ignore", "ignore", errFd] });

let stderrLog = "";
try {
  stderrLog = readFileSync(errLogPath, "utf8");
} catch {}

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
  if (stderrLog) console.error("stderr:", stderrLog.slice(0, 2000));
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
await send("Emulation.setDeviceMetricsOverride", {
  width,
  height,
  deviceScaleFactor: dpr,
  mobile: viewport === "mobile",
});

await send("Page.navigate", { url });
await sleep(8000);
// garante que imagens lazy da parte de baixo carreguem antes do screenshot
await send("Runtime.evaluate", {
  expression: `(async () => { const step = window.innerHeight / 2; let y = 0; while (y < document.body.scrollHeight) { window.scrollTo(0, y); y += step; await new Promise((r) => setTimeout(r, 40)); } window.scrollTo(0, 0); })()`,
  awaitPromise: true,
});
await sleep(4000);

const shot = await send("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: true,
  fromSurface: true,
});
writeFileSync(output, Buffer.from(shot.data, "base64"));
console.log(`screenshot salvo: ${output} (${width}x${height}, dpr=${dpr})`);

ws.close();
browser.kill();
await sleep(1200);
try {
  rmSync(profileDir, { recursive: true, force: true });
} catch {}
