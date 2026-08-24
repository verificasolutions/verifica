import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TenantSettingsRecord } from "@/backend/types";

const tenantSettingsSelect = `
  tenant_id, default_service_minutes, customer_messages_enabled, queue_entry_message,
  queue_entry_message_enabled, wash_start_message, wash_start_message_enabled,
  finishing_message, finishing_message_enabled, ready_message, ready_message_enabled,
  return_reminder_message, return_reminder_enabled,
  return_reminder_days, return_reminder_time, evolution_base_url, evolution_instance,
  whatsapp_pairing_token,
  evolution_api_key, evolution_enabled, operator_can_edit_status,
  operator_can_view_all_cars, operator_can_view_customer_phone, operator_inventory_enabled,
  operations_mode, operation_flow_locked, tv_mode_enabled, require_ready_photo, allow_step_photos,
  landing_enabled,
  instagram_enabled, instagram_auto_publish_enabled, instagram_default_publish_mode,
  logout_before, vehicle_type_tier_overrides
`;

export async function getTenantSettings(tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("tenant_settings")
    .select(tenantSettingsSelect)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  return (data as TenantSettingsRecord | null) ?? null;
}

export async function getTenantSettingsAdmin(tenantId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await (admin.from("tenant_settings") as any)
    .select(tenantSettingsSelect)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  return (data as TenantSettingsRecord | null) ?? null;
}

export async function upsertTenantSettings(input: TenantSettingsRecord) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("tenant_settings").upsert(input);
  return error as { message: string } | null;
}
