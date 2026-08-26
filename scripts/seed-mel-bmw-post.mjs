// Seed idempotente: publicação "Lavagem especial em BMW preto" (tenant mel) com 3 imagens em carrossel.
// Fluxo do produto: upload no storage attendance-media → attendance_media (kind='marketing') →
// marketing_assets (status approved). tenant_landing_media (M9) é tentada mas NÃO é obrigatória
// (fallback no repo já usa kind='marketing'). Reexecução segura: nunca duplica.
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const TITLE = "Lavagem especial em BMW preto";
const DESCRIPTION =
  "Lavagem especial de um BMW preto, com cuidado em cada etapa para devolver brilho, acabamento e aparência impecável.";
const FILES = [
  { label: "0001", path: "C:\\Users\\Ideias e Ambientes\\Desktop\\VERIFICA SOLUTIONS\\03_PRODUTOS\\VERIFICA\\LAVA RAPIDO DA MEL\\0001.jpg" },
  { label: "0002", path: "C:\\Users\\Ideias e Ambientes\\Desktop\\VERIFICA SOLUTIONS\\03_PRODUTOS\\VERIFICA\\LAVA RAPIDO DA MEL\\0002.jpg" },
  { label: "0003", path: "C:\\Users\\Ideias e Ambientes\\Desktop\\VERIFICA SOLUTIONS\\03_PRODUTOS\\VERIFICA\\LAVA RAPIDO DA MEL\\0003.jpg" },
];
const ATTENDANCE_MARKER = "seed:bmw-carousel:v1";
const CUSTOMER_NAME = "Cliente demo BMW";
const PLATE = "BMWPRETO";
const BUCKET = "attendance-media";

function readEnv() {
  const env = {};
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  }
  return env;
}

const env = readEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("FALHA: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes em .env.local");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

function fail(msg) {
  console.error(`FALHA: ${msg}`);
  process.exit(1);
}

const payloads = FILES.map((file) => {
  if (!existsSync(file.path)) fail(`arquivo não encontrado: ${file.path}`);
  const bytes = readFileSync(file.path);
  if (bytes.length < 1000) fail(`arquivo muito pequeno (possivelmente inválido): ${file.path} (${bytes.length} bytes)`);
  return { ...file, bytes };
});

const { data: tenant, error: tenantError } = await admin
  .from("tenants")
  .select("id, name, slug")
  .eq("slug", "mel")
  .maybeSingle();
if (tenantError || !tenant) fail(`tenant mel não encontrado: ${tenantError?.message ?? "sem dados"}`);
const tenantId = tenant.id;
console.log(`tenant: ${tenant.name} (${tenantId})`);

// 1) Idempotência: publicação já existe?
const { data: existingAssets } = await admin
  .from("marketing_assets")
  .select("id, attendance_id, media_id")
  .eq("tenant_id", tenantId)
  .eq("title", TITLE)
  .limit(5);
if (existingAssets && existingAssets.length > 0) {
  const asset = existingAssets[0];
  const { data: mediaRows } = await admin
    .from("attendance_media")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("attendance_id", asset.attendance_id ?? "")
    .eq("kind", "marketing");
  const count = mediaRows?.length ?? 0;
  console.log(`JÁ EXISTE (idempotente): asset=${asset.id} media_marketing=${count}`);
  if (count >= 3) {
    console.log(`OK: publicação já completa com ${count} imagens. Nada duplicado.`);
    process.exit(0);
  }
  console.log(`ATENÇÃO: asset existe mas com ${count} mídias — continuando para completar.`);
}

// 2) Serviço (reuso; nunca cria card novo na landing)
const { data: serviceRows } = await admin
  .from("services")
  .select("id")
  .eq("tenant_id", tenantId)
  .eq("is_active", true)
  .order("sort_order", { ascending: true })
  .limit(1);
if (!serviceRows || serviceRows.length === 0) fail("nenhum serviço ativo para o tenant mel");
const serviceId = serviceRows[0].id;

// 3) Cliente/veículo (idempotentes)
let customerId = null;
const { data: custExisting } = await admin.from("customers").select("id").eq("tenant_id", tenantId).eq("name", CUSTOMER_NAME).limit(1);
if (custExisting && custExisting.length > 0) {
  customerId = custExisting[0].id;
} else {
  const { data: cust, error: custError } = await admin.from("customers").insert({ tenant_id: tenantId, name: CUSTOMER_NAME }).select("id").single();
  if (custError) fail(`customer: ${custError.message}`);
  customerId = cust.id;
}

let vehicleId = null;
const { data: vehExisting } = await admin.from("vehicles").select("id").eq("tenant_id", tenantId).eq("plate", PLATE).limit(1);
if (vehExisting && vehExisting.length > 0) {
  vehicleId = vehExisting[0].id;
} else {
  const { data: veh, error: vehError } = await admin
    .from("vehicles")
    .insert({ tenant_id: tenantId, customer_id: customerId, plate: PLATE, model: "BMW Série 3 (demo)", color: "Preto" })
    .select("id")
    .single();
  if (vehError) fail(`vehicle: ${vehError.message}`);
  vehicleId = veh.id;
}

