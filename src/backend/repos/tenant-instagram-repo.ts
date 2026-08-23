import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TenantInstagramAccountRecord } from "@/backend/types";

const tenantInstagramSelect = `
  id, tenant_id, instagram_account_id, facebook_page_id, account_name,
  access_token, refresh_token, token_expires_at, is_active, last_sync_at,
  connected_by, created_at, updated_at
`;

export async function getActiveTenantInstagramAccount(tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("tenant_instagram_accounts")
    .select(tenantInstagramSelect)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .maybeSingle();

  return (data as TenantInstagramAccountRecord | null) ?? null;
}

export async function saveTenantInstagramConnection(input: {
  tenantId: string;
  instagramAccountId: string;
  facebookPageId: string | null;
  accountName: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
  connectedBy: string | null;
}) {
  const supabase = await createSupabaseServerClient();

  await supabase
    .from("tenant_instagram_accounts")
    .update({ is_active: false })
    .eq("tenant_id", input.tenantId)
    .eq("is_active", true);

  const { data, error } = await supabase
    .from("tenant_instagram_accounts")
    .insert({
      tenant_id: input.tenantId,
      instagram_account_id: input.instagramAccountId,
      facebook_page_id: input.facebookPageId,
      account_name: input.accountName,
      access_token: input.accessToken,
      refresh_token: input.refreshToken,
      token_expires_at: input.tokenExpiresAt,
      is_active: true,
      last_sync_at: new Date().toISOString(),
      connected_by: input.connectedBy,
    })
    .select(tenantInstagramSelect)
    .single();

  return {
    data: (data as TenantInstagramAccountRecord | null) ?? null,
    error: error as { message: string } | null,
  };
}

export async function updateTenantInstagramToken(input: {
  tenantId: string;
  accountId: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("tenant_instagram_accounts")
    .update({
      access_token: input.accessToken,
      refresh_token: input.refreshToken,
      token_expires_at: input.tokenExpiresAt,
      last_sync_at: new Date().toISOString(),
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.accountId);

  return error as { message: string } | null;
}

export async function disconnectTenantInstagramAccount(tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("tenant_instagram_accounts")
    .update({ is_active: false })
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  return error as { message: string } | null;
}
