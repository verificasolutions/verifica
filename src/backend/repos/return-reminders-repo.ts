import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type DueReturnReminder = {
  tenantId: string;
  tenantName: string;
  customerId: string;
  customerName: string;
  whatsapp: string;
  vehicleModel: string;
  vehiclePlate: string;
  serviceName: string;
  lastAttendanceAt: string;
  returnReminderMessage: string | null;
  returnReminderDays: number;
};

export async function listDueReturnReminders(now: Date) {
  const admin = createSupabaseAdminClient();
  const isoNow = now.toISOString();
  const { data, error } = await (admin as any).rpc("list_due_return_reminders", {
    p_now: isoNow,
  });

  return {
    data: (data as DueReturnReminder[] | null) ?? [],
    error: error as { message: string } | null,
  };
}

export async function markReturnReminderSent(customerId: string, sentAt: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await (admin.from("customers") as any)
    .update({ last_return_reminder_sent_at: sentAt })
    .eq("id", customerId);

  return error as { message: string } | null;
}
