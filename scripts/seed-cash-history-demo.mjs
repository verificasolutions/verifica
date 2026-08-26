import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const marker = "[DEMO HISTORICO CAIXA]";

const entries = [
  ["2026-07-03", "income", "Serviço • Lavagem completa • Cliente demo", 420, "pix"],
  ["2026-07-03", "income", "Estética • Polimento técnico • Cliente demo", 280, "card"],
  ["2026-07-04", "expense", "Insumo • Produtos de limpeza • Demo", 95, "cash"],
  ["2026-07-10", "income", "Serviço • Lavagem completa • Cliente demo", 560, "cash"],
  ["2026-07-10", "income", "Higienização • Higienização interna • Cliente demo", 360, "pix"],
  ["2026-07-11", "expense", "Insumo • Produtos de limpeza • Demo", 130, "cash"],
  ["2026-07-17", "income", "Serviço • Lavagem simples • Cliente demo", 390, "pix"],
  ["2026-07-17", "income", "Estética • Vitrificação • Cliente demo", 520, "card"],
  ["2026-07-18", "expense", "Fornecedor • Químicos • Demo", 180, "cash"],
  ["2026-07-24", "income", "Serviço • Lavagem completa • Cliente demo", 610, "pix"],
  ["2026-07-24", "income", "Higienização • Higienização interna • Cliente demo", 410, "cash"],
  ["2026-07-25", "expense", "Salários • Diárias da equipe • Demo", 260, "cash"],
  ["2026-08-01", "income", "Serviço • Lavagem completa • Cliente demo", 720, "pix"],
  ["2026-08-01", "income", "Estética • Polimento técnico • Cliente demo", 330, "card"],
  ["2026-08-02", "expense", "Produtos • Produtos de limpeza • Demo", 210, "cash"],
  ["2026-08-07", "income", "Serviço • Lavagem simples • Cliente demo", 480, "cash"],
  ["2026-08-07", "income", "Higienização • Higienização interna • Cliente demo", 390, "pix"],
  ["2026-08-08", "expense", "Aluguel • Espaço operacional • Demo", 900, "cash"],
  ["2026-08-14", "income", "Serviço • Lavagem completa • Cliente demo", 850, "pix"],
  ["2026-08-14", "income", "Estética • Polimento técnico • Cliente demo", 460, "card"],
  ["2026-08-15", "expense", "Energia • Conta operacional • Demo", 180, "cash"],
  ["2026-08-21", "income", "Serviço • Lavagem completa • Cliente demo", 930, "pix"],
  ["2026-08-21", "income", "Higienização • Higienização interna • Cliente demo", 440, "cash"],
  ["2026-08-22", "expense", "Produtos • Produtos de limpeza • Demo", 240, "cash"],
];

const { data: tenant, error: tenantError } = await supabase.from("tenants").select("id,name").eq("slug", "mel").single();
if (tenantError) throw tenantError;

const { count, error: existingError } = await supabase
  .from("cash_entries")
  .select("id", { count: "exact", head: true })
  .eq("tenant_id", tenant.id)
  .like("description", `${marker}%`);
if (existingError) throw existingError;

if ((count ?? 0) > 0) {
  console.log(`Demo já existente para ${tenant.name}: ${count} lançamentos.`);
  process.exit(0);
}

const payload = entries.map(([effective_date, kind, description, amount, payment_method]) => ({
  tenant_id: tenant.id,
  kind,
  payment_method,
  description: `${marker} ${description}`,
  amount,
  effective_date,
  settlement_status: "settled",
  cash_session_id: null,
}));

const { error } = await supabase.from("cash_entries").insert(payload);
if (error) throw error;

console.log(`Criados ${payload.length} lançamentos DEMO para ${tenant.name}.`);
