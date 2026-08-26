import { afterEach, describe, expect, it, vi } from "vitest";
import { getAppUrl, withAppBasePath } from "./app-url";

describe("getAppUrl (URL pública canônica — sem domínio hardcoded)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prioriza o domínio OFICIAL (NEXT_PUBLIC_APP_URL) sobre URLs de deployment/produção", () => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "verifica-gilt.vercel.app");
    vi.stubEnv("VERCEL_URL", "verifica-gu565rgxx-verificawash-9140s-projects.vercel.app");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://verifica-saas.vercel.app");
    expect(getAppUrl()).toBe("https://verifica-saas.vercel.app/verifica");
  });

  it("aceita NEXT_PUBLIC_APP_URL já com /verifica sem duplicar o basePath", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://verifica-saas.vercel.app/verifica");
    expect(getAppUrl()).toBe("https://verifica-saas.vercel.app/verifica");
  });

  it("usa VERCEL_PROJECT_PRODUCTION_URL quando não há canônico explícito", () => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "verifica-gilt.vercel.app");
    expect(getAppUrl()).toBe("https://verifica-gilt.vercel.app/verifica");
  });

  it("usa VERCEL_URL (deployment atual) apenas sem canônico e sem produção", () => {
    vi.stubEnv("VERCEL_URL", "verifica-abc-verificawash-9140s-projects.vercel.app");
    expect(getAppUrl()).toBe("https://verifica-abc-verificawash-9140s-projects.vercel.app/verifica");
  });

  it("fallback local de desenvolvimento sem envs (não quebra localhost)", () => {
    expect(getAppUrl()).toBe("http://localhost:3000/verifica");
  });

  it("withAppBasePath não duplica o basePath", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://verifica-saas.vercel.app");
    expect(withAppBasePath("/cliente/entrar?tenant=mel")).toBe("/verifica/cliente/entrar?tenant=mel");
  });
});
