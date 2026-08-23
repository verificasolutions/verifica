/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function findTenantBySlugForSetup(slug: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin.from("tenants").select("id").eq("slug", slug).maybeSingle();
  return data as { id: string } | null;
}

export async function createTenantForSetup(input: {
  name: string;
  slug: string;
  whatsapp: string | null;
  createdBy: string;
}) {
  const admin = createSupabaseAdminClient() as any;
  const { data, error } = await admin
    .from("tenants")
    .insert({
      name: input.name,
      slug: input.slug,
      whatsapp: input.whatsapp,
      created_by: input.createdBy,
    })
    .select("id")
    .single();
  return { data: data as { id: string } | null, error: error as { message: string } | null };
}

export async function attachOwnerMembershipForSetup(input: {
  tenantId: string;
  userId: string;
}) {
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin.from("tenant_users").insert({
    tenant_id: input.tenantId,
    user_id: input.userId,
    role: "owner",
    is_active: true,
  });
  return error as { message: string } | null;
}
