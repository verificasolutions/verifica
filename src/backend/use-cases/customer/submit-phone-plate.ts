import "server-only";
import { normalizeNationalPhone } from "@/backend/shared/phone";
import { registrationOnly } from "@/backend/shared/input-normalizers";
import { createEntryToken } from "@/backend/repos/entry-tokens-repo";
import { findCustomerByPhoneAndPlate, findCustomerByPhoneNormalized, getCustomerCredential } from "@/backend/repos/customer-auth-repo";
import { enforceRateLimit, getClientIp } from "@/backend/shared/rate-limit-policy";

/**
 * Passo 2 — telefone + placa. Emite entry token de uso único vinculado a tenant+telefone+placa
 * e informa o MODO da próxima etapa: "login" quando já existe credencial para o telefone
 * (Entrar no portal) ou "register" no primeiro acesso (criar conta). Falhas de consulta
 * degradam para "register" (o backend continua sendo a fonte da verdade).
 */
export async function submitPhonePlateUseCase(input: { tenantId: string; phone: string; plate: string }) {
  const ip = await getClientIp();
  const phoneNormalized = normalizeNationalPhone(input.phone);
  const plateNormalized = registrationOnly(input.plate);

  if (!phoneNormalized) {
    return { error: "Informe um telefone válido." };
  }
  if (!plateNormalized) {
    return { error: "Informe uma placa válida." };
  }

  // rate limits em paralelo; criação do token + detecção de modo também em paralelo
  // (reduz o tempo total da requisição; falha de detecção degrada para "register")
  await Promise.all([
    enforceRateLimit({ tenantId: input.tenantId, key: `entry:ip:${ip}`, limit: 10, windowSeconds: 60 }),
    enforceRateLimit({ tenantId: input.tenantId, key: `entry:phone:${phoneNormalized}`, limit: 5, windowSeconds: 600 }),
  ]);

  async function detectMode(): Promise<"login" | "login_new_vehicle" | "first_access" | "register"> {
    try {
      const customer = await findCustomerByPhoneNormalized(input.tenantId, phoneNormalized);
      const credential = customer ? await getCustomerCredential(customer.id) : null;
      if (!customer) return "register";
      if (!credential) return "first_access";

      const vehicle = await findCustomerByPhoneAndPlate(input.tenantId, phoneNormalized, plateNormalized);
      return vehicle ? "login" : "login_new_vehicle";
    } catch {
      return "register";
    }
  }

  const [token, mode] = await Promise.all([createEntryToken({
    tenantId: input.tenantId,
    phoneNormalized,
    plateNormalized,
    ttlSeconds: 600,
  }), detectMode()]);

  if (!token) {
    return { error: "Não foi possível iniciar. Tente novamente." };
  }

  const customer = mode === "register" ? null : await findCustomerByPhoneNormalized(input.tenantId, phoneNormalized);
  const vehicle = customer ? await findCustomerByPhoneAndPlate(input.tenantId, phoneNormalized, plateNormalized) : null;

  return { data: { entryToken: token, phoneNormalized, plateNormalized, mode, vehicleExists: Boolean(vehicle) } };
}
