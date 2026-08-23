import "server-only";

function appendQueryToTarget(target: string, key: string, value: string) {
  const [base, hash = ""] = target.split("#", 2);
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}${key}=${encodeURIComponent(value)}${hash ? `#${hash}` : ""}`;
}

export function buildDashboardRedirectTarget(formData: FormData, fallback: string, key: "error" | "message", text: string) {
  const requestedTarget = String(formData.get("redirect_to") ?? "").trim();
  const target =
    requestedTarget.startsWith("/app/dashboard") ||
    requestedTarget.startsWith("/operador/dashboard") ||
    requestedTarget.startsWith("/admin") ||
    requestedTarget === "/login"
      ? requestedTarget
      : fallback;

  return appendQueryToTarget(target, key, text);
}
