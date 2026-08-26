import "server-only";
import { listAttendanceMediaByAttendances } from "@/backend/repos/attendance-media-repo";
import { listServiceQuotesByCustomer } from "@/backend/repos/service-quotes-repo";
import { listActiveVehiclesByCustomer } from "@/backend/repos/vehicles-repo";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CustomerRecord, ServiceQuoteRecord, VehicleRecord } from "@/backend/types";
import { normalizeNationalPhone } from "@/backend/shared/phone";

const CUSTOMER_SELECT = `
  id,
  tenant_id,
  name,
  whatsapp,
  phone_normalized,
  legal_name,
  trade_name,
  email,
  document,
  document_type,
  state_registration,
  municipal_registration,
  postal_code,
  street,
  street_number,
  complement,
  neighborhood,
  city,
  state,
  contact_phone_1,
  contact_phone_2,
  is_fleet,
  is_active
`;

type VehicleSummary = { model: string; plate: string; color: string | null };

type CustomerHistoryRow = {
  customer_id: string;
  created_at: string;
  vehicles?: VehicleSummary[] | VehicleSummary | null;
};

type CustomerAttendanceWorkspaceRow = {
  id: string;
  created_at: string;
  status: string;
  final_price: number | string;
  payment_method: "cash" | "pix" | "card" | "pending";
  billing_mode?: "standard" | "fleet";
  billing_due_date?: string | null;
  vehicles?: VehicleSummary[] | VehicleSummary | null;
  services?: { name: string }[] | { name: string } | null;
};

type CustomerAppointmentWorkspaceRow = {
  id: string;
  scheduled_for: string;
  status: string;
  notes: string | null;
  vehicles?: VehicleSummary[] | VehicleSummary | null;
  services?: { name: string; price: number | string | null }[] | { name: string; price: number | string | null } | null;
};

export type CustomerWorkspace = {
  customer: CustomerRecord;
  lastAttendanceAt: string | null;
  lastVehicle: VehicleSummary | null;
  vehicles: VehicleRecord[];
  quotes: ServiceQuoteRecord[];
  attendances: Array<{
    id: string;
    created_at: string;
    status: string;
    final_price: number;
    payment_method: "cash" | "pix" | "card" | "pending";
    billing_mode?: "standard" | "fleet";
    billing_due_date?: string | null;
    vehicle: VehicleSummary | null;
    serviceName: string | null;
    media: Array<{
      id: string;
      kind: string;
      signed_url: string | null;
      caption: string | null;
      created_at: string;
    }>;
  }>;
  appointments: Array<{
    id: string;
    scheduled_for: string;
    status: string;
    notes: string | null;
    vehicle: VehicleSummary | null;
    serviceName: string | null;
    servicePrice: number;
  }>;
};

function firstRelatedItem<T>(value: T[] | T | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export async function listRecentCustomersByTenant(tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("customers")
    .select(CUSTOMER_SELECT)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(8);

  return (data ?? []) as CustomerRecord[];
}

export type CustomerPeriod = "week" | "fortnight" | "month";

function customerPeriodStart(period: CustomerPeriod) {
  const now = new Date();
  const local = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now) + "T12:00:00");
  if (period === "month") local.setDate(1);
  else if (period === "fortnight") local.setDate(local.getDate() - 13);
  else local.setDate(local.getDate() - ((local.getDay() + 6) % 7));
  return local.getTime();
}

