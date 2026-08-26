import "server-only";
import { findActiveTenantBySlug } from "@/backend/repos/tenant-lookup-repo";
import { enforceRateLimit, getClientIp } from "@/backend/shared/rate-limit-policy";

export async function resolveTenantEntryUseCase(input: { tenantSlug: string }) {
  const ip = await getClientIp();
  const slug = input.tenantSlug.trim().toLowerCase();

  if (!slug) {
    return { error: "Local inválido." };
  }

  const tenant = await findActiveTenantBySlug(slug);
  if (!tenant) {
    return { error: "Local não encontrado." };
  }

  await enforceRateLimit({ tenantId: tenant.id, key: `qr:tenant:${slug}`, limit: 30, windowSeconds: 60 });
  await enforceRateLimit({ tenantId: tenant.id, key: `qr:ip:${ip}`, limit: 30, windowSeconds: 60 });

  return { data: { tenantId: tenant.id, name: tenant.name, slug: tenant.slug } };
}
