/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { TenantOperationalProfile, TenantRecord } from "@/backend/types";

const tenantSelect = "id, name, slug, whatsapp, operational_profile, is_active, created_at, created_by";

export async function listRecentTenantsAdmin() {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("tenants")
    .select(tenantSelect)
    .order("created_at", { ascending: false })
    .limit(20);

  return (data ?? []) as TenantRecord[];
}

export async function countTenantsAdmin() {
  const admin = createSupabaseAdminClient() as any;
  const { count } = await admin.from("tenants").select("*", { count: "exact", head: true });
  return count ?? 0;
}

export async function countActiveTenantsAdmin() {
  const admin = createSupabaseAdminClient() as any;
  const { count } = await admin.from("tenants").select("*", { count: "exact", head: true }).eq("is_active", true);
  return count ?? 0;
}

export async function countOwnersAdmin() {
  const admin = createSupabaseAdminClient() as any;
  const { count } = await admin.from("tenant_users").select("*", { count: "exact", head: true }).eq("role", "owner");
  return count ?? 0;
}

export async function findTenantBySlugAdmin(slug: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin.from("tenants").select("id").eq("slug", slug).maybeSingle();
  return data as { id: string } | null;
}

export async function findTenantBySlugExcludingIdAdmin(slug: string, tenantId: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin.from("tenants").select("id").eq("slug", slug).neq("id", tenantId).maybeSingle();
  return data as { id: string } | null;
}

export async function getTenantByIdAdmin(tenantId: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("tenants")
    .select(tenantSelect)
    .eq("id", tenantId)
    .maybeSingle();

  return (data as TenantRecord | null) ?? null;
}

export async function createTenantAdmin(input: {
  name: string;
  slug: string;
  whatsapp: string | null;
  operationalProfile: TenantOperationalProfile;
  createdBy: string;
}) {
  const admin = createSupabaseAdminClient() as any;
  const { data, error } = await admin
    .from("tenants")
    .insert({
      name: input.name,
      slug: input.slug,
      whatsapp: input.whatsapp,
      operational_profile: input.operationalProfile,
      created_by: input.createdBy,
      is_active: true,
    })
    .select("id")
    .single();

  return { data: data as { id: string } | null, error: error as { message: string } | null };
}

export async function updateTenantStatusAdmin(tenantId: string, isActive: boolean) {
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin.from("tenants").update({ is_active: isActive }).eq("id", tenantId);
  return error as { message: string } | null;
}

export async function updateTenantAdmin(input: {
  tenantId: string;
  name: string;
  slug: string;
  whatsapp: string | null;
  operationalProfile: TenantOperationalProfile;
}) {
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin
    .from("tenants")
    .update({
      name: input.name,
      slug: input.slug,
      whatsapp: input.whatsapp,
      operational_profile: input.operationalProfile,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.tenantId);

  return error as { message: string } | null;
}
