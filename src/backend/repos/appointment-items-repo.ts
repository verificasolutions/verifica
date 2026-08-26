import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppointmentItemRecord } from "@/backend/types";

export async function createAppointmentItemsForTenant(input: {
  tenantId: string;
  appointmentId: string;
  items: Array<{
    serviceId: string | null;
    name: string;
    unitPrice: number;
    estimatedMinutes: number | null;
    isPrimary: boolean;
  }>;
}) {
  const supabase = await createSupabaseServerClient();
  const payload = input.items.map((item, index) => ({
    tenant_id: input.tenantId,
    appointment_id: input.appointmentId,
    service_id: item.serviceId,
    name: item.name,
    unit_price: item.unitPrice,
    estimated_minutes: item.estimatedMinutes,
    sort_order: index + 1,
    is_primary: item.isPrimary,
  }));

  const { data, error } = await supabase
    .from("appointment_items")
    .insert(payload)
    .select("id, tenant_id, appointment_id, service_id, name, unit_price, estimated_minutes, sort_order, is_primary, created_at");

  return {
    data: (data ?? []) as AppointmentItemRecord[],
    error: error as { message: string } | null,
  };
}
