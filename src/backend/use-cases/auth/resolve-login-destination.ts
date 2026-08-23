import "server-only";
import { resolveAccessContext } from "@/backend/auth/access-context";

export async function resolveLoginDestinationUseCase() {
  const context = await resolveAccessContext();

  if (context.kind === "platform_admin") {
    return "/admin";
  }

  if (context.kind === "tenant_user") {
    return context.role === "operator" ? "/operador/dashboard" : "/app/dashboard";
  }

  return "/setup";
}
