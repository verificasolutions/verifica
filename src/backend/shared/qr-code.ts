import "server-only";
import { getAppUrl, withAppBasePath } from "@/backend/shared/app-url";

/**
 * Reutiliza o gerador de QR já usado no projeto (api.qrserver.com) — decisão aprovada:
 * sem adicionar a dependência qrcode nesta fase.
 */
export function buildQrImageSrc(value: string, size = 320): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`;
}

/**
 * URL canônica de entrada do portal: respeita basePath /verifica e NEXT_PUBLIC_APP_URL.
 * unit é aceito apenas se houver estrutura real de unidades (hoje não existe — fica reservado).
 */
export function buildPortalEntryUrl(tenantSlug: string, unitId?: string | null): string {
  const params = new URLSearchParams({ tenant: tenantSlug });
  if (unitId) params.set("unit", unitId);
  const path = withAppBasePath(`/cliente/entrar?${params.toString()}`);
  return new URL(path, getAppUrl()).toString();
}
