import "server-only";

export type VehicleLookupResult = {
  ok: boolean;
  plate: string;
  brand: string | null;
  model: string | null;
  years: string[] | null;
  color: string | null;
  vehicleType: string | null;
  segment: string | null;
  subsegment: string | null;
  fuel: string | null;
  sizeTierSuggestion: "passeio" | "medio" | "grande" | "bem_grande" | null;
  source: string | null;
  consultedAt: string | null;
  error?: string | null;
};

/**
 * Porta de consulta de placa (§4). Implementações devem ter timeout, cache controlado
 * e tratamento de falha; tokens nunca chegam ao navegador. A classificação final de porte
 * permanece no motor interno revisável (vehicle-catalog), não no fornecedor.
 */
export interface VehicleLookupProvider {
  lookup(plate: string): Promise<VehicleLookupResult>;
}
