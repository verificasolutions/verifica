import { NextRequest, NextResponse } from "next/server";
import { sendEvolutionTextMessage } from "@/backend/integrations/evolution";
import { buildReturnReminderMessage } from "@/backend/integrations/whatsapp-templates";
import { listDueReturnReminders, markReturnReminderSent } from "@/backend/repos/return-reminders-repo";
import { getTenantSettings } from "@/backend/repos/tenant-settings-repo";
import { isCustomerMessagingUnlocked } from "@/backend/shared/tenant-whatsapp-messages";
import type { TenantSettingsRecord } from "@/backend/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return unauthorized();
  }

  const now = new Date();
  const due = await listDueReturnReminders(now);
  if (due.error) {
    return NextResponse.json({ ok: false, message: due.error.message }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const item of due.data) {
    const tenantSettings = await getTenantSettings(item.tenantId);

    if (!isCustomerMessagingUnlocked(tenantSettings)) {
      failed += 1;
      continue;
    }

    const text = buildReturnReminderMessage(
      tenantSettings ??
        ({
          tenant_id: item.tenantId,
          default_service_minutes: 30,
          customer_messages_enabled: true,
          queue_entry_message: null,
          queue_entry_message_enabled: false,
          wash_start_message: null,
          wash_start_message_enabled: false,
          finishing_message: null,
          finishing_message_enabled: false,
          ready_message: null,
          ready_message_enabled: false,
          return_reminder_message: item.returnReminderMessage,
          return_reminder_enabled: true,
          return_reminder_days: item.returnReminderDays,
          return_reminder_time: "09:00",
          whatsapp_pairing_token: crypto.randomUUID(),
          evolution_base_url: null,
          evolution_instance: null,
          evolution_api_key: null,
          evolution_enabled: true,
          operator_can_edit_status: false,
          operator_can_view_all_cars: false,
          operator_can_view_customer_phone: false,
          operator_inventory_enabled: false,
          operations_mode: "classic",
          tv_mode_enabled: false,
          require_ready_photo: false,
          allow_step_photos: true,
          landing_enabled: false,
          instagram_enabled: false,
          instagram_auto_publish_enabled: false,
          instagram_default_publish_mode: "manual",
          logout_before: null,
        } as TenantSettingsRecord),
      {
        tenantName: item.tenantName,
        customerName: item.customerName,
        vehicleModel: item.vehicleModel,
        vehiclePlate: item.vehiclePlate,
        serviceName: item.serviceName,
        etaMinutes: 0,
        trackingUrl: "",
      },
    );

    const result = await sendEvolutionTextMessage({
      tenantId: item.tenantId,
      number: item.whatsapp,
      text,
    });

    if (!result.ok) {
      failed += 1;
      continue;
    }

    const markError = await markReturnReminderSent(item.customerId, now.toISOString());
    if (markError) {
      failed += 1;
      continue;
    }

    sent += 1;
  }

  return NextResponse.json({
    ok: true,
    processed: due.data.length,
    sent,
    failed,
    checkedAt: now.toISOString(),
  });
}
