import { randomBytes } from "node:crypto";
import { slugify } from "@/backend/shared/slug";

export function buildTenantEvolutionInstance(input: {
  tenantId: string;
  tenantSlug?: string | null;
  tenantName?: string | null;
}) {
  const rawBase = slugify(input.tenantSlug || input.tenantName || input.tenantId);
  const safeBase = rawBase || input.tenantId.replace(/[^a-z0-9]/gi, "").slice(0, 12).toLowerCase();
  const suffix = input.tenantId.replace(/-/g, "").slice(0, 6).toLowerCase();
  return `vw-${safeBase.slice(0, 24)}-${suffix}`;
}

export function buildTenantEvolutionToken() {
  return randomBytes(24).toString("hex");
}

export function maskSecret(value: string | null | undefined) {
  if (!value) return "Não gerado";
  if (value.length <= 10) return value;
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}
