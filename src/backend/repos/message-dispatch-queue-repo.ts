import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MessageDispatchQueueRecord } from "@/backend/types";

type QueueRow = MessageDispatchQueueRecord;

export async function enqueueMessageDispatch(input: {
  tenantId: string;
  attendanceId?: string | null;
  customerId?: string | null;
  stage: QueueRow["stage"];
  whatsapp: string;
  text: string;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  mediaFileName?: string | null;
}) {
  const admin = createSupabaseAdminClient();
  const payload = {
    tenant_id: input.tenantId,
    attendance_id: input.attendanceId ?? null,
    customer_id: input.customerId ?? null,
    stage: input.stage,
    whatsapp: input.whatsapp,
    text: input.text,
    media_url: input.mediaUrl ?? null,
    media_mime_type: input.mediaMimeType ?? null,
    media_file_name: input.mediaFileName ?? null,
  };
  const queueTable = admin.from("message_dispatch_queue") as any;
  const { data, error } = await queueTable.insert(payload).select("*").single();

  return {
    data: (data as QueueRow | null) ?? null,
    error: error as { message: string } | null,
  };
}

export async function claimMessageDispatchBatch(limit = 10) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await (admin.rpc as any)("claim_message_dispatch_batch", {
    p_limit: limit,
  });

  return {
    data: ((data ?? []) as QueueRow[]),
    error: error as { message: string } | null,
  };
}

export async function hasQueuedOrSentMessageForAttendanceStage(input: {
  attendanceId: string;
  stage: QueueRow["stage"];
}) {
  const admin = createSupabaseAdminClient();
  const queueTable = admin.from("message_dispatch_queue") as any;
  const { data } = await queueTable
    .select("id, status")
    .eq("attendance_id", input.attendanceId)
    .eq("stage", input.stage)
    .in("status", ["pending", "processing", "sent"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return Boolean(data);
}

export async function markMessageDispatchSent(id: string) {
  const admin = createSupabaseAdminClient();
  const queueTable = admin.from("message_dispatch_queue") as any;
  const { error } = await queueTable
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  return error as { message: string } | null;
}

export async function markMessageDispatchResult(input: {
  id: string;
  attempts: number;
  ok: boolean;
  errorMessage?: string | null;
}) {
  const admin = createSupabaseAdminClient();
  const queueTable = admin.from("message_dispatch_queue") as any;
  const nextStatus = input.ok ? "sent" : input.attempts >= 5 ? "failed" : "pending";
  const patch = {
    status: nextStatus,
    last_error: input.ok ? null : input.errorMessage ?? "Falha ao enviar mensagem.",
    sent_at: input.ok ? new Date().toISOString() : null,
    processing_started_at: null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await queueTable.update(patch).eq("id", input.id);
  return error as { message: string } | null;
}
