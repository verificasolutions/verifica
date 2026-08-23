import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentPlatformAdminRecord(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("platform_admins")
    .select("role, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  return data as { role: "admin_master"; is_active: boolean } | null;
}
