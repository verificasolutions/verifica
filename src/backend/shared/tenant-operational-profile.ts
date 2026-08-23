export const tenantOperationalProfiles = ["automotive", "generic"] as const;

export type TenantOperationalProfile = (typeof tenantOperationalProfiles)[number];

export function normalizeTenantOperationalProfile(value: FormDataEntryValue | string | null | undefined): TenantOperationalProfile {
  const profile = String(value ?? "").trim();
  return tenantOperationalProfiles.includes(profile as TenantOperationalProfile) ? (profile as TenantOperationalProfile) : "automotive";
}

export function getOperationBoxCodePrefix(kind: "entry" | "wash" | "dry" | "finish" | "ready") {
  if (kind === "entry") return "ENTRY";
  if (kind === "ready") return "DONE";
  if (kind === "dry") return "CHECK";
  if (kind === "finish") return "FINISH";
  return "WORK";
}

export function getOperationBoxColorToken(kind: "entry" | "wash" | "dry" | "finish" | "ready") {
  if (kind === "entry") return "hazard";
  if (kind === "ready") return "ready";
  if (kind === "dry") return "dry";
  if (kind === "finish") return "finish";
  return "wash";
}
