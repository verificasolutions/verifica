import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AttendanceBoxEventRecord, OperationBoxRecord } from "@/backend/types";

export async function listOperationBoxesByTenant(tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("operation_boxes")
    .select("id, tenant_id, name, code, kind, sort_order, sla_minutes, sla_unit, color_token, is_active, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true });

  return ((data ?? []) as OperationBoxRecord[]).map((item) => ({
    ...item,
    sla_minutes: item.sla_minutes ?? null,
    sla_unit: item.sla_unit ?? "minutes",
    color_token: item.color_token ?? null,
  }));
}

export async function listAttendanceBoxEvents(attendanceId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("attendance_box_events")
    .select("id, tenant_id, attendance_id, from_box_id, to_box_id, moved_by, moved_at, note")
    .eq("attendance_id", attendanceId)
    .order("moved_at", { ascending: false });

  return (data ?? []) as AttendanceBoxEventRecord[];
}

export async function moveAttendanceToBoxForTenant(input: {
  attendanceId: string;
  boxId: string;
  queuePosition?: number | null;
  note?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("move_attendance_to_box_atomic", {
    p_attendance_id: input.attendanceId,
    p_box_id: input.boxId,
    p_queue_position: input.queuePosition ?? null,
    p_note: input.note ?? null,
  });

  return error as { message: string } | null;
}

export async function createOperationBoxForTenant(input: {
  tenantId: string;
  name: string;
  code: string;
  kind: OperationBoxRecord["kind"];
  sortOrder: number;
  slaMinutes: number | null;
  slaUnit: OperationBoxRecord["sla_unit"];
  colorToken: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operation_boxes")
    .insert({
      tenant_id: input.tenantId,
      name: input.name,
      code: input.code,
      kind: input.kind,
      sort_order: input.sortOrder,
      sla_minutes: input.slaMinutes,
      sla_unit: input.slaUnit,
      color_token: input.colorToken,
      is_active: true,
    })
    .select("id, tenant_id, name, code, kind, sort_order, sla_minutes, sla_unit, color_token, is_active, created_at, updated_at")
    .single();

  return {
    record: (data as OperationBoxRecord | null) ?? null,
    error: (error as { message: string } | null) ?? null,
  };
}

export async function updateOperationBoxForTenant(input: {
  tenantId: string;
  boxId: string;
  name: string;
  code: string;
  kind: OperationBoxRecord["kind"];
  sortOrder: number;
  slaMinutes: number | null;
  slaUnit: OperationBoxRecord["sla_unit"];
  colorToken: string | null;
  isActive: boolean;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("operation_boxes")
    .update({
      name: input.name,
      code: input.code,
      kind: input.kind,
      sort_order: input.sortOrder,
      sla_minutes: input.slaMinutes,
      sla_unit: input.slaUnit,
      color_token: input.colorToken,
      is_active: input.isActive,
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.boxId);

  return error as { message: string } | null;
}

export async function resequenceOperationBoxesForTenant(input: {
  tenantId: string;
  orderedBoxIds: string[];
}) {
  const supabase = await createSupabaseServerClient();

  for (let index = 0; index < input.orderedBoxIds.length; index += 1) {
    const boxId = input.orderedBoxIds[index];
    const { error } = await supabase
      .from("operation_boxes")
      .update({ sort_order: index + 1 })
      .eq("tenant_id", input.tenantId)
      .eq("id", boxId);

    if (error) {
      return error as { message: string };
    }
  }

  return null;
}
