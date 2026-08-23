import type { OperationBoxKind } from "@/backend/types";

function normalizeServiceName(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

export function serviceSkipsDryStage(serviceName: string | null | undefined) {
  const normalized = normalizeServiceName(serviceName);
  return normalized === "ducha";
}

export function resolvePostWashStatus(serviceName: string | null | undefined) {
  return serviceSkipsDryStage(serviceName) ? "ready" : "finishing";
}

export function shouldSkipBoxKindForService(kind: OperationBoxKind, serviceName: string | null | undefined) {
  return serviceSkipsDryStage(serviceName) && (kind === "dry" || kind === "finish");
}
