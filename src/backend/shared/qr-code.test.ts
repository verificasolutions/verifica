import { describe, expect, it } from "vitest";
import { buildQrImageSrc, buildPortalEntryUrl } from "./qr-code";

describe("qr-code (padrão api.qrserver.com reutilizado)", () => {
  it("monta URL do gerador externo com tamanho", () => {
    expect(buildQrImageSrc("https://x/y")).toContain("api.qrserver.com/v1/create-qr-code/");
    expect(buildQrImageSrc("abc", 360)).toContain("size=360x360");
    expect(buildQrImageSrc("a b")).toContain(encodeURIComponent("a b"));
  });

  it("monta URL canônica de entrada com basePath /verifica e tenant", () => {
    const url = buildPortalEntryUrl("meu-tenant");
    expect(url).toContain("/verifica/cliente/entrar");
    expect(url).toContain("tenant=meu-tenant");
  });

  it("QR do tenant mel aponta para a rota canônica com tenant=mel", () => {
    const url = buildPortalEntryUrl("mel");
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toContain("/verifica/cliente/entrar");
    expect(parsed.searchParams.get("tenant")).toBe("mel");
    // nunca aponta para domínios desatualizados hardcoded
    expect(url).not.toContain("verifica-saas");
    // segue a precedência canônica do helper (produção/preview/override/fallback local)
    expect(url.startsWith("https://")).toBe(
      Boolean(process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || process.env.NEXT_PUBLIC_APP_URL),
    );
  });
});
