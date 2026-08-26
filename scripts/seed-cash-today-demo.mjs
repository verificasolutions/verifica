import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const marker = "[DEMO HOJE CAIXA 2026-08-26]";
const tenantSlug = "mel";
const effectiveDate = "2026-08-26";

const { data: tenant, error: tenantError } = await supabase.from("tenants").select("id,name").eq("slug", tenantSlug).single();
if (tenantError) throw tenantError;

const { count, error: existingError } = await supabase
  .from("cash_entries")
  .select("id", { count: "exact", head: true })
  .eq("tenant_id", tenant.id)
  .like("description", `${marker}%`);
if (existingError) throw existingError;

if ((count ?? 0) > 0) {
  console.log(`Demo de hoje já existente para ${tenant.name}: ${count} lançamentos.`);
  process.exit(0);
}

const [{ data: customers, error: customersError }, { data: vehicles, error: vehiclesError }] = await Promise.all([
  supabase.from("customers").select("id,name").eq("tenant_id", tenant.id).eq("is_active", true).order("created_at", { ascending: true }).limit(4),
  supabase.from("vehicles").select("customer_id,plate,model").eq("tenant_id", tenant.id).order("created_at", { ascending: true }).limit(4),
]);
if (customersError) throw customersError;
if (vehiclesError) throw vehiclesError;

const customerById = new Map((customers ?? []).map((customer) => [customer.id, customer]));
const clientEntries = (vehicles ?? []).slice(0, 4).map((vehicle, index) => {
  const customer = customerById.get(vehicle.customer_id);
  const service = ["Lavagem completa", "Higienização interna", "Polimento técnico", "Lavagem simples"][index] ?? "Lavagem completa";
  const amount = [70, 120, 180, 45][index] ?? 70;
  const method = ["pix", "cash", "card", "pix"][index] ?? "pix";
  return {
    tenant_id: tenant.id,
    kind: "income",
    payment_method: method,
    description: `${marker} Serviço • ${service} • ${customer?.name ?? "Cliente cadastrado"} • ${vehicle.plate}`,
    amount,
    effective_date: effectiveDate,
    settlement_status: "settled",
    cash_session_id: null,
  };
});

const expenses = [
  ["Produtos • Shampoo e cera", 85],
  ["Salários • Diárias da equipe", 120],
  ["Energia • Consumo operacional", 60],
].map(([description, amount]) => ({
  tenant_id: tenant.id,
  kind: "expense",
  payment_method: "cash",
  description: `${marker} ${description}`,
  amount,
  effective_date: effectiveDate,
  settlement_status: "settled",
  cash_session_id: null,
}));

const payload = [...clientEntries, ...expenses];
const { error } = await supabase.from("cash_entries").insert(payload);
if (error) throw error;

console.log(`Criados ${clientEntries.length} recebimentos e ${expenses.length} saídas DEMO para ${tenant.name} em ${effectiveDate}.`);
