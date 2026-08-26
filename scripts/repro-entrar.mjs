// Reproduz o caso do usuário (telefone 11999999999, placa ZZZ9Z99) e captura rede/timing.
// Uso: node scripts/repro-entrar.mjs <baseUrl>
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const baseUrl = (process.argv[2] || "https://verifica-saas.vercel.app").replace(/\/+$/, "");
const entry = `${baseUrl}/verifica/cliente/entrar?tenant=mel`;

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 10300 + Math.floor(Math.random() * 30);
const profileDir = mkdtempSync(join(tmpdir(), "vw-repro-"));
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
const log = [];
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message));
    else resolve(msg.result);
  } else if (msg.method === "Network.responseReceived") {
    const { response } = msg.params;
    if (response.url.includes("cliente/entrar")) {
      log.push({ status: response.status, url: response.url.slice(0, 150), redirect: response.headers?.location || null, tipo: response.mimeType });
    }
  } else if (msg.method === "Network.loadingFailed") {
    log.push({ erro: msg.params.errorText, url: msg.params.requestId });
  } else if (msg.method === "Runtime.exceptionThrown") {
    log.push({ excecao: msg.params.exceptionDetails?.text });
  } else if (msg.method === "Log.entryAdded") {
    log.push({ console: msg.params.entry?.text });
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
await send("Network.enable");
await send("Log.enable");
await send("Page.navigate", { url: entry });
await sleep(4000);

// aguarda hidratação
for (let i = 0; i < 40; i++) {
  const action = await evaluate(`(document.querySelector("form") ? document.querySelector("form").action : "")`);
  if (action && action.length > 0) break;
  await sleep(300);
}

const t0 = Date.now();
await evaluate(`(() => {
  const phone = document.querySelector('input[name="phone"]');
  const plate = document.querySelector('input[name="plate"]');
  if (phone) phone.value = "${process.argv[3] || "11999999999"}";
  if (plate) plate.value = "ZZZ9Z99";
  document.querySelector("form").requestSubmit();
})()`);

// captura o label do botão durante a requisição (prova do "Consultando...")
await sleep(400);
const botaoDurante = await evaluate(`(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => b.type === "submit");
  return btn ? { texto: btn.textContent.trim(), disabled: btn.disabled } : null;
})()`);

let state = null;
for (let i = 0; i < 60; i++) {
  state = await evaluate(`({
    url: location.href,
    erroVisivel: document.body.innerText.includes("Não encontramos") || document.body.innerText.includes("Tente novamente") || document.body.innerText.includes("inválido"),
    texto: document.body.innerText.slice(0, 200),
    temInputPhone: !!document.querySelector('input[name="phone"]'),
    temCampoSenha: !!document.querySelector('input[name="password"]'),
  })`);
  if (state.url.includes("step=3") || state.erroVisivel) break;
  await sleep(400);
}
const elapsed = Date.now() - t0;

console.log(JSON.stringify({
  tempoMs: elapsed,
  botaoDurante,
  estadoFinal: state,
  rede: log.slice(-10),
}, null, 2));

ws.close();
browser.kill();
await sleep(1200);
try {
  rmSync(profileDir, { recursive: true, force: true });
} catch {}
