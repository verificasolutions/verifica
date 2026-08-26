/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { OrderDraftRecord } from "@/backend/types";

/** Leitura de draft aberto, vinculado à sessão que o criou (não consome). */
export async function getOpenOrderDraft(input: { draftId: string; sessionTokenHash: string }) {
  const admin = createSupabaseAdminClient() as any;
  const { data, error } = await admin
    .from("customer_order_drafts")
    .select("id, tenant_id, customer_id, vehicle_id, kind, service_ids, reward_id, idempotency_key, session_token_hash, status, expires_at, created_at, updated_at")
    .eq("id", input.draftId)
    .eq("session_token_hash", input.sessionTokenHash)
    .eq("status", "open")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;
  return data as OrderDraftRecord;
}

/** Marca o draft como usado somente após a confirmação ter sucesso. */
export async function markOrderDraftUsed(draftId: string) {
  const admin = createSupabaseAdminClient() as any;
  await admin.from("customer_order_drafts").update({ status: "used" }).eq("id", draftId).eq("status", "open");
}

export async function expireOrderDrafts() {
  const admin = createSupabaseAdminClient() as any;
  await admin
    .from("customer_order_drafts")
    .update({ status: "expired" })
    .eq("status", "open")
    .lt("expires_at", new Date().toISOString());
}
