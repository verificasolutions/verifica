import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MembershipRecord } from "@/backend/types";

export async function getCurrentMembershipRecord(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("tenant_users")
    .select("tenant_id, role, tenants(id, name, slug, whatsapp, operational_profile, is_active, created_at, created_by)")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  return (data as MembershipRecord | null) ?? null;
}
