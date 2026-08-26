import "server-only";
import { rpcCustomerLoyaltySummary } from "@/backend/repos/customer-rpc-repo";

export async function getCustomerLoyaltySummaryUseCase(input: { token: string; vehicleId: string }) {
  const result = await rpcCustomerLoyaltySummary({ token: input.token, vehicleId: input.vehicleId });

  if (result.error) {
    return { error: "Não foi possível carregar a fidelidade." };
  }

  return { data: result.data };
}
