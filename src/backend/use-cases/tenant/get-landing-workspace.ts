import "server-only";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { createAttendanceMediaSignedUrl } from "@/backend/repos/attendance-media-repo";
import { listMarketingAssetsByTenant } from "@/backend/repos/marketing-assets-repo";
import { listTenantReviews } from "@/backend/repos/tenant-reviews-repo";
import { getTenantLandingPage } from "@/backend/repos/tenant-landing-repo";
import { getTenantCompanyProfileAdmin } from "@/backend/repos/tenant-company-profiles-admin-repo";
import { getTenantSettings } from "@/backend/repos/tenant-settings-repo";
import { listActiveServicesByTenant } from "@/backend/repos/services-repo";
import { buildGoogleMapsEmbedUrl, buildTenantAddressLabel } from "@/backend/shared/tenant-location";

export async function getLandingWorkspaceUseCase() {
  const context = await requireOwnerOrManager();
  const [landing, companyProfile, reviews, services, assets, settings] = await Promise.all([
    getTenantLandingPage(context.tenantId),
    getTenantCompanyProfileAdmin(context.tenantId),
    listTenantReviews(context.tenantId),
    listActiveServicesByTenant(context.tenantId),
    listMarketingAssetsByTenant(context.tenantId),
    getTenantSettings(context.tenantId),
  ]);

  const defaultAddressLabel = buildTenantAddressLabel(companyProfile);
  const defaultMapEmbedUrl = buildGoogleMapsEmbedUrl(landing?.address_label ?? defaultAddressLabel);

  return {
    tenant: context.tenant,
    settings,
    landing: landing
      ? {
          ...landing,
          cover_image_storage_path: landing.cover_image_url,
          profile_image_storage_path: landing.profile_image_url,
          cover_image_url:
            landing.cover_image_url && !/^https?:\/\//i.test(landing.cover_image_url)
              ? await createAttendanceMediaSignedUrl(landing.cover_image_url, 3600)
              : landing.cover_image_url,
          profile_image_url:
            landing.profile_image_url && !/^https?:\/\//i.test(landing.profile_image_url)
              ? await createAttendanceMediaSignedUrl(landing.profile_image_url, 3600)
              : landing.profile_image_url,
          address_label: landing.address_label ?? defaultAddressLabel,
          map_embed_url: landing.map_embed_url ?? defaultMapEmbedUrl,
        }
      : {
          tenant_id: context.tenantId,
          category: null,
          city_label: companyProfile?.city ?? null,
          bio: null,
          background_style: "dark",
          cover_image_url: null,
          profile_image_url: null,
          contact_email: companyProfile?.email ?? null,
          instagram_url: null,
          facebook_url: null,
          website_url: null,
          address_label: defaultAddressLabel,
          map_embed_url: defaultMapEmbedUrl,
          opening_hours: null,
          cta_whatsapp_message: null,
          is_published: true,
          created_at: null,
          updated_at: null,
          cover_image_storage_path: null,
          profile_image_storage_path: null,
        },
    companyProfile,
    reviews,
    services,
    assets: assets.filter((item) => item.status === "approved"),
  };
}
