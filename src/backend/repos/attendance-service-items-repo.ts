import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AttendanceServiceItemRecord } from "@/backend/types";

type AttendanceServiceItemRow = {
  id: string;
  tenant_id: string;
  attendance_id: string;
  service_id: string | null;
  name: string;
  estimated_minutes: number | null;
  unit_price: number | string;
  status: AttendanceServiceItemRecord["status"];
  sort_order: number;
  is_primary: boolean;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeAttendanceServiceItem(row: AttendanceServiceItemRow): AttendanceServiceItemRecord {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    attendance_id: row.attendance_id,
    service_id: row.service_id,
    name: row.name,
    estimated_minutes: row.estimated_minutes ?? null,
    unit_price: Number(row.unit_price ?? 0),
    status: row.status,
    sort_order: row.sort_order,
    is_primary: row.is_primary,
    completed_at: row.completed_at ?? null,
    completed_by: row.completed_by ?? null,
    notes: row.notes ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listAttendanceServiceItemsByAttendances(attendanceIds: string[]) {
  if (attendanceIds.length === 0) {
    return new Map<string, AttendanceServiceItemRecord[]>();
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("attendance_service_items")
    .select("id, tenant_id, attendance_id, service_id, name, estimated_minutes, unit_price, status, sort_order, is_primary, completed_at, completed_by, notes, created_at, updated_at")
    .in("attendance_id", attendanceIds)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const map = new Map<string, AttendanceServiceItemRecord[]>();
  for (const row of (data ?? []) as AttendanceServiceItemRow[]) {
    const item = normalizeAttendanceServiceItem(row);
    const current = map.get(item.attendance_id) ?? [];
    current.push(item);
    map.set(item.attendance_id, current);
  }

  return map;
}

export async function createAttendanceServiceItemsForTenant(input: {
  tenantId: string;
  attendanceId: string;
  items: Array<{
    serviceId: string | null;
    name: string;
    estimatedMinutes: number | null;
    unitPrice: number;
    isPrimary: boolean;
    notes?: string | null;
  }>;
}) {
  const supabase = await createSupabaseServerClient();
  const payload = input.items.map((item, index) => ({
    tenant_id: input.tenantId,
    attendance_id: input.attendanceId,
    service_id: item.serviceId,
    name: item.name,
    estimated_minutes: item.estimatedMinutes,
    unit_price: item.unitPrice,
    status: "pending" as const,
    sort_order: index + 1,
    is_primary: item.isPrimary,
    notes: item.notes ?? null,
  }));

  const { data, error } = await supabase
    .from("attendance_service_items")
    .insert(payload)
    .select("id, tenant_id, attendance_id, service_id, name, estimated_minutes, unit_price, status, sort_order, is_primary, completed_at, completed_by, notes, created_at, updated_at");

  return {
    data: ((data ?? []) as AttendanceServiceItemRow[]).map(normalizeAttendanceServiceItem),
    error: error as { message: string } | null,
  };
}

export async function updateAttendanceServiceItemStatusForTenant(input: {
  tenantId: string;
  attendanceId: string;
  itemId: string;
  status: AttendanceServiceItemRecord["status"];
  completedBy?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const patch: Record<string, unknown> = {
    status: input.status,
    completed_at: input.status === "completed" ? new Date().toISOString() : null,
    completed_by: input.status === "completed" ? (input.completedBy ?? null) : null,
  };

  const { data, error } = await supabase
    .from("attendance_service_items")
    .update(patch)
    .eq("tenant_id", input.tenantId)
    .eq("attendance_id", input.attendanceId)
    .eq("id", input.itemId)
    .select("id, tenant_id, attendance_id, service_id, name, estimated_minutes, unit_price, status, sort_order, is_primary, completed_at, completed_by, notes, created_at, updated_at")
    .maybeSingle();

  return {
    data: data ? normalizeAttendanceServiceItem(data as AttendanceServiceItemRow) : null,
    error: error as { message: string } | null,
  };
}
