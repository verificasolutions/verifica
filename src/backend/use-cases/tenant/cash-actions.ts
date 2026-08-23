import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { createAttendancePublicStatus, findAttendanceForCashFlowById, updateAttendanceStatusForTenant } from "@/backend/repos/attendances-operations-repo";
import { getOpenCashSession, openCashSessionForTenant } from "@/backend/repos/cash-repo";
import { digitsOnly, parseCurrencyInput, registrationOnly } from "@/backend/shared/input-normalizers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function resolveCashRedirectTarget(formData: FormData) {
  const requestedTarget = String(formData.get("redirect_to") ?? "").trim();
  return requestedTarget.startsWith("/app/dashboard?section=caixa") ? requestedTarget : "/app/dashboard?section=caixa";
}

function redirectCashError(formData: FormData, message: string): never {
  const target = resolveCashRedirectTarget(formData);
  const separator = target.includes("?") ? "&" : "?";
  redirect(`${target}${separator}error=${encodeURIComponent(message)}`);
}

function buildCashEntryDescription(formData: FormData) {
  const category = String(formData.get("entry_category") ?? "").trim();
  const item = String(formData.get("item_name") ?? "").trim();
  const counterparty = String(formData.get("counterparty") ?? "").trim();
  const freeDescription = String(formData.get("description") ?? "").trim();

  const categoryLabels: Record<string, string> = {
    service: "Serviço",
    addon: "Adicional",
    extra: "Extra",
    other_income: "Outra entrada",
    supplies: "Insumo",
    supplier: "Fornecedor",
    lunch: "Alimentação",
    transport: "Transporte",
    other_expense: "Outra saída",
  };

  const parts = [categoryLabels[category] ?? "", item, counterparty].filter(Boolean);
  const composed = parts.join(" • ");

  if (freeDescription && composed) return `${composed} • ${freeDescription}`;
  return composed || freeDescription;
}

export async function openCashSessionUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const openingBalance = parseCurrencyInput(formData.get("opening_balance"));
  const current = await getOpenCashSession(context.tenantId);

  if (current) redirectCashError(formData, "Já existe caixa aberto.");

  const error = await openCashSessionForTenant({
    tenantId: context.tenantId,
    openedBy: context.userId,
    openingBalance: Number.isFinite(openingBalance) ? openingBalance : 0,
  });

  if (error) redirectCashError(formData, error.message);
}

export async function createCashEntryUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const kind = String(formData.get("kind") ?? "income") as "income" | "expense";
  const paymentMethod = String(formData.get("payment_method") ?? "cash") as "cash" | "pix" | "card" | "pending";
  const cardKind = String(formData.get("card_kind") ?? "").trim() || null;
  const attendanceId = String(formData.get("attendance_id") ?? "").trim() || null;
  const markDelivered = String(formData.get("mark_delivered") ?? "") === "true";
  const description = buildCashEntryDescription(formData);
  const identifierType = String(formData.get("identifier_type") ?? "").trim() as "whatsapp" | "plate" | "customer_name" | "";
  const identifierValueRaw = String(formData.get("identifier_value") ?? "").trim();
  const effectiveDate = String(formData.get("effective_date") ?? "").trim() || null;
  const amount = parseCurrencyInput(formData.get("amount"));

  if (!Number.isFinite(amount)) {
    redirectCashError(formData, "Dados inválidos para lançamento.");
  }

  const identifierValue =
    identifierType === "whatsapp" ? digitsOnly(identifierValueRaw) : identifierType === "plate" ? registrationOnly(identifierValueRaw) : identifierValueRaw;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_cash_entry_atomic", {
    p_tenant_id: context.tenantId,
    p_kind: kind,
    p_payment_method: paymentMethod,
    p_description: description || null,
    p_amount: amount,
    p_attendance_id: attendanceId,
    p_identifier_type: identifierType || null,
    p_identifier_value: identifierValue || null,
    p_effective_date: effectiveDate,
    p_card_kind: paymentMethod === "card" ? cardKind : null,
    p_mark_delivered: markDelivered,
  });

  if (error) redirectCashError(formData, error.message);
}

export async function registerAttendanceDeliveryUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const attendanceId = String(formData.get("attendance_id") ?? "").trim();

  if (!attendanceId) {
    redirectCashError(formData, "Veículo inválido para retirada.");
  }

  const attendance = await findAttendanceForCashFlowById({
    tenantId: context.tenantId,
    attendanceId,
  });

  if (!attendance) {
    redirectCashError(formData, "Não encontrei esse veículo para retirada.");
  }

  if (attendance.status === "delivered") {
    redirectCashError(formData, "Esse veículo já foi retirado.");
  }

  if (attendance.status !== "ready") {
    redirectCashError(formData, "O veículo ainda não está no card de retirada.");
  }

  if (attendance.payment_method === "pending") {
    redirectCashError(formData, "O pagamento ainda está pendente.");
  }

  const updated = await updateAttendanceStatusForTenant({
    attendanceId: attendance.id,
    status: "delivered",
  });

  if (updated.error || !updated.data) {
    redirectCashError(formData, updated.error?.message ?? "Falha ao registrar retirada.");
  }

  await createAttendancePublicStatus({
    attendanceId: updated.data.id,
    publicCode: updated.data.public_code,
    vehicleLabel: `${updated.data.vehicles?.model ?? "Veículo"}${updated.data.vehicles?.color ? ` ${updated.data.vehicles.color}` : ""}`.trim(),
    status: "delivered",
    etaMinutes: updated.data.estimated_minutes ?? 0,
    stepIndex: 5,
  });
}

export async function closeCashSessionUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("close_cash_session_atomic", {
    p_tenant_id: context.tenantId,
  });

  if (error) redirectCashError(formData, error.message);
}
