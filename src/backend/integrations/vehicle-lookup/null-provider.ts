import "server-only";
import type { VehicleLookupProvider, VehicleLookupResult } from "@/backend/integrations/vehicle-lookup/types";

/**
 * Nenhum provedor externo configurado: retorna indisponível -> cadastro manual mínimo.
 */
export class NullVehicleLookupProvider implements VehicleLookupProvider {
  async lookup(plate: string): Promise<VehicleLookupResult> {
    return {
      ok: false,
      plate,
      brand: null,
      model: null,
      years: null,
      color: null,
      vehicleType: null,
      segment: null,
      subsegment: null,
      fuel: null,
      sizeTierSuggestion: null,
      source: null,
      consultedAt: new Date().toISOString(),
      error: "provedor_nao_configurado",
    };
  }
}

export function getVehicleLookupProvider(): VehicleLookupProvider {
  const provider = process.env.VEHICLE_LOOKUP_PROVIDER?.trim();
  if (!provider || provider === "none") {
    return new NullVehicleLookupProvider();
  }
  // Futuros provedores registrados aqui (ex.: "sinesp", "fipe").
  return new NullVehicleLookupProvider();
}
