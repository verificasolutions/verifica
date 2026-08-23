import "server-only";

type TenantAddressLike = {
  street?: string | null;
  street_number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
};

export function buildTenantAddressLabel(address: TenantAddressLike | null | undefined) {
  const parts = [
    address?.street,
    address?.street_number,
    address?.neighborhood,
    address?.city,
    address?.state,
  ]
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : null;
}

export function buildGoogleMapsEmbedUrl(addressLabel: string | null | undefined) {
  const normalized = String(addressLabel ?? "").trim();
  if (!normalized) {
    return null;
  }

  return `https://www.google.com/maps?q=${encodeURIComponent(normalized)}&output=embed`;
}
