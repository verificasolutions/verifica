import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProfileRecord } from "@/backend/types";

export async function getCurrentProfile(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("profiles").select("id, full_name, phone").eq("id", userId).maybeSingle();
  return (data as ProfileRecord | null) ?? null;
}
