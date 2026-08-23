/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function upsertTenantOwnerAdmin(input: {
  tenantId: string;
  userId: string;
}) {
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin.from("tenant_users").upsert(
    {
      tenant_id: input.tenantId,
      user_id: input.userId,
      role: "owner",
      is_active: true,
    },
    {
      onConflict: "tenant_id,user_id",
    },
  );

  return error as { message: string } | null;
}

export async function upsertTenantOperatorAdmin(input: {
  tenantId: string;
  userId: string;
}) {
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin.from("tenant_users").upsert(
    {
      tenant_id: input.tenantId,
      user_id: input.userId,
      role: "operator",
      is_active: true,
    },
    {
      onConflict: "tenant_id,user_id",
    },
  );

  return error as { message: string } | null;
}

export async function setTenantUserActiveStateAdmin(input: {
  tenantId: string;
  userId: string;
  isActive: boolean;
}) {
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin
    .from("tenant_users")
    .update({ is_active: input.isActive })
    .eq("tenant_id", input.tenantId)
    .eq("user_id", input.userId);

  return error as { message: string } | null;
}

export async function deleteTenantUserMembershipAdmin(input: {
  tenantId: string;
  userId: string;
}) {
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin
    .from("tenant_users")
    .delete()
    .eq("tenant_id", input.tenantId)
    .eq("user_id", input.userId);

  return error as { message: string } | null;
}
