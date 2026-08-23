import municipalityMap from "@/backend/shared/receita-municipios.json";

type ReceitaMunicipalityEntry = {
  code: string;
  ibgeCode: string | null;
  city: string | null;
  receitaCity: string | null;
  state: string;
};

type ReceitaMunicipalityMap = Record<string, Record<string, ReceitaMunicipalityEntry>>;

const MUNICIPALITY_MAP = municipalityMap as ReceitaMunicipalityMap;

function normalizeState(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeCode(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D+/g, "");
  if (!digits) return null;
  return digits.replace(/^0+/, "") || "0";
}

export function resolveReceitaMunicipality(input: {
  code: string | null | undefined;
  state: string | null | undefined;
}) {
  const state = normalizeState(input.state);
  const code = normalizeCode(input.code);
  if (!state || !code) return null;
  return MUNICIPALITY_MAP[state]?.[code] ?? null;
}

