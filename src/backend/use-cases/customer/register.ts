import "server-only";
import { getEntryToken } from "@/backend/repos/entry-tokens-repo";
import { findCustomerByPhoneAndPlate, findCustomerByPhoneNormalized, getCustomerCredential, upsertCustomerCredential } from "@/backend/repos/customer-auth-repo";
import { hashPassword } from "@/backend/shared/password";
import { createSessionToken, hashSessionToken, getSessionTtlHours } from "@/backend/auth/customer-session";
import { rpcCustomerLinkVehicle, rpcCustomerRegister, rpcCustomerSessionCreate } from "@/backend/repos/customer-admin-rpc-repo";
import { enforceRateLimit, getClientIp } from "@/backend/shared/rate-limit-policy";

export async function registerCustomerUseCase(input: {
  tenantId: string;
  entryToken: string;
  firstName: string;
  lastName: string;
  vehicleModel: string;
  vehicleType: string;
  vehicleColor: string;
  password: string;
  userAgent?: string | null;
}) {
  const ip = await getClientIp();

  if (!input.entryToken || !input.password) {
    return { error: "Verifique seus dados." };
  }

  await enforceRateLimit({ tenantId: input.tenantId, key: `login:ip:${ip}`, limit: 10, windowSeconds: 300 });

  // o tenant nunca é escolhido pelo chamador anônimo: telefone/placa vêm do token
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

  const existing = await findCustomerByPhoneNormalized(input.tenantId, entry.phone_normalized);
  if (existing) {
    const credential = await getCustomerCredential(existing.id);
    if (credential) return { error: "Este telefone já possui senha. Entre usando a opção de login." };

    const existingVehicle = await findCustomerByPhoneAndPlate(input.tenantId, entry.phone_normalized, entry.plate_normalized);
    const needsVehicleData = !existingVehicle;
    if (needsVehicleData && (!input.vehicleModel.trim() || !input.vehicleType.trim() || !input.vehicleColor.trim())) {
      return { error: "Informe os dados do novo veículo para continuar." };
    }

    const passwordHash = await hashPassword(input.password);
    const credentialError = await upsertCustomerCredential({
      customerId: existing.id,
      tenantId: input.tenantId,
      passwordHash,
    });

    if (credentialError) return { error: "Não foi possível criar sua senha. Tente novamente." };

    const rawToken = createSessionToken();
    const tokenHash = hashSessionToken(rawToken);
    const ttlHours = getSessionTtlHours();
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
    const session = await rpcCustomerSessionCreate({
      tenantId: input.tenantId,
      customerId: existing.id,
      tokenHash,
      expiresAt,
      ip,
      userAgent: input.userAgent ?? null,
      entryTokenId: entry.id,
    });

    if (session.error || !session.data) return { error: "Não foi possível iniciar a sessão. Tente novamente." };

    if (needsVehicleData) {
      const linked = await rpcCustomerLinkVehicle({
        tokenHash,
        plate: entry.plate_normalized,
        model: input.vehicleModel.trim(),
        color: input.vehicleColor.trim(),
        vehicleType: input.vehicleType.trim(),
        vehicleSource: "portal",
      });
      if (linked.error) return { error: "Senha criada, mas não foi possível cadastrar o novo veículo. Tente novamente." };
    }

    return { data: { token: rawToken, expiresAt, vehicleLinked: !existingVehicle } };
  }

  if (!input.firstName.trim() || !input.lastName.trim() || !input.vehicleModel.trim() || !input.vehicleType.trim() || !input.vehicleColor.trim()) {
    return { error: "Preencha todos os dados do cadastro." };
  }

  // hash scrypt produzido no servidor; senha em texto nunca chega à RPC
  const passwordHash = await hashPassword(input.password);

  // RPC service_role: valida/consome o entry token server-side e cria cliente + credencial +
  // audit customer.register na MESMA transação (sem customer órfão). O veículo é criado
  // atomicamente quando a migration 20260909 existe; no remoto (customer_register 3 params)
  // ele é vinculado logo após a sessão via customer_link_vehicle.
  const registered = await rpcCustomerRegister({
    entryTokenHash: hashSessionToken(input.entryToken),
    name: `${input.firstName.trim()} ${input.lastName.trim()}`,
    vehicleModel: input.vehicleModel.trim(),
    vehicleType: input.vehicleType.trim(),
    vehicleColor: input.vehicleColor.trim(),
    passwordHash,
  });

  if (registered.error || !registered.data) {
    // corrida de criação (unique tenant+phone) ou token já consumido: trata como conta existente
    return { error: "Já existe uma conta para este telefone." };
  }

  // sessão + audit customer.login atômicos
  const rawToken = createSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const ttlHours = getSessionTtlHours();
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();

  const session = await rpcCustomerSessionCreate({
    tenantId: registered.data.tenant_id,
    customerId: registered.data.id,
    tokenHash,
    expiresAt,
    ip,
    userAgent: input.userAgent ?? null,
  });

  if (session.error || !session.data) {
    return { error: "Não foi possível iniciar a sessão. Tente novamente." };
  }

  // veículo: no caminho atômico já foi criado; no canônico (remoto) vincula agora com a
  // sessão recém-criada. Falha de vínculo não derruba o cadastro (o portal permite vincular depois).
  let vehicleLinked = true;
  if (!registered.vehicleIncluded) {
    try {
      const link = await rpcCustomerLinkVehicle({
        tokenHash,
        plate: entry.plate_normalized,
        model: input.vehicleModel.trim(),
        color: input.vehicleColor.trim(),
        vehicleType: input.vehicleType.trim(),
        vehicleSource: "portal",
      });
      vehicleLinked = !link.error;
    } catch {
      vehicleLinked = false;
    }
  }

  return { data: { token: rawToken, expiresAt, vehicleLinked } };
}
