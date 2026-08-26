/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSessionToken } from "@/backend/auth/customer-session";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Entry token: TTL curto, uso único (consumed_at), finalidade explícita e vínculo
 * tenant + telefone + placa (registro server-side). O valor cru é retornado ao cliente;
 * apenas o hash é persistido. Leitura sem consumo + consumo atômico por id: senha errada
 * não queima o token.
 */
export async function createEntryToken(input: {
  tenantId: string;
  phoneNormalized: string;
  plateNormalized: string;
  ttlSeconds?: number;
}) {
  const token = createSessionToken();
  const ttl = input.ttlSeconds ?? 600;
  const admin = createSupabaseAdminClient() as any;

  const { data, error } = await admin
    .from("entry_tokens")
    .insert({
      tenant_id: input.tenantId,
      phone_normalized: input.phoneNormalized,
      plate_normalized: input.plateNormalized,
      purpose: "entry",
      token_hash: hashToken(token),
      expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) return null;
  return token;
}

/** Leitura sem consumo: token válido (não expirado, não consumido) para o tenant. */
export async function getEntryToken(input: { token: string; tenantId: string }) {
  const admin = createSupabaseAdminClient() as any;
  const { data, error } = await admin
    .from("entry_tokens")
    .select("id, tenant_id, phone_normalized, plate_normalized")
    .eq("token_hash", hashToken(input.token))
    .eq("tenant_id", input.tenantId)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;
  return data as { id: string; tenant_id: string; phone_normalized: string; plate_normalized: string };
}

/** Consumo atômico de uso único por id (após a ação ter sucesso). */
export async function consumeEntryTokenById(id: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data, error } = await admin
    .from("entry_tokens")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", id)
    .is("consumed_at", null)
    .select("id")
    .maybeSingle();

  if (error || !data) return false;
  return true;
}

export async function deleteExpiredEntryTokens() {
  const admin = createSupabaseAdminClient() as any;
  await admin.from("entry_tokens").delete().lt("expires_at", new Date(Date.now() - 3600_000).toISOString());
}
