import "server-only";
import { headers } from "next/headers";
import { checkRateLimit } from "@/backend/shared/rate-limit";

export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return h.get("x-real-ip") ?? "unknown";
}

/** Checa e lança erro genérico (anti-abuso) quando o limite é excedido. */
export async function enforceRateLimit(input: {
  tenantId: string;
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<void> {
  const result = await checkRateLimit(input);
  if (!result.allowed) {
    throw new Error("Muitas tentativas. Tente novamente mais tarde.");
  }
}
