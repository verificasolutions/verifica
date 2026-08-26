/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Resolução de tenant público por slug (identidade; mesmo padrão de public-tenant-site-repo). */
export async function findActiveTenantBySlug(slug: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("tenants")
    .select("id, name, slug, is_active")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  return (data as { id: string; name: string; slug: string; is_active: boolean } | null) ?? null;
}
