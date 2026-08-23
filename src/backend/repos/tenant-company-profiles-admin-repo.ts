/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { TenantCompanyProfileRecord } from "@/backend/types";

export async function upsertTenantCompanyProfileAdmin(input: TenantCompanyProfileRecord) {
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin.from("tenant_company_profiles").upsert(input);
  return error as { message: string } | null;
}

export async function listTenantCompanyProfilesAdmin() {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin.from("tenant_company_profiles").select("*");
  return ((data ?? []) as TenantCompanyProfileRecord[]);
}

export async function getTenantCompanyProfileAdmin(tenantId: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin.from("tenant_company_profiles").select("*").eq("tenant_id", tenantId).maybeSingle();
  return (data as TenantCompanyProfileRecord | null) ?? null;
}
