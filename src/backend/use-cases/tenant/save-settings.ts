import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { getTenantSettings, upsertTenantSettings } from "@/backend/repos/tenant-settings-repo";
import { buildDashboardRedirectTarget } from "@/backend/shared/dashboard-redirect";
import { readCheckboxValue } from "@/backend/shared/tenant-whatsapp-messages";

export async function saveTenantSettingsUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const current = await getTenantSettings(context.tenantId);
  const reminderDaysValue = Number(String(formData.get("return_reminder_days") ?? current?.return_reminder_days ?? 30));
  const defaultMinutesText = String(formData.get("default_service_minutes") ?? "").trim();
  const defaultMinutesValue = defaultMinutesText ? Number(defaultMinutesText) : Number.NaN;
  const messagingUnlocked = current?.customer_messages_enabled ?? false;
  const fallbackTarget = "/app/dashboard?section=adm&panel=settings";
  const vehicleTypeCodes = ["hatch", "sedan", "wagon", "pickup_small", "suv", "pickup_large", "van", "micro_bus", "truck", "bus"] as const;
  const vehicle_type_tier_overrides = Object.fromEntries(
    vehicleTypeCodes.map((code) => [code, String(formData.get(`vehicle_tier_${code}`) ?? current?.vehicle_type_tier_overrides?.[code] ?? "passeio")]),
  );

  const error = await upsertTenantSettings({
    tenant_id: context.tenantId,
    default_service_minutes: Number.isFinite(defaultMinutesValue) && defaultMinutesValue > 0 ? defaultMinutesValue : null,
    customer_messages_enabled: current?.customer_messages_enabled ?? false,
    queue_entry_message: String(formData.get("queue_entry_message") ?? current?.queue_entry_message ?? "").trim() || null,
    queue_entry_message_enabled: messagingUnlocked ? readCheckboxValue(formData, "queue_entry_message_enabled") : current?.queue_entry_message_enabled ?? true,
    wash_start_message: String(formData.get("wash_start_message") ?? current?.wash_start_message ?? "").trim() || null,
    wash_start_message_enabled: messagingUnlocked ? readCheckboxValue(formData, "wash_start_message_enabled") : current?.wash_start_message_enabled ?? false,
    finishing_message: String(formData.get("finishing_message") ?? current?.finishing_message ?? "").trim() || null,
    finishing_message_enabled: messagingUnlocked ? readCheckboxValue(formData, "finishing_message_enabled") : current?.finishing_message_enabled ?? false,
    ready_message: String(formData.get("ready_message") ?? current?.ready_message ?? "").trim() || null,
    ready_message_enabled: messagingUnlocked ? readCheckboxValue(formData, "ready_message_enabled") : current?.ready_message_enabled ?? true,
    return_reminder_message: String(formData.get("return_reminder_message") ?? current?.return_reminder_message ?? "").trim() || null,
    return_reminder_enabled: messagingUnlocked ? readCheckboxValue(formData, "return_reminder_enabled") : current?.return_reminder_enabled ?? false,
    return_reminder_days: messagingUnlocked && Number.isFinite(reminderDaysValue) && reminderDaysValue > 0 ? reminderDaysValue : current?.return_reminder_days ?? 30,
    return_reminder_time: messagingUnlocked
      ? String(formData.get("return_reminder_time") ?? current?.return_reminder_time ?? "").trim() || "09:00"
      : current?.return_reminder_time ?? "09:00",
    whatsapp_pairing_token: current?.whatsapp_pairing_token ?? crypto.randomUUID(),
    evolution_base_url: current?.evolution_base_url ?? null,
    evolution_instance: current?.evolution_instance ?? null,
    evolution_api_key: current?.evolution_api_key ?? null,
    evolution_enabled: current?.evolution_enabled ?? false,
    operator_can_edit_status: readCheckboxValue(formData, "operator_can_edit_status"),
    operator_can_view_all_cars: readCheckboxValue(formData, "operator_can_view_all_cars"),
    operator_can_view_customer_phone: readCheckboxValue(formData, "operator_can_view_customer_phone"),
    operator_inventory_enabled: readCheckboxValue(formData, "operator_inventory_enabled"),
    operations_mode: String(formData.get("operations_mode") ?? current?.operations_mode ?? "boxes") === "boxes" ? "boxes" : "classic",
    operation_flow_locked: readCheckboxValue(formData, "operation_flow_locked"),
    tv_mode_enabled: readCheckboxValue(formData, "tv_mode_enabled"),
    require_ready_photo: readCheckboxValue(formData, "require_ready_photo"),
    allow_step_photos: readCheckboxValue(formData, "allow_step_photos"),
    landing_enabled: current?.landing_enabled ?? false,
    instagram_enabled: current?.instagram_enabled ?? false,
    instagram_auto_publish_enabled: current?.instagram_auto_publish_enabled ?? false,
    instagram_default_publish_mode: current?.instagram_default_publish_mode ?? "manual",
    logout_before: current?.logout_before ?? null,
    vehicle_type_tier_overrides,
  });

  if (error) {
    redirect(buildDashboardRedirectTarget(formData, fallbackTarget, "error", error.message));
  }
}
