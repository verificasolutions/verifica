/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PaymentIntentRecord } from "@/backend/types";

const PAYMENT_INTENT_SELECT = `
  id, tenant_id, customer_id, attendance_id, amount, status, payment_method,
  provider, provider_reference, idempotency_key, succeeded_at, failed_at,
  refunded_at, canceled_at, error_message, metadata, created_at, created_ip
`;

export async function createPaymentIntent(input: {
  tenantId: string;
  customerId: string;
  attendanceId?: string | null;
  amount: number;
  status: PaymentIntentRecord["status"];
  paymentMethod?: PaymentIntentRecord["payment_method"];
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient() as any;
  const { data, error } = await admin
    .from("payment_intents")
    .insert({
      tenant_id: input.tenantId,
      customer_id: input.customerId,
      attendance_id: input.attendanceId ?? null,
      amount: input.amount,
      status: input.status,
      payment_method: input.paymentMethod ?? null,
      idempotency_key: input.idempotencyKey,
      metadata: input.metadata ?? {},
    })
    .select(PAYMENT_INTENT_SELECT)
    .single();

  return { data: (data as PaymentIntentRecord | null) ?? null, error: error as { message: string } | null };
}

export async function getPaymentIntentByAttendance(attendanceId: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("payment_intents")
    .select(PAYMENT_INTENT_SELECT)
    .eq("attendance_id", attendanceId)
    .maybeSingle();

  return (data as PaymentIntentRecord | null) ?? null;
}

export async function getPaymentIntentById(id: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin.from("payment_intents").select(PAYMENT_INTENT_SELECT).eq("id", id).maybeSingle();

  return (data as PaymentIntentRecord | null) ?? null;
}
