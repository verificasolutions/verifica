import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getOpenCashSessionByTenant(tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("cash_sessions")
    .select("status, opened_at")
    .eq("tenant_id", tenantId)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1);

  return data?.[0] ?? null;
}
