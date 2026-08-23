import "server-only";
import { listAttendanceServiceItemsByAttendances } from "@/backend/repos/attendance-service-items-repo";
import { summarizeAttendanceServiceItems } from "@/backend/shared/attendance-service-summary";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSaoPauloDayRange } from "@/backend/shared/date-range";
import type { AttendanceRecord } from "@/backend/types";

type QueueRow = {
  id: string;
  tenant_id: string;
  customer_id: string;
  vehicle_id: string;
  service_id: string | null;
  service_label?: string | null;
  employee_id: string | null;
  status: AttendanceRecord["status"];
  estimated_minutes: number | null;
  extra_minutes?: number | null;
  current_box_id?: string | null;
  current_box_entered_at?: string | null;
  queue_position?: number | null;
  operational_stage?: string | null;
  final_price: number | string;
  payment_method: AttendanceRecord["payment_method"];
  public_code: string;
  started_at?: string | null;
  ready_at?: string | null;
  created_at: string;
  customers?: { name: string; whatsapp: string | null }[] | { name: string; whatsapp: string | null } | null;
  vehicles?: { plate: string; brand: string | null; model: string; color: string | null; vehicle_type: string | null }[] | { plate: string; brand: string | null; model: string; color: string | null; vehicle_type: string | null } | null;
  services?: { name: string }[] | { name: string } | null;
  employees?: { name: string }[] | { name: string } | null;
};

type AttendanceLookupRow = {
  id: string;
  status: AttendanceRecord["status"];
  public_code: string;
  service_label?: string | null;
  estimated_minutes: number | null;
  extra_minutes?: number | null;
  current_box_id?: string | null;
  current_box_entered_at?: string | null;
  payment_method: AttendanceRecord["payment_method"];
  final_price: number | string;
  customers?: { name: string; whatsapp: string | null }[] | { name: string; whatsapp: string | null } | null;
  vehicles?: { plate: string; brand: string | null; model: string; color: string | null; vehicle_type: string | null }[] | { plate: string; brand: string | null; model: string; color: string | null; vehicle_type: string | null } | null;
  services?: { name: string }[] | { name: string } | null;
};

type AttendanceCashTargetRow = {
  id: string;
  status: AttendanceRecord["status"];
  public_code: string;
  service_label?: string | null;
  estimated_minutes: number | null;
  extra_minutes?: number | null;
  current_box_id?: string | null;
  current_box_entered_at?: string | null;
  payment_method: AttendanceRecord["payment_method"];
  final_price: number | string;
  customers?: { name: string; whatsapp: string | null }[] | { name: string; whatsapp: string | null } | null;
  vehicles?: { plate: string; brand: string | null; model: string; color: string | null; vehicle_type: string | null }[] | { plate: string; brand: string | null; model: string; color: string | null; vehicle_type: string | null } | null;
  services?: { name: string }[] | { name: string } | null;
};

