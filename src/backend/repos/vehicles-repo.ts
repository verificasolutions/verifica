import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { VehicleRecord } from "@/backend/types";

export async function findVehicleByPlate(tenantId: string, plate: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("vehicles")
    .select("id, tenant_id, customer_id, plate, brand, model, color, vehicle_type, is_active")
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
    .select("id, tenant_id, customer_id, plate, brand, model, color, vehicle_type, is_active")
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
      is_active: true,
    })
    .select("id, tenant_id, customer_id, plate, brand, model, color, vehicle_type, is_active")
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
}) {
  const supabase = await createSupabaseServerClient();
  const patch: Record<string, string | null> = {};

  if (input.customerId !== undefined) patch.customer_id = input.customerId;
  if (input.brand !== undefined) patch.brand = input.brand;
  if (input.model !== undefined) patch.model = input.model;
  if (input.color !== undefined) patch.color = input.color;
  if (input.vehicleType !== undefined) patch.vehicle_type = input.vehicleType;

  const { data, error } = await supabase
    .from("vehicles")
    .update(patch)
    .eq("tenant_id", input.tenantId)
    .eq("id", input.vehicleId)
    .select("id, tenant_id, customer_id, plate, brand, model, color, vehicle_type, is_active")
    .single();

  return { data: (data as VehicleRecord | null) ?? null, error: error as { message: string } | null };
}
