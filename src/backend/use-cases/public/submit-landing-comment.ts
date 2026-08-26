import "server-only";
import { headers } from "next/headers";
import { enforceRateLimit, getClientIp } from "@/backend/shared/rate-limit-policy";
import { hashVisitorIdentity, sanitizeAuthorName, sanitizeCommentText } from "@/backend/shared/landing-engagement";
import {
  findApprovedAssetTenant,
  rpcLandingCommentSubmit,
  updateLandingCommentModerationSuggestion,
} from "@/backend/repos/landing-engagement-repo";
import { getCommentModerationProvider } from "@/backend/integrations/moderation/moderation-provider";

/**
 * Comentário público: sanitizado no servidor, sempre 'pending' até aprovação do
 * owner/manager. Moderação Gemini opcional gera apenas SUGESTÃO (nunca publica).
 */
export async function submitLandingCommentUseCase(input: { assetId: string; authorName: string; body: string }) {
  const ip = await getClientIp();
  const tenantId = await findApprovedAssetTenant(input.assetId);
  if (!tenantId) {
    return { error: "Publicação inválida." };
  }

  const name = sanitizeAuthorName(input.authorName);
  const body = sanitizeCommentText(input.body);

  if (!name || !body) {
    return { error: "Preencha nome e comentário." };
  }

  await enforceRateLimit({ tenantId, key: `landing:comment:ip:${ip}`, limit: 10, windowSeconds: 300 });
  await enforceRateLimit({ tenantId, key: `landing:comment:asset:${input.assetId}`, limit: 20, windowSeconds: 600 });

  const requestHeaders = await headers();
  const identityHash = hashVisitorIdentity(ip, requestHeaders.get("user-agent"));

  const result = await rpcLandingCommentSubmit({
    assetId: input.assetId,
    authorName: name,
    identityHash,
    body,
  });

  if (result.error || !result.id) {
    return { error: "Não foi possível enviar o comentário." };
  }

  // moderação opcional (GEMINI_API_KEY): apenas sugestão; status permanece pending
  const provider = getCommentModerationProvider();
  if (provider) {
    const suggestion = await provider.moderate({ text: body, authorName: name }).catch(() => null);
    if (suggestion) {
      await updateLandingCommentModerationSuggestion(result.id, suggestion).catch(() => {});
    }
  }

  return { data: { commentId: result.id } };
}
