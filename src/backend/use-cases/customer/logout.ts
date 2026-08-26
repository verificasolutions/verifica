import "server-only";
import { hashSessionToken } from "@/backend/auth/customer-session";
import { rpcCustomerSessionRevoke } from "@/backend/repos/customer-admin-rpc-repo";

/** Logout: revoga a sessão e grava customer.session_revoked na MESMA transação (RPC). */
export async function logoutCustomerUseCase(input: { token: string }) {
  const result = await rpcCustomerSessionRevoke(hashSessionToken(input.token));
  if (result.error) {
    throw new Error("Falha ao encerrar a sessão.");
  }
}
