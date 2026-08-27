import "server-only";
import { randomUUID } from "node:crypto";
import type { CustomerSessionIdentity } from "@/backend/auth/customer-session";
import { hashSessionToken } from "@/backend/auth/customer-session";
import { getOpenOrderDraft, markOrderDraftUsed } from "@/backend/repos/order-drafts-repo";
import { rpcCustomerDraftCreate } from "@/backend/repos/customer-admin-rpc-repo";
import { rpcCustomerConfirmAppointment, rpcCustomerListVehicles, rpcCustomerListServices } from "@/backend/repos/customer-rpc-repo";
import { enforceRateLimit } from "@/backend/shared/rate-limit-policy";

export async function createAppointmentDraftUseCase(input: {
  token: string;
  customer: CustomerSessionIdentity;
  vehicleId: string;
  serviceIds: string[];
  scheduledFor: string;
}) {
  const vehicles = await rpcCustomerListVehicles(input.token);
  const vehicle = (vehicles.data ?? []).find((item) => item.id === input.vehicleId);
  if (!vehicle) {
    return { error: "Veículo inválido." };
  }

  const scheduled = new Date(input.scheduledFor);
  if (Number.isNaN(scheduled.getTime()) || scheduled.getTime() <= Date.now()) {
    return { error: "Escolha uma data e horário futuros." };
  }

  const uniqueServiceIds = [...new Set(input.serviceIds)];
  if (uniqueServiceIds.length === 0 || uniqueServiceIds.length > 4) {
    return { error: "Selecione 1 serviço principal e até 3 complementos." };
  }

  const services = await rpcCustomerListServices(input.token);
  const selected = services.data.filter((item) => uniqueServiceIds.includes(item.id));
  if (selected.length !== uniqueServiceIds.length) {
    return { error: "Serviço inválido ou inativo." };
  }
  if (selected.filter((item) => item.kind === "main").length < 1) {
    return { error: "Selecione ao menos 1 serviço principal." };
  }

  const idempotencyKey = randomUUID();
  const draft = await rpcCustomerDraftCreate({
    tenantId: input.customer.tenantId,
    customerId: input.customer.customerId,
    vehicleId: input.vehicleId,
    kind: "appointment",
    serviceIds: uniqueServiceIds,
    idempotencyKey,
    sessionTokenHash: hashSessionToken(input.token),
    expiresAt: new Date(Date.now() + 900 * 1000).toISOString(),
  });

  if (draft.error || !draft.data) {
    return { error: "Não foi possível iniciar o agendamento. Tente novamente." };
  }

  return { data: { draftId: draft.data } };
}

/**
 * Confirma o agendamento. A RPC revalida tudo server-side (ownership, tenant, serviços,
 * preço/duração, disponibilidade e conflito de horário) dentro da transação e grava o
 * evento appointment.created atomicamente.
 */
export async function confirmAppointmentUseCase(input: {
  token: string;
  customer: CustomerSessionIdentity;
  draftId: string;
  scheduledFor: string;
}) {
  const sessionTokenHash = hashSessionToken(input.token);
  const draft = await getOpenOrderDraft({ draftId: input.draftId, sessionTokenHash });

  if (!draft || draft.kind !== "appointment") {
    return { error: "Tentativa expirada ou inválida. Recomece o agendamento." };
  }

  await enforceRateLimit({
    tenantId: input.customer.tenantId,
    key: `appointment:customer:${input.customer.customerId}`,
    limit: 10,
    windowSeconds: 600,
  });

  const result = await rpcCustomerConfirmAppointment({
    token: input.token,
    vehicleId: draft.vehicle_id,
    serviceIds: draft.service_ids,
    scheduledFor: input.scheduledFor,
    idempotencyKey: draft.idempotency_key,
  });

  if (result.error || !result.data) {
    return { error: result.error?.message ?? "Não foi possível concluir o agendamento." };
  }

  await markOrderDraftUsed(draft.id);

  return { data: result.data };
}