function firstRelated<T>(value: T[] | T | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

async function mapCurrentBoxEnteredAt(rows: QueueRow[]) {
  const attendanceIds = rows.map((item) => item.id);
  if (attendanceIds.length === 0) {
    return new Map<string, string | null>();
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("attendance_box_events")
    .select("attendance_id, to_box_id, moved_at")
    .in("attendance_id", attendanceIds)
    .order("moved_at", { ascending: false });

  const latestByAttendance = new Map<string, string | null>();
  for (const event of (data ?? []) as Array<{ attendance_id: string; to_box_id: string | null; moved_at: string }>) {
    const row = rows.find((item) => item.id === event.attendance_id);
    if (!row || latestByAttendance.has(event.attendance_id)) continue;
    if (row.current_box_id && event.to_box_id === row.current_box_id) {
      latestByAttendance.set(event.attendance_id, event.moved_at);
    }
  }

  return latestByAttendance;
}

export async function createAttendanceForTenant(input: {
  tenantId: string;
  customerId: string;
  vehicleId: string;
  serviceId: string | null;
  serviceLabel: string | null;
  estimatedMinutes: number;
  extraMinutes: number;
  finalPrice: number;
  paymentMethod: "cash" | "pix" | "card" | "pending";
  notifyCustomer: boolean;
  billingMode?: "standard" | "fleet";
  billingDueDate?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("attendances")
    .insert({
      tenant_id: input.tenantId,
      customer_id: input.customerId,
      vehicle_id: input.vehicleId,
      service_id: input.serviceId,
      service_label: input.serviceLabel,
      status: "waiting",
      estimated_minutes: input.estimatedMinutes,
      extra_minutes: input.extraMinutes,
      base_price: input.finalPrice,
      final_price: input.finalPrice,
      payment_method: input.paymentMethod,
      billing_mode: input.billingMode ?? "standard",
      billing_due_date: input.billingDueDate ?? null,
      notify_customer: input.notifyCustomer,
    })
    .select("id, tenant_id, customer_id, vehicle_id, service_id, service_label, employee_id, status, estimated_minutes, extra_minutes, current_box_id, queue_position, operational_stage, final_price, payment_method, billing_mode, billing_due_date, public_code, started_at, ready_at, created_at")
    .single();

  return { data: (data as AttendanceRecord | null) ?? null, error: error as { message: string } | null };
}

export async function findActiveAttendanceByVehicle(input: {
  tenantId: string;
  vehicleId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("attendances")
    .select("id, status, public_code, created_at")
    .eq("tenant_id", input.tenantId)
    .eq("vehicle_id", input.vehicleId)
    .in("status", ["waiting", "washing", "finishing", "ready"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as Pick<AttendanceRecord, "id" | "status" | "public_code" | "created_at"> | null) ?? null;
}

export async function createAttendancePublicStatus(input: {
  attendanceId: string;
  publicCode: string;
  vehicleLabel: string;
  status: AttendanceRecord["status"];
  etaMinutes: number;
  stepIndex: number;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("attendance_public_status").upsert({
    attendance_id: input.attendanceId,
    public_code: input.publicCode,
    vehicle_label: input.vehicleLabel,
    status: input.status,
    eta_minutes: input.etaMinutes,
    step_index: input.stepIndex,
    is_active: true,
  });

  return error as { message: string } | null;
}

export async function updateAttendancePublicStatus(input: {
  attendanceId: string;
  status?: AttendanceRecord["status"];
  etaMinutes?: number | null;
  stepIndex?: number;
  isActive?: boolean;
}) {
  const supabase = await createSupabaseServerClient();
  const patch: Record<string, unknown> = {};

  if (input.status !== undefined) patch.status = input.status;
  if (input.etaMinutes !== undefined) patch.eta_minutes = input.etaMinutes;
  if (input.stepIndex !== undefined) patch.step_index = input.stepIndex;
  if (input.isActive !== undefined) patch.is_active = input.isActive;

  const { error } = await supabase.from("attendance_public_status").update(patch).eq("attendance_id", input.attendanceId);

  return error as { message: string } | null;
}

export async function listQueueForTodayByTenant(tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { start: dayStart, end: dayEnd } = getSaoPauloDayRange();

  const [activeResult, todayResult] = await Promise.all([
    supabase
      .from("attendances")
      .select(`
        id, tenant_id, customer_id, vehicle_id, service_id, service_label, employee_id, status, estimated_minutes,
        extra_minutes, current_box_id, queue_position, operational_stage, final_price, payment_method, public_code,
        started_at, ready_at, created_at,
        customers(name, whatsapp),
        vehicles(plate, brand, model, color, vehicle_type),
        services(name),
        employees(name)
      `)
      .eq("tenant_id", tenantId)
      .in("status", ["waiting", "washing", "finishing", "ready"])
      .order("created_at", { ascending: false }),
    supabase
      .from("attendances")
      .select(`
        id, tenant_id, customer_id, vehicle_id, service_id, service_label, employee_id, status, estimated_minutes,
        extra_minutes, current_box_id, queue_position, operational_stage, final_price, payment_method, public_code,
        started_at, ready_at, created_at,
        customers(name, whatsapp),
        vehicles(plate, brand, model, color, vehicle_type),
        services(name),
        employees(name)
      `)
      .eq("tenant_id", tenantId)
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .order("created_at", { ascending: false }),
  ]);

  const mergedMap = new Map<string, QueueRow>();
  for (const item of [...((activeResult.data ?? []) as QueueRow[]), ...((todayResult.data ?? []) as QueueRow[])]) {
    if (!mergedMap.has(item.id)) {
      mergedMap.set(item.id, item);
    }
  }

  const data = [...mergedMap.values()].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const currentBoxEnteredAtByAttendance = await mapCurrentBoxEnteredAt(data);
  const serviceItemsByAttendance = await listAttendanceServiceItemsByAttendances(data.map((item) => item.id));

  return (data as QueueRow[]).map((item) => ({
    id: item.id,
    tenant_id: item.tenant_id,
    customer_id: item.customer_id,
    vehicle_id: item.vehicle_id,
    service_id: item.service_id,
    service_label: item.service_label ?? null,
    employee_id: item.employee_id,
    status: item.status,
    estimated_minutes: item.estimated_minutes,
    extra_minutes: item.extra_minutes ?? 0,
    current_box_id: item.current_box_id ?? null,
    current_box_entered_at: currentBoxEnteredAtByAttendance.get(item.id) ?? null,
    queue_position: item.queue_position ?? null,
    operational_stage: item.operational_stage ?? null,
    final_price: Number(item.final_price ?? 0),
    payment_method: item.payment_method,
    public_code: item.public_code,
    started_at: item.started_at ?? null,
    ready_at: item.ready_at ?? null,
    created_at: item.created_at,
    customers: firstRelated(item.customers),
    vehicles: firstRelated(item.vehicles),
    services: firstRelated(item.services),
    service_items: serviceItemsByAttendance.get(item.id) ?? [],
    service_summary: summarizeAttendanceServiceItems(serviceItemsByAttendance.get(item.id)),
    employees: firstRelated(item.employees),
  })) as AttendanceRecord[];
}

export async function findAttendanceForPaymentByIdentifier(input: {
  tenantId: string;
  identifierType: "whatsapp" | "plate" | "customer_name";
  identifierValue: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { start: dayStart, end: dayEnd } = getSaoPauloDayRange();

  const { data } = await supabase
    .from("attendances")
    .select(`
      id, status, public_code, service_label, estimated_minutes, extra_minutes, current_box_id, payment_method, final_price,
      customers(name, whatsapp),
      vehicles(plate, brand, model, color, vehicle_type),
      services(name)
    `)
    .eq("tenant_id", input.tenantId)
    .in("status", ["waiting", "washing", "finishing", "ready"])
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd)
    .order("created_at", { ascending: false });

  const normalized = input.identifierValue.trim().toLowerCase();
  const rows = ((data ?? []) as AttendanceLookupRow[]).map((item) => ({
    id: item.id,
    status: item.status,
    public_code: item.public_code,
    service_label: item.service_label ?? null,
    estimated_minutes: item.estimated_minutes,
    extra_minutes: item.extra_minutes ?? 0,
    current_box_id: item.current_box_id ?? null,
    current_box_entered_at: null,
    payment_method: item.payment_method,
    final_price: Number(item.final_price ?? 0),
    customer: firstRelated(item.customers),
    vehicle: firstRelated(item.vehicles),
    service: firstRelated(item.services),
  }));

  return (
    rows.find((item) => {
      if (input.identifierType === "whatsapp") {
        return (item.customer?.whatsapp ?? "").toLowerCase().includes(normalized);
      }

      if (input.identifierType === "plate") {
        return (item.vehicle?.plate ?? "").toLowerCase().includes(normalized);
      }

      return (item.customer?.name ?? "").toLowerCase().includes(normalized);
    }) ?? null
  );
}

export async function findAttendanceForCashFlowById(input: {
  tenantId: string;
  attendanceId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("attendances")
    .select(`
      id, status, public_code, service_label, estimated_minutes, extra_minutes, current_box_id, payment_method, final_price,
      customers(name, whatsapp),
      vehicles(plate, brand, model, color, vehicle_type),
      services(name)
    `)
    .eq("tenant_id", input.tenantId)
    .eq("id", input.attendanceId)
    .maybeSingle();

  const item = (data as AttendanceCashTargetRow | null) ?? null;
  if (!item) return null;

  return {
    id: item.id,
    status: item.status,
    public_code: item.public_code,
    service_label: item.service_label ?? null,
    estimated_minutes: item.estimated_minutes,
    extra_minutes: item.extra_minutes ?? 0,
    current_box_id: item.current_box_id ?? null,
    current_box_entered_at: null,
    payment_method: item.payment_method,
    final_price: Number(item.final_price ?? 0),
    customer: firstRelated(item.customers),
    vehicle: firstRelated(item.vehicles),
    service: firstRelated(item.services),
  };
}

export async function updateAttendancePaymentMethodForTenant(input: {
  tenantId: string;
  attendanceId: string;
  paymentMethod: AttendanceRecord["payment_method"];
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("attendances")
    .update({ payment_method: input.paymentMethod })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.attendanceId);

  return error as { message: string } | null;
}

export async function updateAttendanceStatusForTenant(input: {
  attendanceId: string;
  status: AttendanceRecord["status"];
}) {
  const supabase = await createSupabaseServerClient();
  const patch: Record<string, unknown> = { status: input.status };

  if (input.status === "washing") patch.started_at = new Date().toISOString();
  if (input.status === "ready") patch.ready_at = new Date().toISOString();
  if (input.status === "delivered") patch.delivered_at = new Date().toISOString();
  if (input.status === "canceled") patch.canceled_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("attendances")
    .update(patch)
    .eq("id", input.attendanceId)
    .select("id, public_code, status, estimated_minutes, extra_minutes, vehicles(brand, model, color)")
    .single();

  return {
    data: data as
      | {
          id: string;
          public_code: string;
          status: AttendanceRecord["status"];
          estimated_minutes: number | null;
          extra_minutes?: number | null;
          vehicles: { brand: string | null; model: string; color: string | null } | null;
        }
      | null,
    error: error as { message: string } | null,
  };
}
