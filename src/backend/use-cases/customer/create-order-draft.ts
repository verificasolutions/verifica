import "server-only";
import { randomUUID } from "node:crypto";
import type { CustomerSessionIdentity } from "@/backend/auth/customer-session";
import { hashSessionToken } from "@/backend/auth/customer-session";
import { rpcCustomerDraftCreate } from "@/backend/repos/customer-admin-rpc-repo";
import { rpcCustomerListVehicles, rpcCustomerListServices } from "@/backend/repos/customer-rpc-repo";

/**
 * Cria a tentativa retida no servidor (draft): vincula tenant+customer+vehicle+session,
 * service_ids, reward_id e idempotency_key. A confirmação consome o draft (uso único) e
 * a RPC recalcula preço/duração — nenhum valor enviado pelo cliente é confiado.
 */
export async function createOrderDraftUseCase(input: {
  token: string;
  customer: CustomerSessionIdentity;
  vehicleId: string;
  serviceIds: string[];
  rewardId?: string | null;
}) {
  const vehicles = await rpcCustomerListVehicles(input.token);
  const vehicle = (vehicles.data ?? []).find((item) => item.id === input.vehicleId);
  if (!vehicle) {
    return { error: "Veículo inválido." };
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
  if (selected.filter((item) => item.kind === "main").length !== 1) {
    return { error: "Selecione exatamente 1 serviço principal." };
  }

  const idempotencyKey = randomUUID();
  const draft = await rpcCustomerDraftCreate({
    tenantId: input.customer.tenantId,
    customerId: input.customer.customerId,
    vehicleId: input.vehicleId,
    kind: "order",
    serviceIds: uniqueServiceIds,
    rewardId: input.rewardId ?? null,
    idempotencyKey,
    sessionTokenHash: hashSessionToken(input.token),
    expiresAt: new Date(Date.now() + 900 * 1000).toISOString(),
  });

  if (draft.error || !draft.data) {
    return { error: "Não foi possível iniciar a contratação. Tente novamente." };
  }

  return { data: { draftId: draft.data } };
}
