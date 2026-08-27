/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CustomerRegisterResult } from "@/backend/types";

function firstRow<T>(data: unknown): T | null {
  const value = Array.isArray(data) ? data[0] : data;
  return (value as T | null | undefined) ?? null;
}

/**
 * RPCs server-only (service_role) usadas pelo backend do portal. A superfície pública
 * (anon/authenticated) não tem acesso: customer_register valida/consome o entry token
 * server-side (tenant/telefone/placa vêm do registro, nunca do chamador).
 */

/**
 * Registro de cliente. Tenta o caminho ATÔMICO com veículo (migration externa
 * 20260909_portal_first_access_vehicle, se aplicada); se a função de 6 params não existir
 * (PGRST202 — remoto com a 3-param canônica de 20260908), cai para cliente+credencial e o
 * veículo é vinculado em seguida via customer_link_vehicle (mesma transação de sessão).
 */
export async function rpcCustomerRegister(input: { entryTokenHash: string; name: string; vehicleModel: string; vehicleType: string; vehicleColor: string; passwordHash: string }) {
  const admin = createSupabaseAdminClient() as any;

  const atomic = await admin.rpc("customer_register", {
    p_entry_token_hash: input.entryTokenHash,
    p_name: input.name,
    p_vehicle_model: input.vehicleModel,
    p_vehicle_type: input.vehicleType,
    p_vehicle_color: input.vehicleColor,
    p_password_hash: input.passwordHash,
  });

  if (atomic.error && (atomic.error as { code?: string; message?: string }).code === "PGRST202") {
    const basic = await admin.rpc("customer_register", {
      p_entry_token_hash: input.entryTokenHash,
      p_name: input.name,
      p_password_hash: input.passwordHash,
    });
    return {
      data: firstRow<CustomerRegisterResult>(basic.data),
      error: basic.error as { message: string } | null,
      vehicleIncluded: false,
    };
  }

  return {
    data: firstRow<CustomerRegisterResult>(atomic.data),
    error: atomic.error as { message: string } | null,
    vehicleIncluded: true,
  };
}

export async function recordCustomerPrivacyConsent(input: { customerId: string; tenantId: string; policyVersion: string; userAgent?: string | null }) {
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin.from("customer_privacy_consents").upsert({
    customer_id: input.customerId,
    tenant_id: input.tenantId,
    policy_version: input.policyVersion,
    consent_type: "privacy_notice",
    source: "customer_portal",
    user_agent: input.userAgent ?? null,
  }, { onConflict: "customer_id,consent_type,policy_version", ignoreDuplicates: true });
  return error as { message: string } | null;
}

/** Vincula veículo ao cliente logado (RPC canônica 20260906; válida o token de sessão). */
export async function rpcCustomerLinkVehicle(input: {
  tokenHash: string;
  plate: string;
  brand?: string | null;
  model: string;
  color: string;
  vehicleType: string;
  usageType?: string | null;
  sizeTier?: string | null;
  tierSource?: string | null;
  vehicleSource?: string | null;
}) {
  const admin = createSupabaseAdminClient() as any;
  const { data, error } = await admin.rpc("customer_link_vehicle", {
    p_token_hash: input.tokenHash,
    p_plate: input.plate,
    p_brand: input.brand ?? null,
    p_model: input.model,
    p_color: input.color,
    p_vehicle_type: input.vehicleType,
    p_usage_type: input.usageType ?? "particular",
    p_size_tier: input.sizeTier ?? null,
    p_tier_source: input.tierSource ?? null,
    p_vehicle_source: input.vehicleSource ?? "portal",
  });
  return { data: firstRow<{ id: string; plate: string }>(data), error: error as { message: string } | null };
}

/** Sessão + audit customer.login + consumo do entry token na mesma transação. */
export async function rpcCustomerSessionCreate(input: {
  tenantId: string;
  customerId: string;
  tokenHash: string;
  expiresAt: string;
  ip?: string | null;
  userAgent?: string | null;
  entryTokenId?: string | null;
}) {
  const admin = createSupabaseAdminClient() as any;
  const { data, error } = await admin.rpc("customer_session_create_log", {
    p_tenant_id: input.tenantId,
    p_customer_id: input.customerId,
    p_token_hash: input.tokenHash,
    p_expires_at: input.expiresAt,
    p_created_ip: input.ip ?? null,
    p_user_agent: input.userAgent ?? null,
    p_entry_token_id: input.entryTokenId ?? null,
  });
  return { data: firstRow<string>(data), error: error as { message: string } | null };
}

/** Logout + audit customer.session_revoked na mesma transação. */
export async function rpcCustomerSessionRevoke(tokenHash: string) {
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin.rpc("customer_session_revoke_log", { p_token_hash: tokenHash });
  return { error: error as { message: string } | null };
}

/** Draft + audit (order.draft.created / appointment.draft.created) na mesma transação. */
export async function rpcCustomerDraftCreate(input: {
  tenantId: string;
  customerId: string;
  vehicleId: string;
  kind: "order" | "appointment";
  serviceIds: string[];
  rewardId?: string | null;
  idempotencyKey: string;
  sessionTokenHash: string;
  expiresAt: string;
}) {
  const admin = createSupabaseAdminClient() as any;
  const { data, error } = await admin.rpc("customer_order_draft_create", {
    p_tenant_id: input.tenantId,
    p_customer_id: input.customerId,
    p_vehicle_id: input.vehicleId,
    p_kind: input.kind,
    p_service_ids: input.serviceIds,
    p_reward_id: input.rewardId ?? null,
    p_idempotency_key: input.idempotencyKey,
    p_session_token_hash: input.sessionTokenHash,
    p_expires_at: input.expiresAt,
  });
  return { data: firstRow<string>(data), error: error as { message: string } | null };
}
