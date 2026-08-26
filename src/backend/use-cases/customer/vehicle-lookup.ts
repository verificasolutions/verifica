import "server-only";
import { registrationOnly } from "@/backend/shared/input-normalizers";
import { getVehicleLookupProvider } from "@/backend/integrations/vehicle-lookup/null-provider";
import { enforceRateLimit, getClientIp } from "@/backend/shared/rate-limit-policy";
import { logCustomerAction } from "@/backend/shared/customer-events";

export async function lookupVehicleUseCase(input: {
  tenantId: string;
  customerId: string;
  plate: string;
}) {
  const ip = await getClientIp();
  const plate = registrationOnly(input.plate);

  if (!plate) {
    return { error: "Placa inválida." };
  }

  await enforceRateLimit({ tenantId: input.tenantId, key: `lookup:ip:${ip}`, limit: 10, windowSeconds: 60 });
  await enforceRateLimit({ tenantId: input.tenantId, key: `lookup:plate:${plate}`, limit: 5, windowSeconds: 600 });

  const provider = getVehicleLookupProvider();
  const result = await provider.lookup(plate);

  // token/chaves nunca chegam ao navegador; fallback manual quando o provedor está indisponível
  await logCustomerAction({
    tenantId: input.tenantId,
    customerId: input.customerId,
    action: "vehicle.lookup",
    entityType: "vehicle",
    entityId: null,
    message: `Consulta de placa ${plate}`,
    metadata: { ok: result.ok, source: result.source },
  });

  return { data: result };
}
