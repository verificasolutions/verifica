import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const MARKER = "[DEMO INTELIGENCIA 2026-08-26]";
const TODAY = "2026-08-26";
const DAYS = 45;

function readEnv() {
  const values = {};
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (match) values[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return values;
}

const env = readEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const chunk = (items, size = 100) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size));
const iso = (date, hour, minute) => `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-03:00`;
const dateAtOffset = (offset) => { const date = new Date(`${TODAY}T12:00:00-03:00`); date.setDate(date.getDate() - offset); return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date); };
const fail = (label, error) => { if (error) throw new Error(`${label}: ${error.message}`); };

const { data: tenant, error: tenantError } = await supabase.from("tenants").select("id,name").eq("slug", "mel").single();
fail("tenant", tenantError);
const { count, error: countError } = await supabase.from("attendances").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).like("notes", `${MARKER}%`);
fail("idempotência", countError);
if ((count ?? 0) > 0) { console.log(`Seed já aplicado para ${tenant.name}: ${count} atendimentos.`); process.exit(0); }

const [{ data: services, error: servicesError }, { data: employees, error: employeesError }] = await Promise.all([
  supabase.from("services").select("id,name,price,kind").eq("tenant_id", tenant.id).eq("is_active", true).order("sort_order", { ascending: true }),
  supabase.from("employees").select("id,name").eq("tenant_id", tenant.id).eq("is_active", true).order("created_at", { ascending: true }),
]);
fail("serviços", servicesError); fail("colaboradores", employeesError);
const usableServices = (services ?? []).filter((service) => service.kind === "main").slice(0, 6);
if (!usableServices.length) throw new Error("O tenant Mel não possui serviços principais ativos.");

const names = ["Ana Martins", "Bruno Costa", "Carla Mendes", "Diego Alves", "Eduarda Lima", "Felipe Rocha", "Gabriela Souza", "Henrique Dias", "Isabela Nunes", "João Barros", "Karen Ribeiro", "Lucas Freitas", "Mariana Lopes", "Nicolas Reis", "Olivia Campos", "Paulo Vieira", "Rafaela Moura", "Samuel Teixeira", "Taina Moraes", "Victor Cardoso", "Wesley Santos", "Yasmin Oliveira", "Adriana Pinto", "Caio Monteiro", "Daniela Ramos", "Enzo Carvalho", "Fernanda Prado", "Gustavo Leal", "Helena Duarte", "Igor Farias", "Julia Araujo", "Leonardo Pires", "Manuela Torres", "Otavio Neves", "Priscila Melo", "Renato Xavier"];
const vehicleTypes = ["hatch", "sedan", "suv", "pickup", "van", "moto"];
const vehicleModels = ["Onix", "Civic", "Creta", "Ranger", "Kangoo", "CG 160"];
const colors = ["Preto", "Branco", "Prata", "Cinza", "Azul", "Vermelho"];
const customerPayload = names.map((name, index) => ({ tenant_id: tenant.id, name: `${name} ${MARKER}`, whatsapp: `119900${String(index + 1).padStart(5, "0")}`, phone_normalized: `119900${String(index + 1).padStart(5, "0")}`, notes: `${MARKER} cliente fictício`, is_active: true }));
const { data: customers, error: customerError } = await supabase.from("customers").insert(customerPayload).select("id,name");
fail("clientes", customerError);
const vehiclePayload = (customers ?? []).map((customer, index) => ({ tenant_id: tenant.id, customer_id: customer.id, plate: `D${String(index + 1).padStart(2, "0")}M${String(index + 1).padStart(3, "0")}`, model: vehicleModels[index % vehicleModels.length], brand: ["Chevrolet", "Honda", "Hyundai", "Ford", "Renault", "Honda"][index % 6], color: colors[index % colors.length], vehicle_type: vehicleTypes[index % vehicleTypes.length], notes: MARKER, is_active: true }));
const { data: vehicles, error: vehicleError } = await supabase.from("vehicles").insert(vehiclePayload).select("id,customer_id,vehicle_type");
fail("veículos", vehicleError);
const employeeIds = (employees ?? []).map((employee) => employee.id);
const attendances = [];
for (let offset = DAYS; offset >= 0; offset -= 1) {
  const date = dateAtOffset(offset);
  const amount = offset === 0 ? 14 : 2 + ((offset * 7) % 5);
  for (let index = 0; index < amount; index += 1) {
    const vehicle = vehicles[(offset * 3 + index) % vehicles.length];
    const service = usableServices[(offset + index) % usableServices.length];
    const hour = 8 + ((index * 2 + offset) % 10);
    const created = iso(date, hour, (index * 11 + offset) % 60);
    const price = Number(service.price ?? 0) || 50 + ((index % 5) * 20);
    attendances.push({ tenant_id: tenant.id, customer_id: vehicle.customer_id, vehicle_id: vehicle.id, service_id: service.id, employee_id: employeeIds.length ? employeeIds[index % employeeIds.length] : null, status: "delivered", estimated_minutes: 30 + ((index % 3) * 15), base_price: price, final_price: price, payment_method: ["pix", "cash", "card"][index % 3], started_at: iso(date, hour, Math.max(0, ((index * 11 + offset) % 60) - 8)), ready_at: iso(date, hour, ((index * 11 + offset + 28) % 60)), delivered_at: iso(date, hour, ((index * 11 + offset + 38) % 60)), created_at: created, notes: `${MARKER} atendimento fictício ${date}` });
  }
}
const createdAttendances = [];
for (const group of chunk(attendances)) { const { data, error } = await supabase.from("attendances").insert(group).select("id,tenant_id,final_price,payment_method,created_at"); fail("atendimentos", error); createdAttendances.push(...(data ?? [])); }
const cash = createdAttendances.map((attendance) => ({ tenant_id: tenant.id, attendance_id: attendance.id, kind: "income", payment_method: attendance.payment_method, description: `${MARKER} Serviço realizado`, amount: Number(attendance.final_price), effective_date: attendance.created_at.slice(0, 10), settlement_status: "settled", cash_session_id: null }));
for (const group of chunk(cash)) { const { error } = await supabase.from("cash_entries").insert(group); fail("recebimentos", error); }
const expenses = []; for (let offset = 0; offset <= DAYS; offset += 3) { const date = dateAtOffset(offset); expenses.push({ tenant_id: tenant.id, kind: "expense", payment_method: "cash", description: `${MARKER} Insumos e despesas operacionais`, amount: 80 + ((offset * 13) % 160), effective_date: date, settlement_status: "settled", cash_session_id: null }); }
for (const group of chunk(expenses)) { const { error } = await supabase.from("cash_entries").insert(group); fail("saídas", error); }
console.log(JSON.stringify({ ok: true, tenant: tenant.name, customers: customers?.length ?? 0, vehicles: vehicles?.length ?? 0, attendances: createdAttendances.length, today: attendances.filter((item) => item.created_at.startsWith(TODAY)).length, incomeEntries: cash.length, expenseEntries: expenses.length, range: `${dateAtOffset(DAYS)} a ${TODAY}` }, null, 2));
