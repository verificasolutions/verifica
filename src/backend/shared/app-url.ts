import "server-only";

const APP_BASE_PATH = "/verifica";

export function getAppUrl() {
  const direct = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (direct) {
    return direct.replace(/\/+$/, "");
  }

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) {
    return `https://${production.replace(/^https?:\/\//, "").replace(/\/+$/, "")}${APP_BASE_PATH}`;
  }

  const preview = process.env.VERCEL_URL?.trim();
  if (preview) {
    return `https://${preview.replace(/^https?:\/\//, "").replace(/\/+$/, "")}${APP_BASE_PATH}`;
  }

  return `https://www.verificasolutions.com.br${APP_BASE_PATH}`;
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
