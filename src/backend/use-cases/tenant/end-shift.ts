import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { getOpenCashSession, listCashEntriesForOpenDay, closeCashSessionForTenant } from "@/backend/repos/cash-repo";
import { closeAllEmployeeWorkSessionsByTenant } from "@/backend/repos/employee-work-sessions-repo";
import { getTenantSettings, upsertTenantSettings } from "@/backend/repos/tenant-settings-repo";

export async function endShiftUseCase() {
  const context = await requireOwnerOrManager();
  const openSession = await getOpenCashSession(context.tenantId);

  if (openSession) {
    const entries = await listCashEntriesForOpenDay(context.tenantId);
    const cashBalance = entries.reduce((sum, item) => {
      if (item.payment_method !== "cash") return sum;
      return item.kind === "expense" ? sum - item.amount : sum + item.amount;
    }, Number(openSession.opening_balance ?? 0));

    const closeError = await closeCashSessionForTenant({
      tenantId: context.tenantId,
      cashSessionId: openSession.id,
      closedBy: context.userId,
      closingBalance: cashBalance,
    });

    if (closeError) {
      redirect(`/app/dashboard?error=${encodeURIComponent(closeError.message)}`);
    }
  }

  const currentSettings = await getTenantSettings(context.tenantId);
  const logoutBefore = new Date().toISOString();
  const settingsError = await upsertTenantSettings({
    tenant_id: context.tenantId,
    default_service_minutes: currentSettings?.default_service_minutes ?? null,
    customer_messages_enabled: currentSettings?.customer_messages_enabled ?? false,
    queue_entry_message: currentSettings?.queue_entry_message ?? null,
    queue_entry_message_enabled: currentSettings?.queue_entry_message_enabled ?? true,
    wash_start_message: currentSettings?.wash_start_message ?? null,
    wash_start_message_enabled: currentSettings?.wash_start_message_enabled ?? false,
    finishing_message: currentSettings?.finishing_message ?? null,
    finishing_message_enabled: currentSettings?.finishing_message_enabled ?? false,
    ready_message: currentSettings?.ready_message ?? null,
    ready_message_enabled: currentSettings?.ready_message_enabled ?? true,
    return_reminder_message: currentSettings?.return_reminder_message ?? null,
    return_reminder_enabled: currentSettings?.return_reminder_enabled ?? false,
    return_reminder_days: currentSettings?.return_reminder_days ?? 30,
    return_reminder_time: currentSettings?.return_reminder_time ?? "09:00",
    whatsapp_pairing_token: currentSettings?.whatsapp_pairing_token ?? crypto.randomUUID(),
    evolution_base_url: currentSettings?.evolution_base_url ?? null,
    evolution_instance: currentSettings?.evolution_instance ?? null,
    evolution_api_key: currentSettings?.evolution_api_key ?? null,
    evolution_enabled: currentSettings?.evolution_enabled ?? false,
    operator_can_edit_status: currentSettings?.operator_can_edit_status ?? false,
    operator_can_view_all_cars: currentSettings?.operator_can_view_all_cars ?? false,
    operator_can_view_customer_phone: currentSettings?.operator_can_view_customer_phone ?? false,
    operator_inventory_enabled: currentSettings?.operator_inventory_enabled ?? false,
    operations_mode: currentSettings?.operations_mode ?? "boxes",
    operation_flow_locked: currentSettings?.operation_flow_locked ?? true,
    tv_mode_enabled: currentSettings?.tv_mode_enabled ?? false,
    require_ready_photo: currentSettings?.require_ready_photo ?? false,
    allow_step_photos: currentSettings?.allow_step_photos ?? true,
    landing_enabled: currentSettings?.landing_enabled ?? false,
    instagram_enabled: currentSettings?.instagram_enabled ?? false,
    instagram_auto_publish_enabled: currentSettings?.instagram_auto_publish_enabled ?? false,
    instagram_default_publish_mode: currentSettings?.instagram_default_publish_mode ?? "manual",
    logout_before: logoutBefore,
  });

  if (settingsError) {
    redirect(`/app/dashboard?error=${encodeURIComponent(settingsError.message)}`);
  }

  await closeAllEmployeeWorkSessionsByTenant(context.tenantId);
}
