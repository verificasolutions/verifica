import "server-only";

const APP_BASE_PATH = "/verifica";

/**
 * URL pública canônica da aplicação — montagem CENTRALIZADA (não espalhar domínios no código).
 *
 * Precedência documentada:
 *  1. NEXT_PUBLIC_APP_URL — domínio OFICIAL/CANÔNICO explícito (ex.: https://verifica-saas.vercel.app,
 *     SEM /verifica — o basePath é anexado aqui). Prioridade máxima: QR/link público NUNCA
 *     usa URL temporária de deployment. Aceita também o valor já com /verifica (sem duplicar).
 *  2. VERCEL_PROJECT_PRODUCTION_URL — domínio de produção atual do projeto (Vercel; dinâmico).
 *  3. VERCEL_URL — URL do deployment atual (Vercel; previews/ambientes).
 *  4. Fallback local de desenvolvimento (sem canônico): http://localhost:3000 + basePath.
 *
 * NÃO há domínio hardcoded aqui. Sem NEXT_PUBLIC_APP_URL (ex.: dev local), o fallback local
 * continua funcionando.
 */
export function getAppUrl() {
  const direct = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (direct) {
    const base = direct.replace(/\/+$/, "");
    if (base.endsWith(APP_BASE_PATH)) {
      return base;
    }
    return `${base}${APP_BASE_PATH}`;
  }

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) {
    return `https://${production.replace(/^https?:\/\//, "").replace(/\/+$/, "")}${APP_BASE_PATH}`;
  }

  const preview = process.env.VERCEL_URL?.trim();
  if (preview) {
    return `https://${preview.replace(/^https?:\/\//, "").replace(/\/+$/, "")}${APP_BASE_PATH}`;
  }

  return `http://localhost:3000${APP_BASE_PATH}`;
}

export function getAppBasePath() {
  const appUrl = getAppUrl();

  if (!appUrl) {
    return "";
  }

  const pathname = new URL(appUrl).pathname.replace(/\/+$/, "");
  return pathname === "/" ? "" : pathname;
}

export function getPublicRootUrl() {
  const appUrl = getAppUrl();
  const url = new URL(appUrl);
  return `${url.origin}`;
}

export function withAppBasePath(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const basePath = getAppBasePath();
  if (basePath && (normalizedPath === basePath || normalizedPath.startsWith(`${basePath}/`))) {
    return normalizedPath;
  }
  return `${basePath}${normalizedPath}` || "/";
}

export function getTrackingUrl(publicCode: string) {
  const publicRootUrl = getPublicRootUrl();
  return publicRootUrl ? `${publicRootUrl}/a/${publicCode}` : publicCode;
}
