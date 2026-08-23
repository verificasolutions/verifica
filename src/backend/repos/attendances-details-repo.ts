import "server-only";
import { listAttendanceServiceItemsByAttendances } from "@/backend/repos/attendance-service-items-repo";
import { summarizeAttendanceServiceItems } from "@/backend/shared/attendance-service-summary";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AttendanceRecord } from "@/backend/types";

type AttendanceDetailRow = {
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
  final_price: number | string;
  payment_method: AttendanceRecord["payment_method"];
  public_code: string;
  created_at: string;
  customers?: { name: string; whatsapp: string | null }[] | { name: string; whatsapp: string | null } | null;
  vehicles?: { plate: string; brand: string | null; model: string; color: string | null }[] | { plate: string; brand: string | null; model: string; color: string | null } | null;
  services?: { name: string }[] | { name: string } | null;
};

export async function getAttendanceDetailById(attendanceId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("attendances")
    .select(`
      id, tenant_id, customer_id, vehicle_id, service_id, service_label, employee_id, status, estimated_minutes,
      extra_minutes, current_box_id, final_price, payment_method, public_code, created_at,
      customers(name, whatsapp),
      vehicles(plate, brand, model, color),
      services(name)
    `)
    .eq("id", attendanceId)
    .maybeSingle();

  if (!data) {
    return null;
  }

  const row = data as AttendanceDetailRow;
  const serviceItemsByAttendance = await listAttendanceServiceItemsByAttendances([row.id]);
  const serviceItems = serviceItemsByAttendance.get(row.id) ?? [];

  return {
    id: row.id,
    tenant_id: row.tenant_id,
    customer_id: row.customer_id,
    vehicle_id: row.vehicle_id,
    service_id: row.service_id,
    service_label: row.service_label ?? null,
    service_summary: summarizeAttendanceServiceItems(serviceItems),
    employee_id: row.employee_id,
    status: row.status,
    estimated_minutes: row.estimated_minutes,
    extra_minutes: row.extra_minutes ?? 0,
    current_box_id: row.current_box_id ?? null,
    final_price: Number(row.final_price ?? 0),
    payment_method: row.payment_method,
    public_code: row.public_code,
    created_at: row.created_at,
    customers: Array.isArray(row.customers) ? row.customers[0] ?? null : row.customers ?? null,
    vehicles: Array.isArray(row.vehicles) ? row.vehicles[0] ?? null : row.vehicles ?? null,
    services: Array.isArray(row.services) ? row.services[0] ?? null : row.services ?? null,
    service_items: serviceItems,
  };
}
