import "server-only";
import type { CustomerSessionIdentity } from "@/backend/auth/customer-session";
import { hashSessionToken } from "@/backend/auth/customer-session";
import { getOpenOrderDraft, markOrderDraftUsed } from "@/backend/repos/order-drafts-repo";
import { rpcCustomerConfirmOrder } from "@/backend/repos/customer-rpc-repo";
import { enforceRateLimit } from "@/backend/shared/rate-limit-policy";

/**
 * Confirmação ("Dar OK"): consome o draft da sessão e chama a RPC idempotente.
 * O evento order.created é gravado atomicamente dentro da RPC (mesma transação).
 */
export async function confirmOrderUseCase(input: {
  token: string;
  customer: CustomerSessionIdentity;
  draftId: string;
}) {
  const sessionTokenHash = hashSessionToken(input.token);
  const draft = await getOpenOrderDraft({ draftId: input.draftId, sessionTokenHash });

  if (!draft || draft.kind !== "order") {
    return { error: "Tentativa expirada ou inválida. Recomece a contratação." };
  }

  await enforceRateLimit({
    tenantId: input.customer.tenantId,
    key: `order:customer:${input.customer.customerId}`,
    limit: 10,
    windowSeconds: 600,
  });

  const result = await rpcCustomerConfirmOrder({
    token: input.token,
    vehicleId: draft.vehicle_id,
    serviceIds: draft.service_ids,
    idempotencyKey: draft.idempotency_key,
    rewardId: draft.reward_id,
  });

  if (result.error || !result.data) {
    return { error: result.error?.message ?? "Não foi possível concluir a contratação." };
  }

  await markOrderDraftUsed(draft.id);
  return { data: result.data };
}
