/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CustomerCredentialRecord, CustomerRecord } from "@/backend/types";

type CustomerLookupRow = Pick<
  CustomerRecord,
  "id" | "tenant_id" | "name" | "whatsapp" | "phone_normalized" | "is_active"
>;

const CUSTOMER_PHONE_FIELDS = "contact_phone_1, contact_phone_2";

function phoneMatches(row: Record<string, unknown>, phoneNormalized: string) {
  return [row.phone_normalized, row.whatsapp, row.contact_phone_1, row.contact_phone_2].some(
    (value) => typeof value === "string" && value.replace(/\\D/g, "").replace(/^55/, "") === phoneNormalized,
  );
}

/**
 * Repositório de credenciais/sessão do cliente. Escrita/leitura server-side via admin client:
 * o login ocorre antes de existir sessão (o cliente ainda é anônimo no Supabase) e a senha
 * nunca trafega fora do servidor. Dados de cliente continuam protegidos por RLS para o app.
 */
export async function findCustomerByPhoneNormalized(tenantId: string, phoneNormalized: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data: directMatches } = await admin
    .from("customers")
    .select(`id, tenant_id, name, whatsapp, phone_normalized, is_active, ${CUSTOMER_PHONE_FIELDS}`)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .or(`phone_normalized.eq.${phoneNormalized},whatsapp.eq.${phoneNormalized},contact_phone_1.eq.${phoneNormalized},contact_phone_2.eq.${phoneNormalized}`)
    .limit(1);

  const direct = (directMatches?.[0] ?? null) as CustomerLookupRow | null;
  if (direct) return direct;

  const { data: fallbackMatches } = await admin
    .from("customers")
    .select(`id, tenant_id, name, whatsapp, phone_normalized, is_active, ${CUSTOMER_PHONE_FIELDS}`)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .limit(1000);

  const fallback = (fallbackMatches ?? []).find((row: Record<string, unknown>) => phoneMatches(row, phoneNormalized));

  return (fallback as CustomerLookupRow | undefined) ?? null;
}

export async function findCustomerByPhoneAndPlate(tenantId: string, phoneNormalized: string, plate: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data: directMatches } = await admin
    .from("customers")
    .select(`id, tenant_id, name, whatsapp, phone_normalized, is_active, ${CUSTOMER_PHONE_FIELDS}, vehicles!inner(plate)`)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .eq("vehicles.tenant_id", tenantId)
    .eq("vehicles.plate", plate)
    .eq("vehicles.is_active", true)
    .or(`phone_normalized.eq.${phoneNormalized},whatsapp.eq.${phoneNormalized},contact_phone_1.eq.${phoneNormalized},contact_phone_2.eq.${phoneNormalized}`)
    .limit(1);

  const data = directMatches?.[0] ?? null;

  if (data) {
    const customer = { ...data } as CustomerLookupRow & { vehicles?: unknown };
    delete customer.vehicles;
    return customer;
  }

  const { data: fallbackCustomers } = await admin
    .from("customers")
    .select(`id, tenant_id, name, whatsapp, phone_normalized, is_active, ${CUSTOMER_PHONE_FIELDS}`)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .limit(1000);

  const matchingCustomerIds = (fallbackCustomers ?? [])
    .filter((row: Record<string, unknown>) => phoneMatches(row, phoneNormalized))
    .map((row: Record<string, unknown>) => row.id)
    .filter((id: unknown): id is string => typeof id === "string");

  if (matchingCustomerIds.length === 0) return null;

  const { data: matchingVehicles } = await admin
    .from("vehicles")
    .select("customer_id")
    .eq("tenant_id", tenantId)
    .eq("plate", plate)
    .eq("is_active", true)
    .in("customer_id", matchingCustomerIds)
    .limit(1);

  const customerId = matchingVehicles?.[0]?.customer_id;
  const matchingCustomer = (fallbackCustomers ?? []).find((row: Record<string, unknown>) => row.id === customerId);

  return (matchingCustomer as CustomerLookupRow | undefined) ?? null;
}

export async function getCustomerCredential(customerId: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("customer_credentials")
    .select("customer_id, tenant_id, password_hash, failed_attempts, locked_until, password_changed_at, created_at, updated_at")
    .eq("customer_id", customerId)
    .maybeSingle();

  return (data as CustomerCredentialRecord | null) ?? null;
}

export async function upsertCustomerCredential(input: { customerId: string; tenantId: string; passwordHash: string }) {
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin.from("customer_credentials").upsert(
    {
      customer_id: input.customerId,
      tenant_id: input.tenantId,
      password_hash: input.passwordHash,
      failed_attempts: 0,
      locked_until: null,
      password_changed_at: new Date().toISOString(),
    },
    { onConflict: "customer_id" },
  );

  return error as { message: string } | null;
}

export async function resetCustomerFailedAttempts(customerId: string) {
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin
    .from("customer_credentials")
    .update({ failed_attempts: 0, locked_until: null })
    .eq("customer_id", customerId);

  return error as { message: string } | null;
}

export async function recordCustomerFailedLogin(customerId: string, maxAttempts: number, lockMinutes: number) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("customer_credentials")
    .select("failed_attempts")
    .eq("customer_id", customerId)
    .maybeSingle();

  const next = (data?.failed_attempts ?? 0) + 1;
  const lockedUntil = next >= maxAttempts ? new Date(Date.now() + lockMinutes * 60 * 1000).toISOString() : null;

  const { error } = await admin
    .from("customer_credentials")
    .update({ failed_attempts: next, locked_until: lockedUntil })
    .eq("customer_id", customerId);

  return { failedAttempts: next, lockedUntil, error: error as { message: string } | null };
}
