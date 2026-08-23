"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { approveServiceQuoteUseCase } from "@/backend/use-cases/tenant/approve-service-quote";
import { cancelAppointmentUseCase } from "@/backend/use-cases/tenant/cancel-appointment";
import {
  closeCashSessionUseCase,
  createCashEntryUseCase,
  openCashSessionUseCase,
  registerAttendanceDeliveryUseCase,
} from "@/backend/use-cases/tenant/cash-actions";
import { confirmAppointmentUseCase } from "@/backend/use-cases/tenant/confirm-appointment";
import { createAppointmentUseCase } from "@/backend/use-cases/tenant/create-appointment";
import { createAttendanceUseCase } from "@/backend/use-cases/tenant/create-attendance";
import { createCustomerUseCase } from "@/backend/use-cases/tenant/create-customer";
import { createEmployeeUseCase } from "@/backend/use-cases/tenant/create-employee";
import { createInventoryItemUseCase } from "@/backend/use-cases/tenant/create-inventory-item";
import { createInventoryShelfUseCase } from "@/backend/use-cases/tenant/create-inventory-shelf";
import { createOperationBoxUseCase } from "@/backend/use-cases/tenant/create-operation-box";
import { createServiceQuoteUseCase } from "@/backend/use-cases/tenant/create-service-quote";
import { createServiceUseCase } from "@/backend/use-cases/tenant/create-service";
import { createSupportTicketUseCase } from "@/backend/use-cases/tenant/create-support-ticket";
import { disconnectInstagramUseCase } from "@/backend/use-cases/tenant/disconnect-instagram";
import { endShiftUseCase } from "@/backend/use-cases/tenant/end-shift";
import { generateSocialAssetUseCase } from "@/backend/use-cases/tenant/generate-social-asset";
import { markDailyPayoutPaidUseCase } from "@/backend/use-cases/tenant/mark-daily-payout-paid";
import { moveAttendanceToBoxByTenantUseCase } from "@/backend/use-cases/tenant/move-attendance-to-box";
import { publishSocialAssetToInstagramUseCase } from "@/backend/use-cases/tenant/publish-social-asset-to-instagram";
import { quickInventoryEntryUseCase } from "@/backend/use-cases/tenant/quick-inventory-entry";
import { registerInventoryMovementUseCase } from "@/backend/use-cases/tenant/register-inventory-movement";
import { rescheduleAppointmentUseCase } from "@/backend/use-cases/tenant/reschedule-appointment";
import { saveEmployeeUseCase } from "@/backend/use-cases/tenant/save-employee";
import { saveOperationBoxesUseCase } from "@/backend/use-cases/tenant/save-operation-boxes";
import { saveTenantGrowthStepUseCase } from "@/backend/use-cases/tenant/save-tenant-growth-step";
import { saveTenantSettingsUseCase } from "@/backend/use-cases/tenant/save-settings";
import { sendWhatsappTestUseCase } from "@/backend/use-cases/tenant/send-whatsapp-test";
import { setEmployeeStateUseCase } from "@/backend/use-cases/tenant/set-employee-state";
import { startInstagramConnectUseCase } from "@/backend/use-cases/tenant/start-instagram-connect";
import { toggleAttendanceServiceItemUseCase } from "@/backend/use-cases/tenant/toggle-attendance-service-item";
import { toggleEmployeePresenceUseCase } from "@/backend/use-cases/tenant/toggle-employee-presence";
import { updateAttendanceStatusUseCase } from "@/backend/use-cases/tenant/update-attendance-status";
import { updateInventoryItemUseCase } from "@/backend/use-cases/tenant/update-inventory-item";
import { updateOperationBoxUseCase } from "@/backend/use-cases/tenant/update-operation-box";
import { updateServiceUseCase } from "@/backend/use-cases/tenant/update-service";
import { updateSocialAssetStatusUseCase } from "@/backend/use-cases/tenant/update-social-asset-status";

