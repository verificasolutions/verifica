import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { VehicleRecord } from "@/backend/types";

export async function findVehicleByPlate(tenantId: string, plate: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("vehicles")
    .select("id, tenant_id, customer_id, plate, brand, model, color, vehicle_type, usage_type, size_tier, tier_source, vehicle_source, confirmed_at, last_vehicle_data_at, is_active")
    .eq("tenant_id", tenantId)
    .eq("plate", plate)
    .eq("is_active", true)
    .maybeSingle();

  return (data as VehicleRecord | null) ?? null;
}

export async function listActiveVehiclesByCustomer(tenantId: string, customerId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("vehicles")
    .select("id, tenant_id, customer_id, plate, brand, model, color, vehicle_type, usage_type, size_tier, tier_source, vehicle_source, confirmed_at, last_vehicle_data_at, is_active")
    .eq("tenant_id", tenantId)
    .eq("customer_id", customerId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  return (data ?? []) as VehicleRecord[];
}

export async function createVehicleForTenant(input: {
  tenantId: string;
  customerId: string;
  plate: string;
  brand: string | null;
  model: string;
  color: string | null;
  vehicleType?: string | null;
  usageType?: VehicleRecord["usage_type"];
  sizeTier?: VehicleRecord["size_tier"];
  tierSource?: VehicleRecord["tier_source"];
  vehicleSource?: VehicleRecord["vehicle_source"];
  confirmedAt?: string | null;
  lastVehicleDataAt?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("vehicles")
    .insert({
      tenant_id: input.tenantId,
      customer_id: input.customerId,
      plate: input.plate,
      brand: input.brand,
      model: input.model,
      color: input.color,
      vehicle_type: input.vehicleType ?? null,
      usage_type: input.usageType ?? "particular",
      size_tier: input.sizeTier ?? null,
      tier_source: input.tierSource ?? null,
      vehicle_source: input.vehicleSource ?? "operator",
      confirmed_at: input.confirmedAt ?? null,
      last_vehicle_data_at: input.lastVehicleDataAt ?? null,
      is_active: true,
    })
    .select("id, tenant_id, customer_id, plate, brand, model, color, vehicle_type, usage_type, size_tier, tier_source, vehicle_source, confirmed_at, last_vehicle_data_at, is_active")
    .single();

  return { data: (data as VehicleRecord | null) ?? null, error: error as { message: string } | null };
}

export async function updateVehicleForTenant(input: {
  tenantId: string;
  vehicleId: string;
  customerId?: string;
  brand?: string | null;
  model?: string;
  color?: string | null;
  vehicleType?: string | null;
  usageType?: VehicleRecord["usage_type"];
  sizeTier?: VehicleRecord["size_tier"];
  tierSource?: VehicleRecord["tier_source"];
  vehicleSource?: VehicleRecord["vehicle_source"];
  confirmedAt?: string | null;
  lastVehicleDataAt?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const patch: Record<string, string | null> = {};

  if (input.customerId !== undefined) patch.customer_id = input.customerId;
  if (input.brand !== undefined) patch.brand = input.brand;
  if (input.model !== undefined) patch.model = input.model;
  if (input.color !== undefined) patch.color = input.color;
  if (input.vehicleType !== undefined) patch.vehicle_type = input.vehicleType;
  if (input.usageType !== undefined) patch.usage_type = input.usageType;
  if (input.sizeTier !== undefined) patch.size_tier = input.sizeTier;
  if (input.tierSource !== undefined) patch.tier_source = input.tierSource;
  if (input.vehicleSource !== undefined) patch.vehicle_source = input.vehicleSource;
  if (input.confirmedAt !== undefined) patch.confirmed_at = input.confirmedAt;
  if (input.lastVehicleDataAt !== undefined) patch.last_vehicle_data_at = input.lastVehicleDataAt;

  const { data, error } = await supabase
    .from("vehicles")
    .update(patch)
    .eq("tenant_id", input.tenantId)
    .eq("id", input.vehicleId)
    .select("id, tenant_id, customer_id, plate, brand, model, color, vehicle_type, usage_type, size_tier, tier_source, vehicle_source, confirmed_at, last_vehicle_data_at, is_active")
    .single();

  return { data: (data as VehicleRecord | null) ?? null, error: error as { message: string } | null };
}
