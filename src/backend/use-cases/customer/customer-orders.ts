import "server-only";
import { rpcCustomerOrders } from "@/backend/repos/customer-rpc-repo";

/**
 * Ordens do cliente SEM dados financeiros (nunca total gasto/acumulado).
 * O valor da contratação atual só é retornado no fluxo de confirmação.
 */
export async function listCustomerOrdersUseCase(input: { token: string; vehicleId: string }) {
  const result = await rpcCustomerOrders({ token: input.token, vehicleId: input.vehicleId });

  if (result.error) {
    return { error: "Não foi possível carregar as ordens." };
  }

  return { data: result.data };
}
