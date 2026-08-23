import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { createInstagramMediaContainer, publishInstagramMedia } from "@/backend/integrations/instagram";
import { createAttendanceMediaSignedUrl, getAttendanceMediaRecordById } from "@/backend/repos/attendance-media-repo";
import { createAuditLogAdmin } from "@/backend/repos/admin-control-repo";
import { getMarketingAssetByIdForTenant } from "@/backend/repos/marketing-assets-repo";
import {
  createSocialPublicationAttempt,
  listSocialPublicationsByAssetIds,
  markSocialPublicationFailed,
  markSocialPublicationPublished,
  markSocialPublicationPublishing,
} from "@/backend/repos/social-publications-repo";
import { getTenantSettings } from "@/backend/repos/tenant-settings-repo";
import { getActiveTenantInstagramAccount } from "@/backend/repos/tenant-instagram-repo";
import { decryptInstagramSecret } from "@/backend/shared/instagram-auth";

function buildInstagramCaption(input: {
  text: string;
  cta: string | null;
  hashtags: string[];
}) {
  return [input.text.trim(), input.cta?.trim(), input.hashtags.join(" ").trim()]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 2200);
}

export async function publishSocialAssetToInstagramUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const assetId = String(formData.get("asset_id") ?? "").trim();
  const forcePublish = String(formData.get("force_publish") ?? "").trim() === "true";

  if (!assetId) {
    redirect("/app/dashboard?section=adm&panel=social&error=Peça social inválida.");
  }

  const [settings, asset, instagramAccount, publicationsByAsset] = await Promise.all([
    getTenantSettings(context.tenantId),
    getMarketingAssetByIdForTenant(context.tenantId, assetId),
    getActiveTenantInstagramAccount(context.tenantId),
    listSocialPublicationsByAssetIds(context.tenantId, [assetId]),
  ]);

  if (!settings?.instagram_enabled) {
    redirect("/app/dashboard?section=adm&panel=social&error=Instagram não liberado para este tenant.");
  }

  if (!instagramAccount) {
    redirect("/app/dashboard?section=adm&panel=social&error=Conecte uma conta do Instagram antes de publicar.");
  }

  if (!asset) {
    redirect("/app/dashboard?section=adm&panel=social&error=Peça social não encontrada.");
  }

  if (asset.status !== "approved") {
    redirect("/app/dashboard?section=adm&panel=social&error=Somente peças aprovadas podem ser publicadas.");
  }

  if (!asset.media_id) {
    redirect("/app/dashboard?section=adm&panel=social&error=Essa peça não possui mídia pronta para publicação.");
  }

  const latestPublication = (publicationsByAsset.get(assetId) ?? [])[0] ?? null;
  if (latestPublication?.status === "published" && !forcePublish) {
    redirect("/app/dashboard?section=adm&panel=social&error=Essa peça já foi publicada. Confirme se quiser publicar novamente.");
  }

  const media = await getAttendanceMediaRecordById(context.tenantId, asset.media_id);
  if (!media) {
    redirect("/app/dashboard?section=adm&panel=social&error=A peça social está sem mídia válida para publicação.");
  }

  const signedUrl = await createAttendanceMediaSignedUrl(media.file_path, 3600);
  if (!signedUrl) {
    redirect("/app/dashboard?section=adm&panel=social&error=Não foi possível preparar a imagem para o Instagram.");
  }

  const caption = buildInstagramCaption({
    text: asset.generated_text,
    cta: asset.cta,
    hashtags: asset.hashtags,
  });

  const attempt = await createSocialPublicationAttempt({
    tenantId: context.tenantId,
    marketingAssetId: asset.id,
    createdBy: context.userId,
  });

  if (attempt.error || !attempt.data) {
    redirect(
      `/app/dashboard?section=adm&panel=social&error=${encodeURIComponent(
        attempt.error?.message ?? "Não foi possível registrar a tentativa de publicação.",
      )}`,
    );
  }

  try {
    const accessToken = decryptInstagramSecret(instagramAccount.access_token);
    const container = await createInstagramMediaContainer({
      instagramAccountId: instagramAccount.instagram_account_id,
      accessToken,
      imageUrl: signedUrl,
      caption,
    });

    await markSocialPublicationPublishing({
      publicationId: attempt.data.id,
      tenantId: context.tenantId,
      instagramMediaId: container.id,
    });

    const published = await publishInstagramMedia({
      instagramAccountId: instagramAccount.instagram_account_id,
      accessToken,
      creationId: container.id,
    });

    await markSocialPublicationPublished({
      publicationId: attempt.data.id,
      tenantId: context.tenantId,
      instagramMediaId: container.id,
      instagramPublishId: published.id,
    });

    await createAuditLogAdmin({
      actor_user_id: context.userId,
      actor_email: context.email,
      actor_role: context.role,
      tenant_id: context.tenantId,
      action: "tenant_instagram.published",
      entity_type: "social_publications",
      entity_id: attempt.data.id,
      message: `${context.email ?? "tenant"} publicou uma peça no Instagram.`,
      metadata: {
        marketing_asset_id: asset.id,
        instagram_account_id: instagramAccount.instagram_account_id,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Falha ao publicar no Instagram.";
    await markSocialPublicationFailed({
      publicationId: attempt.data.id,
      tenantId: context.tenantId,
      errorMessage,
    });
    redirect(`/app/dashboard?section=adm&panel=social&error=${encodeURIComponent(errorMessage)}`);
  }
}
