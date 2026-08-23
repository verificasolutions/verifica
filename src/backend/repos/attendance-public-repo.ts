/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function getAttendancePublicStatusByCode(publicCode: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("attendance_public_status")
    .select(`
      attendance_id, public_code, vehicle_label, status, eta_minutes, step_index, is_active,
      attendances(
        tenant_id,
        vehicles(brand, model, color, vehicle_type),
        tenants(name, whatsapp, operational_profile)
      )
    `)
    .eq("public_code", publicCode)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) {
    return null;
  }

  const tenantId = data.attendances?.tenant_id ?? null;
  let companyProfile: any = null;

  if (tenantId) {
    const profileResult = await admin
      .from("tenant_company_profiles")
      .select("phone, phone_secondary, street, street_number, neighborhood, city, state")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    companyProfile = profileResult.data ?? null;
  }

  const vehicle = Array.isArray(data.attendances?.vehicles) ? data.attendances.vehicles[0] ?? null : data.attendances?.vehicles ?? null;

  return {
    attendance_id: data.attendance_id,
    public_code: data.public_code,
    vehicle_label: data.vehicle_label,
    status: data.status,
    eta_minutes: data.eta_minutes,
    step_index: data.step_index,
    is_active: data.is_active,
    tenant_name: data.attendances?.tenants?.name ?? null,
    operational_profile: data.attendances?.tenants?.operational_profile ?? "automotive",
    tenant_whatsapp: companyProfile?.phone ?? companyProfile?.phone_secondary ?? data.attendances?.tenants?.whatsapp ?? null,
    location_label:
      companyProfile && (companyProfile.street || companyProfile.city)
        ? [companyProfile.street, companyProfile.street_number, companyProfile.neighborhood, companyProfile.city, companyProfile.state]
            .filter(Boolean)
            .join(", ")
        : null,
    vehicle_brand: vehicle?.brand ?? null,
    vehicle_model: vehicle?.model ?? null,
    vehicle_color: vehicle?.color ?? null,
    vehicle_type: vehicle?.vehicle_type ?? null,
  } as
    | {
        attendance_id: string;
        public_code: string;
        vehicle_label: string;
        status: "waiting" | "washing" | "finishing" | "ready" | "delivered" | "canceled";
        eta_minutes: number | null;
        step_index: number;
        is_active: boolean;
        tenant_name: string | null;
        operational_profile: "automotive" | "generic";
        tenant_whatsapp: string | null;
        location_label: string | null;
        vehicle_brand: string | null;
        vehicle_model: string | null;
        vehicle_color: string | null;
        vehicle_type: string | null;
      }
    | null;
}
