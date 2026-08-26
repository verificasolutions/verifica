import "server-only";
import { getEntryToken } from "@/backend/repos/entry-tokens-repo";
import { findCustomerByPhoneAndPlate, findCustomerByPhoneNormalized, getCustomerCredential, recordCustomerFailedLogin, resetCustomerFailedAttempts } from "@/backend/repos/customer-auth-repo";
import { verifyPassword } from "@/backend/shared/password";
import { createSessionToken, hashSessionToken, getSessionTtlHours } from "@/backend/auth/customer-session";
import { rpcCustomerLinkVehicle, rpcCustomerSessionCreate } from "@/backend/repos/customer-admin-rpc-repo";
import { enforceRateLimit, getClientIp } from "@/backend/shared/rate-limit-policy";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export async function loginCustomerUseCase(input: {
  tenantId: string;
  entryToken: string;
  password: string;
  vehicleModel?: string;
  vehicleType?: string;
  vehicleColor?: string;
  userAgent?: string | null;
}) {
  const ip = await getClientIp();

  if (!input.entryToken || !input.password) {
    return { error: "Verifique seus dados." };
  }

  await enforceRateLimit({ tenantId: input.tenantId, key: `login:ip:${ip}`, limit: 10, windowSeconds: 300 });

  // telefone/placa vêm do entry token (registro server-side), não do formulário
  const entry = await getEntryToken({ token: input.entryToken, tenantId: input.tenantId });
  if (!entry) {
    return { error: "Sessão expirada. Volte e tente novamente." };
  }

  await enforceRateLimit({
    tenantId: input.tenantId,
    key: `login:phone:${entry.phone_normalized}`,
    limit: 5,
    windowSeconds: 600,
  });

  const customer = await findCustomerByPhoneNormalized(input.tenantId, entry.phone_normalized);
  if (!customer) {
    return { error: "Verifique seus dados." };
  }

  const credential = await getCustomerCredential(customer.id);
  if (!credential) {
    return { error: "Verifique seus dados." };
  }

  if (credential.locked_until && new Date(credential.locked_until).getTime() > Date.now()) {
    return { error: "Muitas tentativas. Tente novamente mais tarde." };
  }

  const ok = await verifyPassword(input.password, credential.password_hash);
  if (!ok) {
    const failed = await recordCustomerFailedLogin(customer.id, MAX_ATTEMPTS, LOCK_MINUTES);
    return {
      error: failed.lockedUntil ? "Muitas tentativas. Tente novamente mais tarde." : "Verifique seus dados.",
    };
  }

  await resetCustomerFailedAttempts(customer.id);

  const existingVehicle = await findCustomerByPhoneAndPlate(input.tenantId, entry.phone_normalized, entry.plate_normalized);
  if (!existingVehicle && (!input.vehicleModel?.trim() || !input.vehicleType?.trim() || !input.vehicleColor?.trim())) {
    return { error: "Informe os dados do novo veículo para continuar." };
  }

  // sessão + audit customer.login + consumo do entry token na MESMA transação (RPC service_role)
  const rawToken = createSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const ttlHours = getSessionTtlHours();
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();

  const session = await rpcCustomerSessionCreate({
    tenantId: input.tenantId,
    customerId: customer.id,
    tokenHash,
    expiresAt,
    ip,
    userAgent: input.userAgent ?? null,
    entryTokenId: entry.id,
  });

  if (session.error || !session.data) {
    return { error: "Não foi possível iniciar a sessão. Tente novamente." };
  }

  if (!existingVehicle) {
    const linked = await rpcCustomerLinkVehicle({
      tokenHash,
      plate: entry.plate_normalized,
      model: input.vehicleModel!.trim(),
      color: input.vehicleColor!.trim(),
      vehicleType: input.vehicleType!.trim(),
      vehicleSource: "portal",
    });

    if (linked.error) {
      return { error: "Senha validada, mas não foi possível cadastrar o novo veículo. Tente novamente." };
    }
  }

  return { data: { token: rawToken, expiresAt } };
}