// 4) Attendance dedicado (marcador idempotente; status delivered = fora da fila)
let attendanceId = null;
const { data: attExisting } = await admin.from("attendances").select("id").eq("tenant_id", tenantId).eq("notes", ATTENDANCE_MARKER).limit(1);
if (attExisting && attExisting.length > 0) {
  attendanceId = attExisting[0].id;
} else {
  const now = new Date();
  const { data: att, error: attError } = await admin
    .from("attendances")
    .insert({
      tenant_id: tenantId,
      customer_id: customerId,
      vehicle_id: vehicleId,
      service_id: serviceId,
      status: "delivered",
      delivered_at: now.toISOString(),
      notes: ATTENDANCE_MARKER,
    })
    .select("id")
    .single();
  if (attError) fail(`attendance: ${attError.message}`);
  attendanceId = att.id;
}
console.log(`attendance: ${attendanceId}`);

// 5) Upload das 3 imagens (upsert = reexecução segura)
const storagePath = (label) => `tenant/${tenantId}/attendances/${attendanceId}/bmw-${label}.jpg`;
const uploadedPaths = [];
for (const file of payloads) {
  const path = storagePath(file.label);
  const { error } = await admin.storage.from(BUCKET).upload(path, file.bytes, { contentType: "image/jpeg", upsert: true });
  if (error) fail(`upload ${file.label}: ${error.message}`);
  uploadedPaths.push(path);
  console.log(`upload ok: ${path} (${file.bytes.length} bytes)`);
}

// 6) attendance_media kind='marketing' (idempotente por file_path)
const mediaIds = [];
for (let i = 0; i < payloads.length; i++) {
  const file = payloads[i];
  const path = uploadedPaths[i];
  const { data: existing } = await admin
    .from("attendance_media")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("attendance_id", attendanceId)
    .eq("file_path", path)
    .limit(1);
  if (existing && existing.length > 0) {
    mediaIds[i] = existing[0].id;
    continue;
  }
  const createdAt = new Date(Date.now() - (payloads.length - 1 - i) * 5000).toISOString();
  const { data: media, error: mediaError } = await admin
    .from("attendance_media")
    .insert({
      tenant_id: tenantId,
      attendance_id: attendanceId,
      kind: "marketing",
      file_path: path,
      mime_type: "image/jpeg",
      caption: `${TITLE} — foto ${file.label}/3`,
      created_at: createdAt,
    })
    .select("id")
    .single();
  if (mediaError) fail(`attendance_media ${file.label}: ${mediaError.message}`);
  mediaIds[i] = media.id;
}
console.log(`media marketing: ${mediaIds.join(", ")}`);

// 7) marketing_assets (idempotente por título)
let assetId = null;
const { data: assetExisting } = await admin.from("marketing_assets").select("id").eq("tenant_id", tenantId).eq("title", TITLE).limit(1);
if (assetExisting && assetExisting.length > 0) {
  assetId = assetExisting[0].id;
  const { error: patchError } = await admin
    .from("marketing_assets")
    .update({ attendance_id: attendanceId, media_id: mediaIds[0], status: "approved", approved_at: new Date().toISOString() })
    .eq("id", assetId);
  if (patchError) fail(`asset update: ${patchError.message}`);
} else {
  const { data: asset, error: assetError } = await admin
    .from("marketing_assets")
    .insert({
      tenant_id: tenantId,
      attendance_id: attendanceId,
      media_id: mediaIds[0],
      kind: "post",
      title: TITLE,
      generated_text: DESCRIPTION,
      cta: null,
      hashtags: [],
      status: "approved",
      approved_at: new Date().toISOString(),
      prompt_snapshot: { source: "seed-bmw-carousel", images: 3 },
    })
    .select("id")
    .single();
  if (assetError) fail(`marketing_assets: ${assetError.message}`);
  assetId = asset.id;
}
console.log(`marketing_asset: ${assetId} (status=approved)`);

// 8) tenant_landing_media (M9) — opcional; falha (404) é esperada sem a migration
let landingMediaApplied = false;
try {
  const rows = uploadedPaths.map((path, i) => ({
    tenant_id: tenantId,
    marketing_asset_id: assetId,
    attendance_media_id: mediaIds[i],
    file_path: path,
    mime_type: "image/jpeg",
    kind: "post",
    sort_order: i + 1,
    is_active: true,
  }));
  const { error: lmError } = await admin.from("tenant_landing_media").insert(rows);
  if (lmError) throw new Error(lmError.message);
  landingMediaApplied = true;
} catch (err) {
  console.log(`tenant_landing_media indisponível (M9 não aplicada no remoto): ${err.message} — carrossel via kind='marketing'`);
}

// 9) Auditoria
await admin.from("audit_logs").insert({
  actor_role: "system",
  tenant_id: tenantId,
  action: "landing.post.seeded",
  entity_type: "marketing_asset",
  entity_id: assetId,
  message: `Publicação "Lavagem especial em BMW preto" criada com 3 imagens (seed idempotente).`,
  metadata: { images: 3, landing_media: landingMediaApplied, attendance_id: attendanceId },
});

console.log(
  JSON.stringify(
    {
      ok: true,
      tenantId,
      attendanceId,
      customerId,
      vehicleId,
      mediaIds,
      assetId,
      title: TITLE,
      landingMediaApplied,
      canonicalHint: "verifica-gilt.vercel.app/verifica/mel (verifica-saas equivalente)",
    },
    null,
    2
  ),
);
