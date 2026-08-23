import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSaoPauloDayRange, getSaoPauloWeekRange } from "@/backend/shared/date-range";
import type { AppointmentRecord } from "@/backend/types";

type AppointmentRow = {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  vehicle_id: string | null;
  service_id: string | null;
  scheduled_for: string;
  status: string;
  notes: string | null;
  customers?: { name: string }[] | { name: string } | null;
  vehicles?: { brand: string | null; model: string; plate: string; color: string | null; vehicle_type: string | null }[] | { brand: string | null; model: string; plate: string; color: string | null; vehicle_type: string | null } | null;
  services?:
    | { name: string; price: number | string | null; price_passeio: number | string | null; price_medio: number | string | null; price_grande: number | string | null; price_bem_grande: number | string | null }[]
    | { name: string; price: number | string | null; price_passeio: number | string | null; price_medio: number | string | null; price_grande: number | string | null; price_bem_grande: number | string | null }
    | null;
};

const appointmentSelect = `
  id, tenant_id, customer_id, vehicle_id, service_id, scheduled_for, status, notes,
  customers(name),
  vehicles(brand, model, plate, color, vehicle_type),
  services(name, price, price_passeio, price_medio, price_grande, price_bem_grande)
`;

function normalizeAppointment(item: AppointmentRow) {
  return {
    ...item,
    customers: Array.isArray(item.customers) ? item.customers[0] ?? null : item.customers ?? null,
    vehicles: Array.isArray(item.vehicles) ? item.vehicles[0] ?? null : item.vehicles ?? null,
    services: Array.isArray(item.services) ? item.services[0] ?? null : item.services ?? null,
  } as AppointmentRecord;
}

function normalizeAppointmentList(data: AppointmentRow[] | null | undefined) {
  return ((data ?? []) as AppointmentRow[]).map(normalizeAppointment);
}

function buildMonthRange(year: number, month: number) {
  const startDate = new Date(Date.UTC(year, month - 1, 1, 3, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month, 1, 3, 0, 0, 0));
  const start = new Date(startDate.getTime());
  const end = new Date(endDate.getTime());
  end.setMilliseconds(end.getMilliseconds() - 1);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export async function listAppointmentsForTodayByTenant(tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { start: dayStart, end: dayEnd } = getSaoPauloDayRange();
  const { data } = await supabase
    .from("appointments")
    .select(appointmentSelect)
    .eq("tenant_id", tenantId)
    .eq("status", "scheduled")
    .gte("scheduled_for", dayStart)
    .lte("scheduled_for", dayEnd)
    .order("scheduled_for", { ascending: true });

  return normalizeAppointmentList(data as AppointmentRow[] | null | undefined);
}

export async function listAppointmentsForTodayWithStatusesByTenant(tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { start: dayStart, end: dayEnd } = getSaoPauloDayRange();
  const { data } = await supabase
    .from("appointments")
    .select(appointmentSelect)
    .eq("tenant_id", tenantId)
    .gte("scheduled_for", dayStart)
    .lte("scheduled_for", dayEnd)
    .order("scheduled_for", { ascending: true });

  return normalizeAppointmentList(data as AppointmentRow[] | null | undefined);
}

export async function listScheduledAppointmentsByTenant(tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("appointments")
    .select(appointmentSelect)
    .eq("tenant_id", tenantId)
    .eq("status", "scheduled")
    .order("scheduled_for", { ascending: true });

  return normalizeAppointmentList(data as AppointmentRow[] | null | undefined);
}

export async function listAppointmentsForWeekByTenant(tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { start: weekStart, end: weekEnd } = getSaoPauloWeekRange();
  const { data } = await supabase
    .from("appointments")
    .select(appointmentSelect)
    .eq("tenant_id", tenantId)
    .eq("status", "scheduled")
    .gte("scheduled_for", weekStart)
    .lte("scheduled_for", weekEnd)
    .order("scheduled_for", { ascending: true });

  return normalizeAppointmentList(data as AppointmentRow[] | null | undefined);
}

export async function listAppointmentsForMonthByTenant(tenantId: string, year: number, month: number) {
  const supabase = await createSupabaseServerClient();
  const { start, end } = buildMonthRange(year, month);
  const { data } = await supabase
    .from("appointments")
    .select(appointmentSelect)
    .eq("tenant_id", tenantId)
    .gte("scheduled_for", start)
    .lte("scheduled_for", end)
    .order("scheduled_for", { ascending: true });

  return normalizeAppointmentList(data as AppointmentRow[] | null | undefined);
}

export async function createAppointmentForTenant(input: {
  tenantId: string;
  customerId: string;
  vehicleId: string;
  serviceId: string | null;
  scheduledFor: string;
  notes: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("appointments").insert({
    tenant_id: input.tenantId,
    customer_id: input.customerId,
    vehicle_id: input.vehicleId,
    service_id: input.serviceId,
    scheduled_for: input.scheduledFor,
    notes: input.notes,
    status: "scheduled",
  });

  return error as { message: string } | null;
}

export async function getAppointmentById(tenantId: string, appointmentId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("appointments")
    .select(appointmentSelect)
    .eq("tenant_id", tenantId)
    .eq("id", appointmentId)
    .maybeSingle();

  if (!data) return null;
  return normalizeAppointment(data as AppointmentRow);
}

export async function updateAppointmentForTenant(input: {
  tenantId: string;
  appointmentId: string;
  status?: string;
  scheduledFor?: string;
}) {
  const supabase = await createSupabaseServerClient();
  const payload: Record<string, string> = {};

  if (input.status) payload.status = input.status;
  if (input.scheduledFor) payload.scheduled_for = input.scheduledFor;

  const { error } = await supabase
    .from("appointments")
    .update(payload)
    .eq("tenant_id", input.tenantId)
    .eq("id", input.appointmentId);

  return error as { message: string } | null;
}
