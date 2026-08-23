import "server-only";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { getSaoPauloDayRange, getSaoPauloMonthStart, getSaoPauloWeekRange } from "@/backend/shared/date-range";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export async function getReportsUseCase() {
  const context = await requireOwnerOrManager();
  const supabase = await createSupabaseServerClient();
  const { start: todayStart, end: todayEnd } = getSaoPauloDayRange();
  const { start: weekStart } = getSaoPauloWeekRange();
  const monthStart = getSaoPauloMonthStart();

  const [{ data: today }, { data: week }, { data: month }] = await Promise.all([
    supabase.from("attendances").select("final_price, service_id, services(name)").eq("tenant_id", context.tenantId).gte("created_at", todayStart).lte("created_at", todayEnd),
    supabase.from("attendances").select("final_price").eq("tenant_id", context.tenantId).gte("created_at", weekStart),
    supabase.from("attendances").select("final_price").eq("tenant_id", context.tenantId).gte("created_at", monthStart),
  ]);

  const todayRows = today ?? [];
  const todayRevenue = todayRows.reduce((sum, row) => sum + Number(row.final_price ?? 0), 0);
  const ticket = todayRows.length ? todayRevenue / todayRows.length : 0;
  const serviceCount = new Map<string, number>();
  for (const row of todayRows as Array<{ services?: { name: string }[] | { name: string } | null }>) {
    const serviceName = Array.isArray(row.services) ? row.services[0]?.name : row.services?.name;
    if (serviceName) serviceCount.set(serviceName, (serviceCount.get(serviceName) ?? 0) + 1);
  }
  const topService = [...serviceCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Sem dados";

  return {
    today: {
      washes: todayRows.length,
      revenue: formatCurrency(todayRevenue),
      ticket: formatCurrency(ticket),
      topService,
    },
    weekRevenue: formatCurrency((week ?? []).reduce((sum, row) => sum + Number(row.final_price ?? 0), 0)),
    monthRevenue: formatCurrency((month ?? []).reduce((sum, row) => sum + Number(row.final_price ?? 0), 0)),
  };
}
