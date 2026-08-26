import "server-only";
import { registrationOnly } from "@/backend/shared/input-normalizers";
import { rpcCustomerLinkVehicle } from "@/backend/repos/customer-rpc-repo";
import { enforceRateLimit, getClientIp } from "@/backend/shared/rate-limit-policy";

export async function linkVehicleUseCase(input: {
  token: string;
  tenantId: string;
  customerId: string;
  plate: string;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  vehicleType?: string | null;
  usageType?: string | null;
  sizeTier?: string | null;
  tierSource?: string | null;
}) {
  const ip = await getClientIp();
  const plate = registrationOnly(input.plate);

  if (!plate) {
    return { error: "Placa inválida." };
  }

  await enforceRateLimit({ tenantId: input.tenantId, key: `link:ip:${ip}`, limit: 20, windowSeconds: 600 });

  const result = await rpcCustomerLinkVehicle({
    token: input.token,
    plate,
    brand: input.brand ?? null,
    model: input.model ?? null,
    color: input.color ?? null,
    vehicleType: input.vehicleType ?? null,
    usageType: input.usageType ?? "particular",
    sizeTier: input.sizeTier ?? null,
    tierSource: input.tierSource ?? "manual",
  });

  if (result.error || !result.data) {
    return { error: result.error?.message ?? "Não foi possível vincular o veículo." };
  }

  // evento vehicle.linked é gravado atomicamente dentro da RPC customer_link_vehicle
  return { data: result.data };
}
