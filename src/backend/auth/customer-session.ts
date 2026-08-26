/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCustomerSessionTtlHours } from "@/lib/env";

export const CUSTOMER_SESSION_COOKIE = "vw_customer_session";

export function getSessionTtlHours() {
  return getCustomerSessionTtlHours();
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export type CustomerSessionIdentity = {
  sessionId: string;
  customerId: string;
  tenantId: string;
  name: string | null;
  phoneNormalized: string | null;
  tenantSlug: string | null;
  expiresAt: string;
};

type SessionRow = {
  id: string;
  customer_id: string;
  tenant_id: string;
  expires_at: string;
  customers: { name: string | null; phone_normalized: string | null } | null;
  tenants: { slug: string | null } | null;
};

export async function createCustomerSession(input: {
  tenantId: string;
  customerId: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<{ token: string; sessionId: string; expiresAt: string }> {
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const ttlHours = getSessionTtlHours();
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
  const admin = createSupabaseAdminClient() as any;

  const { data, error } = await admin
    .from("customer_sessions")
    .insert({
      customer_id: input.customerId,
      tenant_id: input.tenantId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_ip: input.ip ?? null,
      user_agent: input.userAgent ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Falha ao criar sessão: ${error?.message ?? "desconhecido"}`);
  }

  return { token, sessionId: data.id, expiresAt };
}

export async function validateCustomerSession(token: string | null | undefined): Promise<CustomerSessionIdentity | null> {
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const admin = createSupabaseAdminClient() as any;
  const ttlHours = getSessionTtlHours();

  const { data } = await admin
    .from("customer_sessions")
    .select(`
      id, customer_id, tenant_id, expires_at,
      customers(name, phone_normalized),
      tenants(slug)
    `)
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!data) return null;

  const row = data as SessionRow;
  const identity: CustomerSessionIdentity = {
    sessionId: row.id,
    customerId: row.customer_id,
    tenantId: row.tenant_id,
    name: row.customers?.name ?? null,
    phoneNormalized: row.customers?.phone_normalized ?? null,
    tenantSlug: row.tenants?.slug ?? null,
    expiresAt: row.expires_at,
  };

  // Renovação deslizante: estende quando falta menos de 50% do TTL.
  const remainingMs = new Date(row.expires_at).getTime() - Date.now();
  const extend = remainingMs < (ttlHours * 60 * 60 * 1000) / 2;
  const patch: Record<string, string> = { last_seen_at: new Date().toISOString() };
  if (extend) patch.expires_at = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();

  await admin.from("customer_sessions").update(patch).eq("id", row.id);

  return identity;
}

export async function revokeCustomerSession(token: string | null | undefined): Promise<void> {
  if (!token) return;
  const tokenHash = hashSessionToken(token);
  const admin = createSupabaseAdminClient() as any;
  await admin
    .from("customer_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", tokenHash)
    .is("revoked_at", null);
}

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function getCustomerSessionTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value ?? null;
}

export async function setCustomerSessionCookie(token: string, expiresAt: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CUSTOMER_SESSION_COOKIE, token, { ...cookieOptions, expires: new Date(expiresAt) });
}

export async function clearCustomerSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(CUSTOMER_SESSION_COOKIE);
}
