import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSaoPauloDayRange } from "@/backend/shared/date-range";

export async function listAttendancesForTodayByTenant(tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { start: dayStart, end: dayEnd } = getSaoPauloDayRange();

  const [{ data: todayData }, { data: activeData }, { data: todayWithServicesData }] = await Promise.all([
    supabase
      .from("attendances")
      .select("status, final_price, payment_method, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd),
    supabase
      .from("attendances")
      .select("status, final_price, payment_method, created_at")
      .eq("tenant_id", tenantId)
      .in("status", ["waiting", "washing", "finishing", "ready"]),
    supabase
      .from("attendances")
      .select("status, created_at, services(name)")
      .eq("tenant_id", tenantId)
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd),
  ]);

  return {
    today: todayData ?? [],
    active: activeData ?? [],
    todayWithServices: todayWithServicesData ?? [],
  };
}
