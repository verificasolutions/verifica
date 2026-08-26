import "server-only";
import { rpcCustomerListServices } from "@/backend/repos/customer-rpc-repo";

export async function listCustomerCatalogUseCase(input: { token: string }) {
  const result = await rpcCustomerListServices(input.token);

  if (result.error) {
    return { error: "Não foi possível carregar os serviços." };
  }

  return { data: result.data };
}
