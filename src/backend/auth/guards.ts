import "server-only";
import { redirect } from "next/navigation";
import { resolveAccessContext } from "@/backend/auth/access-context";
import { getCustomerSessionTokenFromCookies, validateCustomerSession } from "@/backend/auth/customer-session";

export async function requirePlatformAdmin() {
  const context = await resolveAccessContext();

  if (context.kind !== "platform_admin") {
    redirect("/login");
  }

  return context;
}

export async function requireTenantUser() {
  const context = await resolveAccessContext();

  if (context.kind !== "tenant_user") {
    redirect("/login");
  }

  return context;
}

export async function requireOwnerOrManager() {
  const context = await requireTenantUser();

  if (context.role === "operator") {
    redirect("/operador/dashboard");
  }

  return context;
}

export async function requireOperator() {
  const context = await requireTenantUser();

  if (context.role !== "operator") {
    redirect("/app/dashboard");
  }

  return context;
}

export async function routeByAccessContext() {
  const context = await resolveAccessContext();

  if (context.kind === "anonymous") {
    redirect("/login");
  }

  if (context.kind === "platform_admin") {
    redirect("/admin");
  }

  if (context.role === "operator") {
    redirect("/operador/dashboard");
  }

  redirect("/app/dashboard");
}

export async function requireCustomer() {
  const token = await getCustomerSessionTokenFromCookies();
  const customer = await validateCustomerSession(token);

  if (!customer) {
    redirect("/verifica/cliente/entrar");
  }

  return { token: token as string, customer };
}
