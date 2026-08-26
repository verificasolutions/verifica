// Auditoria de computed styles da landing via CDP (Edge headless), sem dependências.
// Uso: node scripts/audit-gradient.mjs <url>
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const url = process.argv[2];
if (!url) {
  console.error("usage: node scripts/audit-gradient.mjs <url>");
  process.exit(2);
}

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9800 + Math.floor(Math.random() * 150);
const profileDir = mkdtempSync(join(tmpdir(), "vw-audit-"));
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
    const els = [...document.querySelectorAll("main section, main article, main div")]
      .filter((el) => {
        const cls = el.className || "";
        if (typeof cls !== "string") return false;
        if (el.tagName.toLowerCase() === "div" && !/rounded-\\[(20|24|26|28|30)px\\]/.test(cls)) return false;
        return true;
      });
    const rows = els.map((el) => {
      const cs = getComputedStyle(el);
      const bgImage = cs.backgroundImage;
      const hasImgChild = !!el.querySelector("img");
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        cls: (typeof el.className === "string" ? el.className : "").slice(0, 90),
        hasGradient: bgImage.includes("linear-gradient"),
        bgColor: cs.backgroundColor,
        hasImgChild,
      };
    });
    const semGradiente = rows.filter((r) => !r.hasGradient);
    const solid11161d = rows.filter((r) => r.bgColor === "rgb(17, 22, 29)");
    return { total: rows.length, semGradiente, solid11161d };
  })()`,
  returnByValue: true,
});

const result = res.result.value;
console.log(JSON.stringify(
  {
    url,
    totalBlocos: result.total,
    semGradiente: result.semGradiente,
    solid11161d: result.solid11161d,
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
