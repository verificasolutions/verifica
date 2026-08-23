import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ServiceQuoteRecord } from "@/backend/types";

const quoteSelect = `
  id,
  tenant_id,
  customer_id,
  vehicle_id,
  service_id,
  request_description,
  labor_description,
  labor_amount,
  parts_description,
  parts_amount,
  notes,
  status,
  approved_attendance_id,
  created_by,
  approved_by,
  approved_at,
  created_at,
  updated_at,
  vehicles(plate, brand, model, color, vehicle_type),
  services(name)
`;

type QuoteRow = Omit<ServiceQuoteRecord, "vehicles" | "services" | "labor_amount" | "parts_amount"> & {
  labor_amount: number | string;
  parts_amount: number | string;
  vehicles?:
    | { plate: string; brand: string | null; model: string; color: string | null; vehicle_type: string | null }[]
    | { plate: string; brand: string | null; model: string; color: string | null; vehicle_type: string | null }
    | null;
  services?: { name: string }[] | { name: string } | null;
};

function firstRelated<T>(value: T[] | T | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function normalizeQuote(row: QuoteRow): ServiceQuoteRecord {
  return {
    ...row,
    labor_amount: Number(row.labor_amount ?? 0),
    parts_amount: Number(row.parts_amount ?? 0),
    vehicles: firstRelated(row.vehicles) ?? null,
    services: firstRelated(row.services) ?? null,
  };
}

export async function listServiceQuotesByCustomer(tenantId: string, customerId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("service_quotes")
    .select(quoteSelect)
    .eq("tenant_id", tenantId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  return ((data ?? []) as QuoteRow[]).map(normalizeQuote);
}

export async function findServiceQuoteById(tenantId: string, quoteId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("service_quotes")
    .select(quoteSelect)
    .eq("tenant_id", tenantId)
    .eq("id", quoteId)
    .maybeSingle();

  return data ? normalizeQuote(data as QuoteRow) : null;
}

export async function createServiceQuoteForTenant(input: {
  tenantId: string;
  customerId: string;
  vehicleId?: string | null;
  serviceId: string;
  requestDescription: string;
  laborDescription?: string | null;
  laborAmount: number;
  partsDescription?: string | null;
  partsAmount: number;
  notes?: string | null;
  createdBy?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("service_quotes")
    .insert({
      tenant_id: input.tenantId,
      customer_id: input.customerId,
      vehicle_id: input.vehicleId ?? null,
      service_id: input.serviceId,
      request_description: input.requestDescription,
      labor_description: input.laborDescription ?? null,
      labor_amount: input.laborAmount,
      parts_description: input.partsDescription ?? null,
      parts_amount: input.partsAmount,
      notes: input.notes ?? null,
      created_by: input.createdBy ?? null,
    })
    .select(quoteSelect)
    .single();

  return {
    data: data ? normalizeQuote(data as QuoteRow) : null,
    error: error as { message: string } | null,
  };
}

export async function updateServiceQuoteForTenant(input: {
  tenantId: string;
  quoteId: string;
  status?: "draft" | "approved" | "rejected";
  approvedAttendanceId?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const patch: Record<string, string | null> = {};

  if (input.status !== undefined) patch.status = input.status;
  if (input.approvedAttendanceId !== undefined) patch.approved_attendance_id = input.approvedAttendanceId;
  if (input.approvedBy !== undefined) patch.approved_by = input.approvedBy;
  if (input.approvedAt !== undefined) patch.approved_at = input.approvedAt;

  const { data, error } = await supabase
    .from("service_quotes")
    .update(patch)
    .eq("tenant_id", input.tenantId)
    .eq("id", input.quoteId)
    .select(quoteSelect)
    .single();

  return {
    data: data ? normalizeQuote(data as QuoteRow) : null,
    error: error as { message: string } | null,
  };
}
