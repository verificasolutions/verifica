/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  LeadEmailSequenceEnrollmentRecord,
  LeadEmailSequenceRecord,
  LeadEmailSequenceStepRecord,
} from "@/backend/types";

function mapSequence(row: any): LeadEmailSequenceRecord {
  return {
    id: row.id,
    sequence_key: row.sequence_key,
    name: row.name,
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapStep(row: any): LeadEmailSequenceStepRecord {
  return {
    id: row.id,
    sequence_id: row.sequence_id,
    step_number: Number(row.step_number ?? 0),
    subject: row.subject ?? null,
    body_text: row.body_text ?? null,
    image_url: row.image_url ?? null,
    delay_days: Number(row.delay_days ?? 7),
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapEnrollment(row: any): LeadEmailSequenceEnrollmentRecord {
  return {
    id: row.id,
    lead_company_id: row.lead_company_id,
    sequence_id: row.sequence_id,
    current_step: Number(row.current_step ?? 0),
    next_send_at: row.next_send_at ?? null,
    last_sent_at: row.last_sent_at ?? null,
    status: row.status,
    last_error: row.last_error ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getLeadEmailSequenceByKeyAdmin(sequenceKey: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("lead_email_sequences")
    .select("*")
    .eq("sequence_key", sequenceKey)
    .maybeSingle();

  return data ? mapSequence(data) : null;
}

export async function listLeadEmailSequenceStepsAdmin(sequenceId: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("lead_email_sequence_steps")
    .select("*")
    .eq("sequence_id", sequenceId)
    .order("step_number", { ascending: true });

  return ((data ?? []) as any[]).map(mapStep);
}

export async function getLeadEmailSequenceStepAdmin(sequenceId: string, stepNumber: number) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("lead_email_sequence_steps")
    .select("*")
    .eq("sequence_id", sequenceId)
    .eq("step_number", stepNumber)
    .maybeSingle();

  return data ? mapStep(data) : null;
}

export async function upsertLeadEmailSequenceStepsAdmin(input: {
  sequenceId: string;
  steps: Array<{
    stepNumber: number;
    subject: string | null;
    bodyText: string | null;
    imageUrl: string | null;
    delayDays: number;
    isActive: boolean;
  }>;
}) {
  const admin = createSupabaseAdminClient() as any;
  const payload = input.steps.map((step) => ({
    sequence_id: input.sequenceId,
    step_number: step.stepNumber,
    subject: step.subject,
    body_text: step.bodyText,
    image_url: step.imageUrl,
    delay_days: step.delayDays,
    is_active: step.isActive,
  }));

  const { error } = await admin.from("lead_email_sequence_steps").upsert(payload, {
    onConflict: "sequence_id,step_number",
  });

  return error as { message: string } | null;
}

export async function getLeadEmailSequenceEnrollmentAdmin(leadCompanyId: string, sequenceId: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("lead_email_sequence_enrollments")
    .select("*")
    .eq("lead_company_id", leadCompanyId)
    .eq("sequence_id", sequenceId)
    .maybeSingle();

  return data ? mapEnrollment(data) : null;
}

export async function listLeadEmailSequenceEnrollmentsAdmin(sequenceId: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("lead_email_sequence_enrollments")
    .select("*")
    .eq("sequence_id", sequenceId)
    .order("created_at", { ascending: false });

  return ((data ?? []) as any[]).map(mapEnrollment);
}

export async function listDueLeadEmailSequenceEnrollmentsAdmin(sequenceId: string, limit = 50) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("lead_email_sequence_enrollments")
    .select("*")
    .eq("sequence_id", sequenceId)
    .eq("status", "active")
    .not("next_send_at", "is", null)
    .lte("next_send_at", new Date().toISOString())
    .order("next_send_at", { ascending: true })
    .limit(limit);

  return ((data ?? []) as any[]).map(mapEnrollment);
}

export async function upsertLeadEmailSequenceEnrollmentAdmin(input: {
  leadCompanyId: string;
  sequenceId: string;
  currentStep: number;
  nextSendAt?: string | null;
  lastSentAt?: string | null;
  status: LeadEmailSequenceEnrollmentRecord["status"];
  lastError?: string | null;
}) {
  const admin = createSupabaseAdminClient() as any;
  const { data, error } = await admin
    .from("lead_email_sequence_enrollments")
    .upsert(
      {
        lead_company_id: input.leadCompanyId,
        sequence_id: input.sequenceId,
        current_step: input.currentStep,
        next_send_at: input.nextSendAt ?? null,
        last_sent_at: input.lastSentAt ?? null,
        status: input.status,
        last_error: input.lastError ?? null,
      },
      { onConflict: "lead_company_id,sequence_id" },
    )
    .select("*")
    .single();

  return { data: data ? mapEnrollment(data) : null, error: error as { message: string } | null };
}
