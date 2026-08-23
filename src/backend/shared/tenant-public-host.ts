import "server-only";

const RESERVED_SUBDOMAINS = new Set(["www", "app", "admin", "api", "verificwash"]);

export function resolveTenantSlugFromHost(host: string | null | undefined) {
  const normalized = String(host ?? "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");

  if (!normalized) {
    return null;
  }

  const parts = normalized.split(".");
  if (parts.length < 3) {
    return null;
  }

  const subdomain = parts[0];
  if (!subdomain || RESERVED_SUBDOMAINS.has(subdomain)) {
    return null;
  }

  return subdomain;
}
