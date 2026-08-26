// Validação final do mel via DOM real (aguarda streaming). Uso: node scripts/audit-mel-final.mjs <url>
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const url = process.argv[2] || "https://verifica-saas.vercel.app/verifica/mel";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 10400 + Math.floor(Math.random() * 30);
const profileDir = mkdtempSync(join(tmpdir(), "vw-final-"));
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
await sleep(6000);

const result = await evaluate(`(async () => {
  const file = (el) => (el ? (el.currentSrc || el.src || "").split("/").pop().split("?")[0] : null);
  const galleryTiles = [...document.querySelectorAll('#galeria a[href^="#post-"]')];
  const gallery = galleryTiles.map((a) => ({ title: (a.querySelector("p") || {}).textContent || "", img: file(a.querySelector("img")) }));
  const feedArticles = [...document.querySelectorAll('#feed article[id^="post-"]')];
  const feed = feedArticles.map((a) => ({ title: (a.querySelector("p") || {}).textContent || "", img: file(a.querySelector("img")), counter: (a.querySelector("span") || {}).textContent || "" }));

  const probeCarousel = async (article) => {
    if (!article) return null;
    article.scrollIntoView({ block: "center" });
    await new Promise((r) => setTimeout(r, 1200));
    const slides = [];
    const push = () => {
      const img = article.querySelector("img");
      slides.push(file(img));
    };
    push();
    const nextBtn = article.querySelector('button[aria-label="Próxima imagem"]');
    const counter0 = (article.querySelector("span") || {}).textContent || "";
    if (nextBtn) {
      nextBtn.click();
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 300));
        const cur = file(article.querySelector("img"));
        if (cur && cur !== slides[0]) break;
      }
      push();
    }
    const counter1 = (article.querySelector("span") || {}).textContent || "";
    return { slides, counter0, counter1, temCarrossel: !!nextBtn };
  };

  const bmw = await probeCarousel(feedArticles[0]);
  const resultado = await probeCarousel(feedArticles[1]);

  const whatsapp = [...document.querySelectorAll("a")].find((a) => a.textContent.trim() === "WhatsApp");
  const ligar = [...document.querySelectorAll("a")].find((a) => a.textContent.trim() === "Ligar");
  const cs = (el) => {
    if (!el) return null;
    const s = getComputedStyle(el);
    return { bg: s.backgroundImage, bgColor: s.backgroundColor, border: s.borderColor, radius: s.borderRadius, h: s.height, cor: s.color };
  };
  const canon = document.querySelector('link[rel="canonical"]');
  return {
    perfilPublicoAusente: !document.body.innerText.includes("Perfil público"),
    gallery,
    feed,
    bmw,
    resultado,
    whatsappIgualLigar: JSON.stringify(cs(whatsapp)) === JSON.stringify(cs(ligar)) && cs(whatsapp) !== null,
    canonical: canon ? canon.href : null,
    urlTemp: /verifica-[a-z0-9]+-verificawash-9140s-projects\.vercel\.app/.test(location.href) || document.body.innerText.includes("verifica-gu565"),
  };
})()`);

// mapeia arquivo -> SHA-256 (tabela real do tenant; mesma imagem = mesmo hash)
const HASH_BY_FILE = {
  "bmw-0001.jpg": "1f8300837f0f43a7",
  "bmw-0002.jpg": "28b1d8ae4d2cd853",
  "bmw-0003.jpg": "05c926c696b9356c",
  "demo-external-wash.png": "8079a9ab9f23122e",
  "demo-post-wash.png": "8079a9ab9f23122e",
  "demo-post-tire.png": "185dec67d464ab0e",
  "demo-before-street.png": "db1253ad1f64ec0d",
  "demo-after-street.png": "02daa626462b4c2b",
  "ready-1781213462642.jpg": "9b965aa36265d3f9",
  "ready-1781213344925.jpg": "9745452c11c30ff0",
  "step-1781213247766.jpg": "c5d7d506c4f03a5f",
  "step-1781212168703.jpg": "9745452c11c30ff0",
  "step-1781212044280.jpg": "c5d7d506c4f03a5f",
};
const galleryHashes = result.gallery.map((g) => HASH_BY_FILE[g.img] || `??:${g.img}`);
const distinctHashes = [...new Set(galleryHashes)];
const feedHashes = result.feed.map((f) => HASH_BY_FILE[f.img] || `??:${f.img}`);
result.galeriaHashesDistintos = `${distinctHashes.length}/${galleryHashes.length}`;
result.galeriaHashDuplicado = distinctHashes.length !== galleryHashes.length;
result.feedHashDuplicado = new Set(feedHashes).size !== feedHashes.length;
result.galeriaCapaInterna = result.gallery.some((g) => g.img === "step-1781212044280.jpg");
result.galeriaCivic = result.gallery.some((g) => g.img === "step-1781212168703.jpg");
result.lavadorNaGaleria = result.gallery.filter((g) => HASH_BY_FILE[g.img] === "8079a9ab9f23122e").length;
result.resultadoSemLavador = !(result.resultado?.slides || []).some((s) => HASH_BY_FILE[s] === "8079a9ab9f23122e");
result.resultado2Slides = result.resultado ? result.resultado.slides.length === 2 : false;

console.log(JSON.stringify(result, null, 2));
ws.close();
browser.kill();
await sleep(1200);
try {
  rmSync(profileDir, { recursive: true, force: true });
} catch {}
