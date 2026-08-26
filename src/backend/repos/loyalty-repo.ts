import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { LoyaltyEntryRecord, LoyaltyProgramRecord, LoyaltyRewardRecord } from "@/backend/types";

export async function getActiveLoyaltyProgram(tenantId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("loyalty_programs")
    .select("id, tenant_id, name, washes_required, reward_type, eligibility_rule, is_active, created_by, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  return (data as LoyaltyProgramRecord | null) ?? null;
}

export async function listLoyaltyEntriesByVehicle(tenantId: string, vehicleId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("loyalty_entries")
    .select("id, tenant_id, customer_id, vehicle_id, attendance_id, kind, wash_number, cycle_started_at, event_date, source, actor_customer_id, actor_user_id, reversal_reason, idempotency_key, created_at")
    .eq("tenant_id", tenantId)
    .eq("vehicle_id", vehicleId)
    .order("event_date", { ascending: false })
    .order("created_at", { ascending: false });

  return ((data ?? []) as LoyaltyEntryRecord[]);
}

export async function listRewardsByVehicle(tenantId: string, vehicleId: string, statuses?: LoyaltyRewardRecord["status"][]) {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("loyalty_rewards")
    .select("id, tenant_id, customer_id, vehicle_id, entry_id, status, used_attendance_id, used_at, reverted_at, canceled_at, cancel_reason, expires_at, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .eq("vehicle_id", vehicleId)
    .order("created_at", { ascending: false });

  if (statuses && statuses.length > 0) {
    query = query.in("status", statuses);
  }

  const { data } = await query;
  return ((data ?? []) as LoyaltyRewardRecord[]);
}
