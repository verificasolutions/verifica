// Inventário por SHA-256 de TODAS as mídias do tenant mel (sem inspeção visual).
// Saída: tabela id|kind|arquivo|bytes|hash + grupos de duplicatas reais (mesmo hash).
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const envPath = ".env.local";
const env = {};
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
}
const base = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const tenantId = "654f718d-80ae-44be-9e01-100989a267e5";

const rows = [
  ["881d0df1-fe68-45e9-ae53-f2a985a5b227", "marketing", "bmw-0001.jpg", `tenant/${tenantId}/attendances/fc7820b1-af5d-4370-8d1a-40bbcf3a8586/bmw-0001.jpg`],
  ["7006c5c0-8d61-4fb4-88d2-d8a6255fc6b0", "marketing", "bmw-0002.jpg", `tenant/${tenantId}/attendances/fc7820b1-af5d-4370-8d1a-40bbcf3a8586/bmw-0002.jpg`],
  ["b231a3cc-0a3a-469c-83b4-a32cb1cede56", "marketing", "bmw-0003.jpg", `tenant/${tenantId}/attendances/fc7820b1-af5d-4370-8d1a-40bbcf3a8586/bmw-0003.jpg`],
  ["1df365ff-7d36-4fcb-9a3d-fd9b41007d69", "marketing", "demo-external-wash.png", `tenant/${tenantId}/attendances/fdc98031-4016-4ae7-8ddf-0275b8dd9c55/demo-external-wash.png`],
  ["3a2c5df5-0702-48ef-9437-d224e4c99839", "marketing", "demo-post-tire.png", `tenant/${tenantId}/attendances/fdc98031-4016-4ae7-8ddf-0275b8dd9c55/demo-post-tire.png`],
  ["0257b9be-ea4a-47b3-9215-f929a2c48798", "marketing", "demo-post-wash.png", `tenant/${tenantId}/attendances/fdc98031-4016-4ae7-8ddf-0275b8dd9c55/demo-post-wash.png`],
  ["443822b2-b8f3-4773-993c-510b727e3024", "entry", "demo-before-street.png", `tenant/${tenantId}/attendances/fdc98031-4016-4ae7-8ddf-0275b8dd9c55/demo-before-street.png`],
  ["d091cdf3-cdd6-4765-8353-5bd668293458", "ready", "demo-after-street.png", `tenant/${tenantId}/attendances/fdc98031-4016-4ae7-8ddf-0275b8dd9c55/demo-after-street.png`],
  ["ce1024ca-74b0-4226-9fd0-bf3f7f04c327", "ready", "ready-1781213462642.jpg", `tenant/${tenantId}/attendances/fdc98031-4016-4ae7-8ddf-0275b8dd9c55/ready-1781213462642.jpg`],
  ["74681e9f-48e7-4157-8303-79b2233d9d2b", "ready", "ready-1781213344925.jpg", `tenant/${tenantId}/attendances/c1dac54b-7c83-4470-aace-ee0b24a8999f/ready-1781213344925.jpg`],
  ["4b4a1afd-0547-47ad-b01a-a68d8400befc", "step", "step-1781213247766.jpg", `tenant/${tenantId}/attendances/f4e38d67-fe8b-4196-9492-1c587d36c5fc/step-1781213247766.jpg`],
  ["bdf9dace-1a58-4519-a4b4-c737a0359051", "step", "step-1781212168703.jpg", `tenant/${tenantId}/attendances/6a344d80-183e-4b4c-aafe-0b62613fc70e/step-1781212168703.jpg`],
  ["0f63f7d1-9670-4209-b149-fda0989be1b7", "step", "step-1781212044280.jpg", `tenant/${tenantId}/attendances/6a344d80-183e-4b4c-aafe-0b62613fc70e/step-1781212044280.jpg`],
  ["landing-cover", "landing", "cover-banner-png.png", `tenant/${tenantId}/landing/cover-banner-png.png`],
  ["landing-profile", "landing", "profile-perfil-png.png", `tenant/${tenantId}/landing/profile-perfil-png.png`],
];

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const signRes = await fetch(`${base}/storage/v1/object/sign/attendance-media`, {
  method: "POST",
  headers,
  body: JSON.stringify({ paths: rows.map((r) => r[3]), expiresIn: 3600 }),
});
const signed = await signRes.json();
const urlByPath = new Map(signed.map((s) => [s.path, `${base}/storage/v1${s.signedURL}`]));

const results = [];
for (const [id, kind, name, path] of rows) {
  const url = urlByPath.get(path);
  const resp = await fetch(url);
  const buf = Buffer.from(await resp.arrayBuffer());
  const hash = createHash("sha256").update(buf).digest("hex");
  results.push({ id, kind, name, bytes: buf.length, hash: hash.slice(0, 16), fullHash: hash });
}

const groups = new Map();
for (const r of results) {
  if (!groups.has(r.hash)) groups.set(r.hash, []);
  groups.get(r.hash).push(r.name);
}
const dups = [...groups.entries()].filter(([, v]) => v.length > 1);

console.log(JSON.stringify({ arquivos: results.map((r) => `${r.kind}|${r.name}|${r.bytes}b|${r.hash}`), duplicatasReais: dups }, null, 2));
