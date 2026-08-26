import "server-only";

type TenantAddressLike = {
  street?: string | null;
  street_number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
};

/**
 * Composição do endereço a partir da FONTE ÚNICA (tenant_company_profiles), incluindo CEP.
 * Ex.: "Rua das Flores, 123 - Fundos, Centro, São Paulo - SP, CEP 01001-000"
 */
export function buildTenantAddressLabel(address: TenantAddressLike | null | undefined) {
  const parts = [
    address?.street,
    address?.street_number,
    address?.complement,
    address?.neighborhood,
    address?.city,
    address?.state,
  ]
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);

  const label = parts.length > 0 ? parts.join(", ") : null;

  const cep = String(address?.postal_code ?? "").trim();
  if (label && cep) {
    return `${label}, CEP ${cep}`;
  }

  return label;
}

/**
 * Embed de mapa a partir do endereço ATUAL (fonte única, com CEP).
 * Com GOOGLE_MAPS_API_KEY (server-only): Google Maps Embed API (place).
 * Sem chave: embed público compatível (maps.google.com output=embed).
 * Retorna null apenas sem endereço. Nunca endereço hardcoded.
 */
export function buildGoogleMapsEmbedUrl(addressLabel: string | null | undefined, apiKey?: string | null) {
  const normalized = String(addressLabel ?? "").trim();
  if (!normalized) {
    return null;
  }

  const key = String(apiKey ?? "").trim();
  if (key) {
    return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${encodeURIComponent(normalized)}`;
  }

  return `https://maps.google.com/maps?q=${encodeURIComponent(normalized)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
}

/** Link funcional "Ver no Google Maps" (sempre disponível quando há endereço). */
export function buildGoogleMapsDirectionsLink(addressLabel: string | null | undefined) {
  const normalized = String(addressLabel ?? "").trim();
  if (!normalized) {
    return null;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(normalized)}`;
}
