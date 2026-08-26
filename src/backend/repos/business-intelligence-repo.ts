import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type IntelligencePeriod = "today" | "7d" | "14d" | "30d" | "month" | "previous_month" | "3m";
export type IntelligenceRow = {
  id: string;
  customer_id: string | null;
  service_id: string | null;
  employee_id: string | null;
  vehicle_id: string | null;
  status: string;
  final_price: number | string;
  payment_method: string | null;
  created_at: string;
  started_at: string | null;
  ready_at: string | null;
  services?: { name: string } | { name: string }[] | null;
  employees?: { name: string } | { name: string }[] | null;
  vehicles?: { vehicle_type: string | null } | { vehicle_type: string | null }[] | null;
};
export type IntelligenceCashRow = { id: string; kind: "income" | "expense"; description: string; amount: number | string; payment_method: string | null; effective_date: string | null; created_at: string };
export type IntelligenceCustomerRow = { id: string; name: string; created_at: string };

export async function listBusinessIntelligenceRows(tenantId: string, start: string, end: string) {
  const supabase = await createSupabaseServerClient();
  const [attendances, cash, customers] = await Promise.all([
    supabase.from("attendances").select("id, customer_id, service_id, employee_id, vehicle_id, status, final_price, payment_method, created_at, started_at, ready_at, services(name), employees(name), vehicles(vehicle_type)").eq("tenant_id", tenantId).gte("created_at", `${start}T00:00:00.000Z`).lte("created_at", `${end}T23:59:59.999Z`).order("created_at", { ascending: true }),
    supabase.from("cash_entries").select("id, kind, description, amount, payment_method, effective_date, created_at").eq("tenant_id", tenantId).gte("effective_date", start).lte("effective_date", end).order("created_at", { ascending: true }),
    supabase.from("customers").select("id, name, created_at").eq("tenant_id", tenantId).eq("is_active", true).order("created_at", { ascending: true }),
  ]);
  return { attendances: (attendances.data ?? []) as IntelligenceRow[], cash: (cash.data ?? []) as IntelligenceCashRow[], customers: (customers.data ?? []) as IntelligenceCustomerRow[] };
}
