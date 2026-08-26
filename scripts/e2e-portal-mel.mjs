// E2E do fluxo do portal do cliente (tenant mel) via CDP.
// Uso: node scripts/e2e-portal-mel.mjs <baseUrl>
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const baseUrl = (process.argv[2] || "https://verifica-gilt.vercel.app").replace(/\/+$/, "");
const entry = `${baseUrl}/verifica/cliente/entrar?tenant=mel`;
const PHONE = process.argv[3] || "11999990004";
const PLATE = process.argv[4] || "TESTE456";
const PASSWORD = "senha123";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 10200 + Math.floor(Math.random() * 40);
const profileDir = mkdtempSync(join(tmpdir(), "vw-e2e-"));
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
const pollUrl = async (predicate, timeoutMs = 12000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const href = await evaluate("location.href");
    if (predicate(href)) return href;
    await sleep(350);
  }
  return await evaluate("location.href");
};
// servidores de ação só funcionam após a hidratação (action injetado por JS no SSR)
const waitHydrated = async (timeoutMs = 12000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const action = await evaluate(`(document.querySelector("form") ? document.querySelector("form").action : "")`);
    if (action && action.length > 0) return true;
    await sleep(300);
  }
  return false;
};

const report = [];

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");

// ===== PASSO 1: página inicial com tenant=mel mostra formulário telefone+placa =====
await send("Page.navigate", { url: entry });
await sleep(4000);
const step2 = await evaluate(`({ phoneInput: !!document.querySelector('input[name="phone"]'), plateInput: !!document.querySelector('input[name="plate"]'), hasContinue: [...document.querySelectorAll("button")].some((b) => b.textContent.includes("Continuar")) })`);
report.push({ passo: "1-entrar-tenant-mel", ...step2 });

// ===== PASSO 2: telefone inválido -> erro visível e específico (continua no passo 2) =====
const networkLog = [];
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message));
    else resolve(msg.result);
  } else if (msg.method === "Network.responseReceived") {
    const { response } = msg.params;
    if (response.url.includes("cliente/entrar") || response.url.includes("actions")) {
      networkLog.push({ kind: "resp", status: response.status, url: response.url.slice(0, 140), redirectUrl: response.headers?.location || null });
    }
  } else if (msg.method === "Network.requestWillBeSent") {
    const { request } = msg.params;
    if (request.method === "POST" && (request.url.includes("cliente/entrar") || request.url.includes("actions"))) {
      networkLog.push({ kind: "post", url: request.url.slice(0, 140), actionHeader: request.headers?.["Next-Action"] || null, postData: (request.postData || "").slice(0, 220) });
    }
  }
};
const hydrated2 = await waitHydrated();
await evaluate(`(() => {
  document.querySelector('input[name="phone"]').value = "123";
  document.querySelector('input[name="plate"]').value = "${PLATE}";
  document.querySelector("form").requestSubmit();
})()`);
let invalidStep = null;
let invalidUrl = "";
for (let i = 0; i < 40; i++) {
  invalidStep = await evaluate(`({
    url: location.href,
    body: document.body.innerText,
    erroVisivel: document.body.innerText.includes("Informe um telefone válido") || location.search.includes("error="),
    aindaStep2: !!document.querySelector('input[name="phone"]'),
  })`);
  invalidUrl = invalidStep.url;
  if (invalidStep.erroVisivel) break;
  await sleep(400);
}
report.push({ passo: "2-telefone-invalido", hidratado: hydrated2, url: invalidUrl, erroVisivel: invalidStep.erroVisivel, aindaStep2: invalidStep.aindaStep2, trecho: invalidStep.body.slice(0, 140), rede: networkLog.slice(-8) });

