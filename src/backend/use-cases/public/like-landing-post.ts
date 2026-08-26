import "server-only";
import { headers } from "next/headers";
import { enforceRateLimit, getClientIp } from "@/backend/shared/rate-limit-policy";
import { hashVisitorIdentity } from "@/backend/shared/landing-engagement";
import { findApprovedAssetTenant, rpcLandingLikePost } from "@/backend/repos/landing-engagement-repo";

export async function likeLandingPostUseCase(input: { assetId: string }) {
  const ip = await getClientIp();
  const tenantId = await findApprovedAssetTenant(input.assetId);
  if (!tenantId) {
    return { error: "Publicação inválida." };
  }

  await enforceRateLimit({ tenantId, key: `landing:like:ip:${ip}`, limit: 20, windowSeconds: 300 });

  const requestHeaders = await headers();
  const identityHash = hashVisitorIdentity(ip, requestHeaders.get("user-agent"));

  const result = await rpcLandingLikePost(input.assetId, identityHash);
  if (result.error) {
    return { error: "Não foi possível curtir." };
  }

  return { data: { count: result.count } };
}
