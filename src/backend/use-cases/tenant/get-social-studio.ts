import "server-only";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { listAttendanceMediaByAttendances } from "@/backend/repos/attendance-media-repo";
import { listQueueForTodayByTenant } from "@/backend/repos/attendances-operations-repo";
import { listMarketingAssetsByTenant } from "@/backend/repos/marketing-assets-repo";
import { listSocialPublicationsByAssetIds } from "@/backend/repos/social-publications-repo";
import { getTenantSettings } from "@/backend/repos/tenant-settings-repo";
import { getActiveTenantInstagramAccount } from "@/backend/repos/tenant-instagram-repo";

export async function getSocialStudioUseCase() {
  const context = await requireOwnerOrManager();
  const [queue, assets, settings, instagramConnection] = await Promise.all([
    listQueueForTodayByTenant(context.tenantId),
    listMarketingAssetsByTenant(context.tenantId),
    getTenantSettings(context.tenantId),
    getActiveTenantInstagramAccount(context.tenantId),
  ]);
  const publicationsByAsset = await listSocialPublicationsByAssetIds(context.tenantId, assets.map((item) => item.id));
  const mediaByAttendance = await listAttendanceMediaByAttendances(queue.map((item) => item.id));

  const candidates = queue.flatMap((attendance) =>
    (mediaByAttendance.get(attendance.id) ?? [])
      .filter((media) => Boolean(media.id && media.signed_url))
      .map((media) => ({
        candidateId: media.id,
        attendanceId: attendance.id,
        publicCode: attendance.public_code,
        customerName: attendance.customers?.name ?? "Cliente",
        vehicleLabel: attendance.vehicles?.model ?? "Veículo",
        vehicleColor: attendance.vehicles?.color ?? null,
        plate: attendance.vehicles?.plate ?? null,
        serviceName: attendance.services?.name ?? "Serviço",
        attendanceStatus: attendance.status,
        finalPrice: attendance.final_price,
        mediaId: media.id,
        mediaUrl: media.signed_url,
        mediaCaption: media.caption ?? null,
        mediaKind: media.kind,
        createdAt: media.created_at ?? attendance.created_at,
      })),
  );

  return {
    instagramEnabled: settings?.instagram_enabled ?? false,
    instagramAutoPublishEnabled: settings?.instagram_auto_publish_enabled ?? false,
    instagramDefaultPublishMode: settings?.instagram_default_publish_mode ?? "manual",
    instagramConnection: instagramConnection
      ? {
          id: instagramConnection.id,
          accountName: instagramConnection.account_name,
          instagramAccountId: instagramConnection.instagram_account_id,
          facebookPageId: instagramConnection.facebook_page_id,
          tokenExpiresAt: instagramConnection.token_expires_at,
          lastSyncAt: instagramConnection.last_sync_at,
          isActive: instagramConnection.is_active,
        }
      : null,
    assets: assets.map((asset) => ({
      ...asset,
      latestPublication: (publicationsByAsset.get(asset.id) ?? [])[0] ?? null,
    })),
    candidates,
  };
}
