/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function incrementRateLimit(tenantId: string, key: string, windowSeconds: number) {
  const admin = createSupabaseAdminClient() as any;
  const { data, error } = await admin.rpc("rate_limit_increment", {
    p_tenant_id: tenantId,
    p_key: key,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error("Falha ao registrar rate limit", { key, reason: error.message });
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return (row as { current_count?: number; reset_at?: string } | null) ?? null;
}