// ===== PASSO 3: telefone/placa novos -> "Primeiro acesso" com confirmação =====
await waitHydrated();
await evaluate(`(() => {
  document.querySelector('input[name="phone"]').value = "${PHONE}";
  document.querySelector('input[name="plate"]').value = "${PLATE}";
  document.querySelector("form").requestSubmit();
})()`);
const url3 = await pollUrl((h) => h.includes("step=3"));
await sleep(2000);
const firstAccess = await evaluate(`(() => {
  const body = document.body.innerText;
  return {
    url: location.href,
    tituloPrimeiroAcesso: body.includes("Primeiro acesso"),
    explicacao: body.includes("Não encontramos esse telefone e placa") && body.includes("primeiro acesso"),
    confirmacao: body.includes("Telefone:") && body.includes("Placa:") && body.includes("TESTE") && body.includes("Local:") && body.includes("mel"),
    botaoCriarConta: [...document.querySelectorAll("button")].some((b) => b.textContent.includes("Criar conta")),
    semFormLogin: ![...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Entrar"),
    trecho: body.slice(0, 200),
  };
})()`);
report.push({ passo: "3-primeiro-acesso", url: url3, ...firstAccess });

// ===== PASSO 4: cadastro completo -> portal =====
await waitHydrated();
await evaluate(`(() => {
  const set = (name, value) => {
    const el = document.querySelector('input[name="' + name + '"], select[name="' + name + '"]');
    if (el) {
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };
  set("firstName", "Teste E2E");
  set("lastName", "Portal");
  set("vehicleModel", "BMW Teste");
  set("vehicleType", "sedan");
  set("vehicleColor", "Preto");
  set("password", "senha123");
  document.querySelector("form").requestSubmit();
})()`);
const portalUrl = await pollUrl((h) => h.includes("/cliente/portal"), 15000);
await sleep(3000);
const portal = await evaluate(`({ url: location.href, texto: document.body.innerText.slice(0, 400) })`);
report.push({ passo: "4-registrado-no-portal", url: portalUrl, ...portal });

// ===== PASSO 5: nova sessão, mesmo telefone+placa -> "Entrar no portal" =====
await send("Network.clearBrowserCookies");
await send("Page.navigate", { url: entry });
await sleep(3000);
await waitHydrated();
await evaluate(`(() => {
  document.querySelector('input[name="phone"]').value = "${PHONE}";
  document.querySelector('input[name="plate"]').value = "${PLATE}";
  document.querySelector("form").requestSubmit();
})()`);
const url5 = await pollUrl((h) => h.includes("step=3"));
await sleep(1500);
const existing = await evaluate(`(() => {
  const body = document.body.innerText;
  return {
    url: location.href,
    tituloEntrar: body.includes("Entrar no portal"),
    explicacao: body.includes("Encontramos sua conta"),
    campoSenha: !!document.querySelector('input[name="password"]'),
    semCadastro: ![...document.querySelectorAll("button")].some((b) => b.textContent.includes("Criar conta")),
  };
})()`);
report.push({ passo: "5-existente-entrar-no-portal", url: url5, ...existing });

// ===== PASSO 6: login com a senha criada -> portal COM o veículo vinculado =====
await waitHydrated();
await evaluate(`(() => {
  const el = document.querySelector('input[name="password"]');
  if (el) {
    el.value = "${PASSWORD}";
    document.querySelector("form").requestSubmit();
  }
})()`);
const portal2Url = await pollUrl((h) => h.includes("/cliente/portal"), 15000);
await sleep(4000);
const portal2 = await evaluate(`({ url: location.href, texto: document.body.innerText.slice(0, 500) })`);
const vehicleVisible = portal2.texto.includes("${PLATE}") || portal2.texto.includes("BMW Teste");
report.push({ passo: "6-login-portal-veiculo", url: portal2Url, veiculoVisivel: vehicleVisible, texto: portal2.texto });

console.log(JSON.stringify(report, null, 2));

ws.close();
browser.kill();
await sleep(1200);
try {
  rmSync(profileDir, { recursive: true, force: true });
} catch {}
