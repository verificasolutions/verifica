import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSaoPauloDayRange } from "@/backend/shared/date-range";
import type { CashEntryRecord, CashSessionRecord } from "@/backend/types";

export async function getOpenCashSession(tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("cash_sessions")
    .select("id, tenant_id, opened_at, closed_at, opening_balance, closing_balance, status")
    .eq("tenant_id", tenantId)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data
    ? ({
        ...(data as CashSessionRecord),
        opening_balance: Number((data as CashSessionRecord).opening_balance ?? 0),
        closing_balance: data?.closing_balance === null ? null : Number((data as CashSessionRecord).closing_balance ?? 0),
      } as CashSessionRecord)
    : null;
}

export async function listCashEntriesForOpenDay(tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const session = await getOpenCashSession(tenantId);
  if (!session) return [];

  const { data } = await supabase
    .from("cash_entries")
    .select("id, tenant_id, kind, payment_method, description, amount, effective_date, settlement_status, card_kind, created_at")
    .eq("tenant_id", tenantId)
    .eq("cash_session_id", session.id)
    .eq("settlement_status", "settled")
    .order("created_at", { ascending: false });

  return ((data ?? []) as CashEntryRecord[]).map((item) => ({
    ...item,
    amount: Number(item.amount ?? 0),
  }));
}

export async function listCashEntriesForCurrentMonth(tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  const { data } = await supabase
    .from("cash_entries")
    .select("id, tenant_id, kind, payment_method, description, amount, effective_date, settlement_status, card_kind, created_at")
    .eq("tenant_id", tenantId)
    .gte("effective_date", monthStart)
    .lte("effective_date", monthEnd)
    .order("effective_date", { ascending: false })
    .order("created_at", { ascending: false });

  return ((data ?? []) as CashEntryRecord[]).map((item) => ({
    ...item,
    amount: Number(item.amount ?? 0),
  }));
}

export async function updateCashEntryForTenant(input: {
  tenantId: string;
  cashEntryId: string;
  cashSessionId?: string | null;
  paymentMethod?: "cash" | "pix" | "card" | "pending" | null;
}) {
  const supabase = await createSupabaseServerClient();
  const patch: Record<string, unknown> = {};
  if (input.cashSessionId !== undefined) patch.cash_session_id = input.cashSessionId;
  if (input.paymentMethod !== undefined) patch.payment_method = input.paymentMethod;

  const { error } = await supabase
    .from("cash_entries")
    .update(patch)
    .eq("tenant_id", input.tenantId)
    .eq("id", input.cashEntryId);

  return error as { message: string } | null;
}

export async function deleteCashEntryForTenant(input: {
  tenantId: string;
  cashEntryId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("cash_entries")
    .delete()
    .eq("tenant_id", input.tenantId)
    .eq("id", input.cashEntryId);

  return error as { message: string } | null;
}

export async function openCashSessionForTenant(input: {
  tenantId: string;
  openedBy: string;
  openingBalance: number;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("cash_sessions").insert({
    tenant_id: input.tenantId,
    opened_by: input.openedBy,
    opening_balance: input.openingBalance,
    status: "open",
  });
  return error as { message: string } | null;
}

export async function createCashEntryForTenant(input: {
  tenantId: string;
  cashSessionId: string | null;
  kind: "income" | "expense";
  paymentMethod: "cash" | "pix" | "card" | "pending" | null;
  description: string;
  amount: number;
  createdBy: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("cash_entries").insert({
    tenant_id: input.tenantId,
    cash_session_id: input.cashSessionId,
    kind: input.kind,
    payment_method: input.paymentMethod,
    description: input.description,
    amount: input.amount,
    created_by: input.createdBy,
  });
  return error as { message: string } | null;
}

export async function createCashEntryRecordForTenant(input: {
  tenantId: string;
  cashSessionId: string | null;
  kind: "income" | "expense";
  paymentMethod: "cash" | "pix" | "card" | "pending" | null;
  description: string;
  amount: number;
  createdBy: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cash_entries")
    .insert({
      tenant_id: input.tenantId,
      cash_session_id: input.cashSessionId,
      kind: input.kind,
      payment_method: input.paymentMethod,
      description: input.description,
      amount: input.amount,
      created_by: input.createdBy,
    })
    .select("id, tenant_id, kind, payment_method, description, amount, created_at")
    .single();

  return {
    data: data
      ? ({
          ...(data as CashEntryRecord),
          amount: Number((data as CashEntryRecord).amount ?? 0),
        } as CashEntryRecord)
      : null,
    error: error as { message: string } | null,
  };
}

export async function closeCashSessionForTenant(input: {
  tenantId: string;
  cashSessionId: string;
  closedBy: string;
  closingBalance: number;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("cash_sessions")
    .update({
      closed_by: input.closedBy,
      closed_at: new Date().toISOString(),
      closing_balance: input.closingBalance,
      status: "closed",
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.cashSessionId);

  return error as { message: string } | null;
}
