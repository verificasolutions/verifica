import "server-only";
import { rpcCustomerUnlinkVehicle } from "@/backend/repos/customer-rpc-repo";

export async function unlinkVehicleUseCase(input: {
  token: string;
  vehicleId: string;
}) {
  const result = await rpcCustomerUnlinkVehicle({ token: input.token, vehicleId: input.vehicleId });

  if (result.error) {
    return { error: result.error.message ?? "Não foi possível desvincular o veículo." };
  }

  // soft delete + evento vehicle.unlinked são atômicos dentro da RPC customer_unlink_vehicle
  return { data: { vehicleId: input.vehicleId } };
}
