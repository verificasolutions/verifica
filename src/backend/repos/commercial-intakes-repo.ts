/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CommercialIntakePaymentStatus, CommercialIntakeRecord, CommercialIntakeStatus } from "@/backend/types";

function mapCommercialIntake(row: any): CommercialIntakeRecord {
  return {
    id: row.id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    full_name: row.full_name,
    email: row.email,
    whatsapp: row.whatsapp,
    contact_phone: row.contact_phone ?? null,
    legal_name: row.legal_name ?? null,
    trade_name: row.trade_name ?? null,
    document: row.document,
    document_type: row.document_type,
    state_registration: row.state_registration ?? null,
    municipal_registration: row.municipal_registration ?? null,
    postal_code: row.postal_code,
    street: row.street,
    street_number: row.street_number,
    complement: row.complement ?? null,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state,
    current_situation: row.current_situation ?? null,
    selected_plan_code: row.selected_plan_code,
    selected_plan_name: row.selected_plan_name,
    implementation_fee: row.implementation_fee === null || row.implementation_fee === undefined ? null : Number(row.implementation_fee),
    recurring_fee: row.recurring_fee === null || row.recurring_fee === undefined ? null : Number(row.recurring_fee),
    contract_version: row.contract_version,
    contract_title: row.contract_title,
    contract_body: row.contract_body,
    contract_accepted: Boolean(row.contract_accepted),
    contract_accepted_at: row.contract_accepted_at ?? null,
    status: row.status,
    payment_status: row.payment_status,
    payment_confirmed_at: row.payment_confirmed_at ?? null,
    contract_email_sent_at: row.contract_email_sent_at ?? null,
    contract_email_error: row.contract_email_error ?? null,
    internal_notes: row.internal_notes ?? null,
    metadata: typeof row.metadata === "object" && row.metadata ? row.metadata : {},
  };
}

export async function createCommercialIntake(input: Omit<CommercialIntakeRecord, "id" | "created_at" | "updated_at" | "contract_email_sent_at" | "contract_email_error" | "payment_confirmed_at" | "internal_notes">) {
  const admin = createSupabaseAdminClient() as any;
  const { data, error } = await admin
    .from("commercial_intakes")
    .insert({
      ...input,
      implementation_fee: input.implementation_fee,
      recurring_fee: input.recurring_fee,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapCommercialIntake(data);
}

export async function findCommercialIntakeById(id: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin.from("commercial_intakes").select("*").eq("id", id).maybeSingle();
  return data ? mapCommercialIntake(data) : null;
}

export async function listCommercialIntakesAdmin() {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin.from("commercial_intakes").select("*").order("created_at", { ascending: false }).limit(200);
  return ((data ?? []) as any[]).map(mapCommercialIntake);
}

export async function updateCommercialIntakeStatusAdmin(input: {
  id: string;
  status?: CommercialIntakeStatus;
  payment_status?: CommercialIntakePaymentStatus;
  payment_confirmed_at?: string | null;
  contract_email_sent_at?: string | null;
  contract_email_error?: string | null;
  internal_notes?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient() as any;
  const patch: Record<string, unknown> = {};
  if (input.status !== undefined) patch.status = input.status;
  if (input.payment_status !== undefined) patch.payment_status = input.payment_status;
  if (input.payment_confirmed_at !== undefined) patch.payment_confirmed_at = input.payment_confirmed_at;
  if (input.contract_email_sent_at !== undefined) patch.contract_email_sent_at = input.contract_email_sent_at;
  if (input.contract_email_error !== undefined) patch.contract_email_error = input.contract_email_error;
  if (input.internal_notes !== undefined) patch.internal_notes = input.internal_notes;
  if (input.metadata !== undefined) patch.metadata = input.metadata;

  const { data, error } = await admin.from("commercial_intakes").update(patch).eq("id", input.id).select("*").single();
  if (error) throw new Error(error.message);
  return mapCommercialIntake(data);
}