function resolveRedirectTarget(formData: FormData, fallback: string, message: string) {
  const requestedTarget = String(formData.get("redirect_to") ?? "").trim();
  const target =
    requestedTarget.startsWith("/app/dashboard") ||
    requestedTarget.startsWith("/operador/dashboard") ||
    requestedTarget === "/login" ||
    requestedTarget.startsWith("/admin")
      ? requestedTarget
      : fallback;
  const [base, hash = ""] = target.split("#", 2);
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}message=${encodeURIComponent(message)}${hash ? `#${hash}` : ""}`;
}

function resolveDashboardSuccessTarget(formData: FormData, message: string) {
  const requestedTarget = String(formData.get("redirect_to") ?? "").trim();
  const [path, query = ""] = requestedTarget.split("?");

  if (!path.startsWith("/app/dashboard")) {
    return `/app/dashboard?message=${encodeURIComponent(message)}`;
  }

  const params = new URLSearchParams(query);
  params.delete("drawer");
  params.delete("error");
  params.delete("message");

  const nextQuery = params.toString();
  return `${path}${nextQuery ? `?${nextQuery}&` : "?"}message=${encodeURIComponent(message)}`;
}

export async function createInventoryShelfAction(formData: FormData) {
  await createInventoryShelfUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard?section=estoque", "Estante criada."));
}

export async function createInventoryItemAction(formData: FormData) {
  await createInventoryItemUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard?section=estoque", "Item de estoque cadastrado."));
}

export async function updateInventoryItemAction(formData: FormData) {
  await updateInventoryItemUseCase(formData);
  revalidatePath("/app/dashboard");
  const shelfId = String(formData.get("shelf_id") ?? "").trim();
  redirect(`/app/dashboard?section=estoque&shelfId=${encodeURIComponent(shelfId)}&message=${encodeURIComponent("Item atualizado.")}`);
}

export async function quickInventoryEntryAction(formData: FormData) {
  await quickInventoryEntryUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard?section=estoque", "Entrada registrada no estoque."));
}

export async function registerInventoryMovementAction(formData: FormData) {
  await registerInventoryMovementUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard?section=estoque", "Movimentação registrada."));
}

export async function createServiceAction(formData: FormData) {
  await createServiceUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard?section=adm&panel=services", "Serviço criado."));
}

export async function updateServiceAction(formData: FormData) {
  await updateServiceUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard?section=adm&panel=services", "Serviço atualizado."));
}

export async function createAttendanceAction(formData: FormData) {
  await createAttendanceUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveDashboardSuccessTarget(formData, "Atendimento criado e enviado para fila."));
}

export async function createCustomerAction(formData: FormData) {
  const customer = await createCustomerUseCase(formData);
  revalidatePath("/app/dashboard");
  const intent = String(formData.get("submit_intent") ?? "save").trim();

  if (intent === "quote" && customer?.id) {
    redirect(`/app/dashboard?section=clientes&customer=${encodeURIComponent(customer.id)}&quoteForm=1&message=${encodeURIComponent("Cliente cadastrado. Agora preencha o orçamento.")}`);
  }

  if (customer?.id) {
    redirect(`/app/dashboard?section=clientes&customer=${encodeURIComponent(customer.id)}&message=${encodeURIComponent("Cliente cadastrado.")}`);
  }

  redirect(resolveRedirectTarget(formData, "/app/dashboard?section=clientes", "Cliente cadastrado."));
}

export async function createServiceQuoteAction(formData: FormData) {
  await createServiceQuoteUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard?section=clientes", "Orçamento salvo."));
}

export async function approveServiceQuoteAction(formData: FormData) {
  await approveServiceQuoteUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard?section=clientes", "Orçamento aprovado e enviado para entrada."));
}

export async function updateAttendanceStatusAction(formData: FormData) {
  await updateAttendanceStatusUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard", "Status atualizado."));
}

export async function toggleAttendanceServiceItemAction(formData: FormData) {
  await toggleAttendanceServiceItemUseCase(formData);
  revalidatePath("/app/dashboard");
  revalidatePath("/operador/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard", "Serviço do atendimento atualizado."));
}

export async function createEmployeeAction(formData: FormData) {
  await createEmployeeUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard?section=adm&panel=employees", "Funcionário criado."));
}

export async function saveEmployeeAction(formData: FormData) {
  await saveEmployeeUseCase(formData);
  revalidatePath("/app/dashboard");
}

export async function setEmployeeStateAction(formData: FormData) {
  await setEmployeeStateUseCase(formData);
  revalidatePath("/app/dashboard");
}

export async function createSupportTicketAction(formData: FormData) {
  await createSupportTicketUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard?section=suporte", "Ticket enviado ao suporte."));
}

export async function toggleEmployeePresenceAction(formData: FormData) {
  await toggleEmployeePresenceUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard?section=adm&panel=employees", "Presença atualizada."));
}

export async function createOperationBoxAction(formData: FormData) {
  await createOperationBoxUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard?section=adm&panel=settings", "Box operacional criado."));
}

export async function updateOperationBoxAction(formData: FormData) {
  await updateOperationBoxUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard?section=adm&panel=settings", "Box operacional atualizado."));
}

export async function saveOperationBoxesAction(formData: FormData) {
  await saveOperationBoxesUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard?section=adm&panel=settings#boxes-cadastrados", "Boxes atualizados."));
}

export async function createAppointmentAction(formData: FormData) {
  await createAppointmentUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard", "Agendamento criado."));
}

export async function cancelAppointmentAction(formData: FormData) {
  await cancelAppointmentUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard", "Agendamento cancelado."));
}

export async function confirmAppointmentAction(formData: FormData) {
  await confirmAppointmentUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard", "Chegada confirmada e atendimento enviado para entrada."));
}

export async function rescheduleAppointmentAction(formData: FormData) {
  await rescheduleAppointmentUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard", "Agendamento reagendado."));
}

export async function openCashSessionAction(formData: FormData) {
  await openCashSessionUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard?section=caixa", "Caixa aberto."));
}

export async function createCashEntryAction(formData: FormData) {
  await createCashEntryUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard?section=caixa", "Lançamento registrado."));
}

export async function createCashExpenseAction(formData: FormData) {
  const category = String(formData.get("entry_category") ?? "").trim();

  if (category === "daily_payout") {
    await markDailyPayoutPaidUseCase(formData);
    revalidatePath("/app/dashboard");
    redirect(resolveRedirectTarget(formData, "/app/dashboard?section=caixa", "Diária marcada como paga."));
  }

  await createCashEntryUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard?section=caixa", "Saída registrada."));
}

export async function registerAttendanceDeliveryAction(formData: FormData) {
  await registerAttendanceDeliveryUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard?section=caixa", "Retirada registrada."));
}

export async function moveAttendanceToNextBoxAction(formData: FormData) {
  await moveAttendanceToBoxByTenantUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard", "Atendimento movido para a próxima etapa."));
}

export async function markDailyPayoutPaidAction(formData: FormData) {
  await markDailyPayoutPaidUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard?section=caixa", "Diária marcada como paga."));
}

export async function closeCashSessionAction(formData: FormData) {
  await closeCashSessionUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard?section=caixa", "Caixa fechado."));
}

export async function endShiftAction(formData: FormData) {
  await endShiftUseCase();
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/login", "Expediente encerrado e usuários desconectados."));
}

export async function saveTenantSettingsAction(formData: FormData) {
  await saveTenantSettingsUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard?section=adm&panel=settings", "Configurações salvas."));
}

export async function saveTenantGrowthStepAction(formData: FormData) {
  await saveTenantGrowthStepUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard?section=crescendo", "Etapa de crescimento salva."));
}

export async function sendWhatsappTestAction(formData: FormData) {
  await sendWhatsappTestUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard?section=adm&panel=whatsapp", "Teste de WhatsApp enviado."));
}

export async function generateSocialAssetAction(formData: FormData) {
  await generateSocialAssetUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard?section=adm&panel=social", "Peça social gerada."));
}

export async function updateSocialAssetStatusAction(formData: FormData) {
  await updateSocialAssetStatusUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect(resolveRedirectTarget(formData, "/app/dashboard?section=adm&panel=social", "Status da peça atualizado."));
}

export async function startInstagramConnectAction() {
  await startInstagramConnectUseCase();
}

export async function disconnectInstagramAction() {
  await disconnectInstagramUseCase();
  revalidatePath("/app/dashboard");
  redirect("/app/dashboard?section=adm&panel=social&message=Instagram desconectado.");
}

export async function publishSocialAssetToInstagramAction(formData: FormData) {
  await publishSocialAssetToInstagramUseCase(formData);
  revalidatePath("/app/dashboard");
  redirect("/app/dashboard?section=adm&panel=social&message=Peça enviada para o Instagram.");
}
