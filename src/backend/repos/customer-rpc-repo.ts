import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hashSessionToken } from "@/backend/auth/customer-session";
import type {
  CustomerCatalogService,
  CustomerLoyaltySummary,
  CustomerOrderSummary,
  VehicleRecord,
} from "@/backend/types";

function firstRow<T>(data: unknown): T | null {
  const value = Array.isArray(data) ? data[0] : data;
  return (value as T | null | undefined) ?? null;
}

// As RPCs públicas do portal validam p_token_hash contra o HASH armazenado
// (customer_sessions.token_hash). O token cru vem do cookie; hashear aqui é o contrato.
function hashOf(token: string) {
  return hashSessionToken(token);
}

export async function rpcCustomerListVehicles(token: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("customer_list_vehicles", { p_token_hash: hashOf(token) });
  return { data: (data ?? []) as VehicleRecord[], error: error as { message: string } | null };
}

export async function rpcCustomerLinkVehicle(input: {
  token: string;
  plate: string;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  vehicleType?: string | null;
  usageType?: string | null;
  sizeTier?: string | null;
  tierSource?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("customer_link_vehicle", {
    p_token_hash: hashOf(input.token),
    p_plate: input.plate,
    p_brand: input.brand ?? null,
    p_model: input.model ?? null,
    p_color: input.color ?? null,
    p_vehicle_type: input.vehicleType ?? null,
    p_usage_type: input.usageType ?? "particular",
    p_size_tier: input.sizeTier ?? null,
    p_tier_source: input.tierSource ?? null,
    p_vehicle_source: "portal",
  });
  return { data: firstRow<VehicleRecord>(data), error: error as { message: string } | null };
}

export async function rpcCustomerUnlinkVehicle(input: { token: string; vehicleId: string }) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("customer_unlink_vehicle", {
    p_token_hash: hashOf(input.token),
    p_vehicle_id: input.vehicleId,
  });
  return { error: error as { message: string } | null };
}

export async function rpcCustomerListServices(token: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("customer_list_services", { p_token_hash: hashOf(token) });
  return { data: (data ?? []) as CustomerCatalogService[], error: error as { message: string } | null };
}

export async function rpcCustomerLoyaltySummary(input: { token: string; vehicleId: string }) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("customer_loyalty_summary", {
    p_token_hash: hashOf(input.token),
    p_vehicle_id: input.vehicleId,
  });
  return { data: firstRow<CustomerLoyaltySummary>(data), error: error as { message: string } | null };
}

export async function rpcCustomerOrders(input: { token: string; vehicleId: string }) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("customer_orders", {
    p_token_hash: hashOf(input.token),
    p_vehicle_id: input.vehicleId,
  });
  return { data: (data ?? []) as CustomerOrderSummary[], error: error as { message: string } | null };
}

export async function rpcCustomerConfirmOrder(input: {
  token: string;
  vehicleId: string;
  serviceIds: string[];
  idempotencyKey: string;
  rewardId?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("customer_confirm_order", {
    p_token_hash: hashOf(input.token),
    p_vehicle_id: input.vehicleId,
    p_service_ids: input.serviceIds,
    p_idempotency_key: input.idempotencyKey,
    p_reward_id: input.rewardId ?? null,
  });
  return { data: firstRow<Record<string, unknown>>(data), error: error as { message: string } | null };
}

export async function rpcCustomerConfirmAppointment(input: {
  token: string;
  vehicleId: string;
  serviceIds: string[];
  scheduledFor: string;
  idempotencyKey: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("customer_confirm_appointment", {
    p_token_hash: hashOf(input.token),
    p_vehicle_id: input.vehicleId,
    p_service_ids: input.serviceIds,
    p_scheduled_for: input.scheduledFor,
    p_idempotency_key: input.idempotencyKey,
  });
  return { data: firstRow<Record<string, unknown>>(data), error: error as { message: string } | null };
}
