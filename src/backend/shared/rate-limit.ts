import "server-only";
import { incrementRateLimit } from "@/backend/repos/rate-limit-repo";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export async function checkRateLimit(input: {
  tenantId: string;
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const row = await incrementRateLimit(input.tenantId, input.key, input.windowSeconds);
  const count = row?.current_count ?? 1;
  const resetAt = row?.reset_at ? new Date(row.reset_at).getTime() : Date.now() + input.windowSeconds * 1000;
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));

  return {
    allowed: count <= input.limit,
    remaining: Math.max(0, input.limit - count),
    retryAfterSeconds,
  };
}