export async function listCustomersWithLastAttendanceByTenant(tenantId: string, search?: string | null, period: CustomerPeriod = "week") {
  const supabase = await createSupabaseServerClient();
  const [{ data: customers }, { data: attendances }, { data: vehicles }] = await Promise.all([
    supabase
      .from("customers")
      .select(CUSTOMER_SELECT)
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("attendances")
      .select("customer_id, created_at, vehicles(model, plate, color)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("vehicles")
      .select("customer_id, model, plate, color, created_at")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
  ]);

  const latestByCustomer = new Map<string, { created_at: string; vehicle: VehicleSummary | null }>();

  for (const row of (attendances ?? []) as CustomerHistoryRow[]) {
    if (latestByCustomer.has(row.customer_id)) continue;
    latestByCustomer.set(row.customer_id, {
      created_at: row.created_at,
      vehicle: firstRelatedItem(row.vehicles),
    });
  }

  for (const row of (vehicles ?? []) as Array<{ customer_id: string; model: string; plate: string; color: string | null; created_at: string }>) {
    if (!latestByCustomer.has(row.customer_id)) latestByCustomer.set(row.customer_id, { created_at: row.created_at, vehicle: { model: row.model, plate: row.plate, color: row.color } });
  }

  const normalizedSearch = (search ?? "").trim().toLowerCase();

  return ((customers ?? []) as CustomerRecord[])
    .map((customer) => ({
      ...customer,
      lastAttendanceAt: latestByCustomer.get(customer.id)?.created_at ?? null,
      lastVehicle: latestByCustomer.get(customer.id)?.vehicle ?? null,
    }))
    .filter((customer) => {
      if (!normalizedSearch && (!customer.lastAttendanceAt || new Date(customer.lastAttendanceAt).getTime() < customerPeriodStart(period))) return false;
      if (!normalizedSearch) return true;

      const haystack = [
        customer.name,
        customer.whatsapp ?? "",
        customer.lastVehicle?.plate ?? "",
        customer.lastVehicle?.model ?? "",
        customer.lastVehicle?.color ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    })
    .sort((a, b) => {
      if (!a.lastAttendanceAt && !b.lastAttendanceAt) return a.name.localeCompare(b.name);
      if (!a.lastAttendanceAt) return 1;
      if (!b.lastAttendanceAt) return -1;
      return new Date(b.lastAttendanceAt).getTime() - new Date(a.lastAttendanceAt).getTime();
    });
}

export async function getCustomerWorkspaceByTenant(tenantId: string, customerId: string): Promise<CustomerWorkspace | null> {
  const supabase = await createSupabaseServerClient();
  const [{ data: customer }, { data: attendances }, { data: appointments }, vehicles, quotes] = await Promise.all([
    supabase
      .from("customers")
      .select(CUSTOMER_SELECT)
      .eq("tenant_id", tenantId)
      .eq("id", customerId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("attendances")
      .select("id, created_at, status, final_price, payment_method, billing_mode, billing_due_date, vehicles(model, plate, color), services(name)")
      .eq("tenant_id", tenantId)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("appointments")
      .select("id, scheduled_for, status, notes, vehicles(model, plate, color), services(name, price)")
      .eq("tenant_id", tenantId)
      .eq("customer_id", customerId)
      .order("scheduled_for", { ascending: false })
      .limit(20),
    listActiveVehiclesByCustomer(tenantId, customerId),
    listServiceQuotesByCustomer(tenantId, customerId),
  ]);

  if (!customer) return null;

  const attendanceItems = ((attendances ?? []) as CustomerAttendanceWorkspaceRow[]).map((item) => ({
    id: item.id,
    created_at: item.created_at,
    status: item.status,
    final_price: Number(item.final_price ?? 0),
    payment_method: item.payment_method,
    billing_mode: item.billing_mode ?? "standard",
    billing_due_date: item.billing_due_date ?? null,
    vehicle: firstRelatedItem(item.vehicles),
    serviceName: firstRelatedItem(item.services)?.name ?? null,
  }));

  const appointmentItems = ((appointments ?? []) as CustomerAppointmentWorkspaceRow[]).map((item) => ({
    id: item.id,
    scheduled_for: item.scheduled_for,
    status: item.status,
    notes: item.notes,
    vehicle: firstRelatedItem(item.vehicles),
    serviceName: firstRelatedItem(item.services)?.name ?? null,
    servicePrice: Number(firstRelatedItem(item.services)?.price ?? 0),
  }));

  const mediaByAttendance = await listAttendanceMediaByAttendances(attendanceItems.map((item) => item.id));

  return {
    customer: customer as CustomerRecord,
    lastAttendanceAt: attendanceItems[0]?.created_at ?? null,
    lastVehicle: attendanceItems[0]?.vehicle ?? (vehicles[0] ? { model: vehicles[0].model, plate: vehicles[0].plate, color: vehicles[0].color } : null),
    vehicles,
    quotes,
    attendances: attendanceItems.map((item) => ({
      ...item,
      media: (mediaByAttendance.get(item.id) ?? []).map((media) => ({
        id: media.id,
        kind: media.kind,
        signed_url: media.signed_url ?? null,
        caption: media.caption,
        created_at: media.created_at,
      })),
    })),
    appointments: appointmentItems,
  };
}

export async function findCustomerByWhatsapp(tenantId: string, whatsapp: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("customers")
    .select(CUSTOMER_SELECT)
    .eq("tenant_id", tenantId)
    .eq("whatsapp", whatsapp)
    .eq("is_active", true)
    .maybeSingle();

  return (data as CustomerRecord | null) ?? null;
}

export async function findCustomerById(tenantId: string, customerId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("customers")
    .select(CUSTOMER_SELECT)
    .eq("tenant_id", tenantId)
    .eq("id", customerId)
    .eq("is_active", true)
    .maybeSingle();

  return (data as CustomerRecord | null) ?? null;
}

export async function updateCustomerForTenant(input: {
  tenantId: string;
  customerId: string;
  name?: string | null;
  whatsapp?: string | null;
  legalName?: string | null;
  tradeName?: string | null;
  email?: string | null;
  document?: string | null;
  documentType?: "cpf" | "cnpj" | null;
  stateRegistration?: string | null;
  municipalRegistration?: string | null;
  postalCode?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  contactPhone1?: string | null;
  contactPhone2?: string | null;
  gender?: string | null;
  birthDate?: string | null;
  isFleet?: boolean;
}) {
  const supabase = await createSupabaseServerClient();
  const patch: Record<string, string | boolean | null> = {};

  if (input.name !== undefined) patch.name = input.name;
  if (input.whatsapp !== undefined) patch.whatsapp = input.whatsapp;
  if (input.legalName !== undefined) patch.legal_name = input.legalName;
  if (input.tradeName !== undefined) patch.trade_name = input.tradeName;
  if (input.email !== undefined) patch.email = input.email;
  if (input.document !== undefined) patch.document = input.document;
  if (input.documentType !== undefined) patch.document_type = input.documentType;
  if (input.stateRegistration !== undefined) patch.state_registration = input.stateRegistration;
  if (input.municipalRegistration !== undefined) patch.municipal_registration = input.municipalRegistration;
  if (input.postalCode !== undefined) patch.postal_code = input.postalCode;
  if (input.street !== undefined) patch.street = input.street;
  if (input.streetNumber !== undefined) patch.street_number = input.streetNumber;
  if (input.complement !== undefined) patch.complement = input.complement;
  if (input.neighborhood !== undefined) patch.neighborhood = input.neighborhood;
  if (input.city !== undefined) patch.city = input.city;
  if (input.state !== undefined) patch.state = input.state;
  if (input.contactPhone1 !== undefined) patch.contact_phone_1 = input.contactPhone1;
  if (input.contactPhone2 !== undefined) patch.contact_phone_2 = input.contactPhone2;
  if (input.gender !== undefined) patch.gender = input.gender;
  if (input.birthDate !== undefined) patch.birth_date = input.birthDate;
  if (input.isFleet !== undefined) patch.is_fleet = input.isFleet;
  if (input.whatsapp !== undefined || input.contactPhone1 !== undefined) {
    patch.phone_normalized = normalizeNationalPhone(input.whatsapp ?? input.contactPhone1 ?? null) || null;
  }

  const { data, error } = await supabase
    .from("customers")
    .update(patch)
    .eq("tenant_id", input.tenantId)
    .eq("id", input.customerId)
    .select(CUSTOMER_SELECT)
    .single();

  return { data: (data as CustomerRecord | null) ?? null, error: error as { message: string } | null };
}

export async function createCustomerForTenant(input: {
  tenantId: string;
  name: string;
  whatsapp: string | null;
  legalName?: string | null;
  tradeName?: string | null;
  email?: string | null;
  document?: string | null;
  documentType?: "cpf" | "cnpj" | null;
  stateRegistration?: string | null;
  municipalRegistration?: string | null;
  postalCode?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  contactPhone1?: string | null;
  contactPhone2?: string | null;
  gender?: string | null;
  birthDate?: string | null;
  isFleet?: boolean;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      tenant_id: input.tenantId,
      name: input.name,
      whatsapp: input.whatsapp,
      phone_normalized: normalizeNationalPhone(input.whatsapp ?? input.contactPhone1 ?? null) || null,
      legal_name: input.legalName ?? null,
      trade_name: input.tradeName ?? null,
      email: input.email ?? null,
      document: input.document ?? null,
      document_type: input.documentType ?? null,
      state_registration: input.stateRegistration ?? null,
      municipal_registration: input.municipalRegistration ?? null,
      postal_code: input.postalCode ?? null,
      street: input.street ?? null,
      street_number: input.streetNumber ?? null,
      complement: input.complement ?? null,
      neighborhood: input.neighborhood ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      contact_phone_1: input.contactPhone1 ?? null,
      contact_phone_2: input.contactPhone2 ?? null,
      ...(input.gender ? { gender: input.gender } : {}),
      ...(input.birthDate ? { birth_date: input.birthDate } : {}),
      is_fleet: input.isFleet ?? false,
      is_active: true,
    })
    .select(CUSTOMER_SELECT)
    .single();

  return { data: (data as CustomerRecord | null) ?? null, error: error as { message: string } | null };
}
