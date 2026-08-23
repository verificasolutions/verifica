/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ATTENDANCE_MEDIA_BUCKET } from "@/backend/repos/attendance-media-repo";

function firstRelated<T>(value: T[] | T | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export async function getPublicTenantSiteBySlug(slug: string) {
  const admin = createSupabaseAdminClient() as any;
  const tenantResult = await admin
    .from("tenants")
    .select("id, name, slug, whatsapp, is_active")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  const tenant = tenantResult.data ?? null;
  if (!tenant) {
    return null;
  }

  const [companyProfileResult, landingResult, tenantSettingsResult, servicesResult, reviewsResult, assetsResult] = await Promise.all([
    admin.from("tenant_company_profiles").select("*").eq("tenant_id", tenant.id).maybeSingle(),
    admin.from("tenant_landing_pages").select("*").eq("tenant_id", tenant.id).maybeSingle(),
    admin.from("tenant_settings").select("landing_enabled").eq("tenant_id", tenant.id).maybeSingle(),
    admin
      .from("services")
      .select("id, name, short_description, price, price_passeio, price_medio, price_grande, price_bem_grande")
      .eq("tenant_id", tenant.id)
      .eq("is_active", true)
      .order("name", { ascending: true })
      .limit(12),
    admin
      .from("tenant_reviews")
      .select("id, customer_name, rating, quote, sort_order, is_active")
      .eq("tenant_id", tenant.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(12),
    admin
      .from("marketing_assets")
      .select(`
        id, tenant_id, attendance_id, media_id, kind, title, generated_text, cta, hashtags, status, created_at,
        media:attendance_media(id, file_path, mime_type, caption, created_at)
      `)
      .eq("tenant_id", tenant.id)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const approvedAssets = (assetsResult.data ?? []) as any[];
  const attendanceIds = approvedAssets.map((asset) => asset.attendance_id).filter(Boolean);
  const attendanceMediaResult =
    attendanceIds.length > 0
      ? await admin
          .from("attendance_media")
          .select("id, attendance_id, kind, file_path, mime_type, caption, created_at")
          .in("attendance_id", attendanceIds)
          .in("kind", ["entry", "ready"])
          .order("created_at", { ascending: false })
      : { data: [] as any[] };

  const mediaRows = [
    ...approvedAssets.map((asset) => firstRelated(asset.media)).filter(Boolean),
    ...(((attendanceMediaResult.data ?? []) as any[]) || []),
  ];
  const mediaUrlById = new Map<string, string | null>();
  let coverImageUrl = landingResult.data?.cover_image_url ?? null;
  let profileImageUrl = landingResult.data?.profile_image_url ?? null;

  await Promise.all(
    mediaRows.map(async (media) => {
      const signed = await admin.storage.from(ATTENDANCE_MEDIA_BUCKET).createSignedUrl(media.file_path, 3600);
      mediaUrlById.set(media.id, signed.data?.signedUrl ?? null);
    }),
  );

  if (coverImageUrl && !/^https?:\/\//i.test(coverImageUrl)) {
    const signed = await admin.storage.from(ATTENDANCE_MEDIA_BUCKET).createSignedUrl(coverImageUrl, 3600);
    coverImageUrl = signed.data?.signedUrl ?? null;
  }

  if (profileImageUrl && !/^https?:\/\//i.test(profileImageUrl)) {
    const signed = await admin.storage.from(ATTENDANCE_MEDIA_BUCKET).createSignedUrl(profileImageUrl, 3600);
    profileImageUrl = signed.data?.signedUrl ?? null;
  }

  return {
    tenant,
    companyProfile: companyProfileResult.data ?? null,
    landing: landingResult.data
      ? {
          ...landingResult.data,
          cover_image_url: coverImageUrl,
          profile_image_url: profileImageUrl,
        }
      : null,
    tenantSettings: tenantSettingsResult.data ?? null,
    services: ((servicesResult.data ?? []) as any[]).map((item) => ({
      id: item.id,
      name: item.name,
      shortDescription: item.short_description ?? null,
      startingPrice: Number(item.price_passeio ?? item.price ?? 0),
      regularPrice: Number(item.price ?? 0),
      priceMedio: Number(item.price_medio ?? item.price ?? 0),
      priceGrande: Number(item.price_grande ?? item.price ?? 0),
      priceBemGrande: Number(item.price_bem_grande ?? item.price ?? 0),
    })),
    reviews: ((reviewsResult.data ?? []) as any[]).map((item) => ({
      id: item.id,
      customerName: item.customer_name,
      rating: Number(item.rating ?? 5),
      quote: item.quote,
      sortOrder: Number(item.sort_order ?? 0),
    })),
    posts: approvedAssets.map((asset) => {
      const media = firstRelated(asset.media);
      return {
        id: asset.id,
        attendanceId: asset.attendance_id ?? null,
        kind: asset.kind,
        title: asset.title ?? "Publicação",
        caption: asset.generated_text,
        cta: asset.cta ?? null,
        hashtags: Array.isArray(asset.hashtags) ? asset.hashtags : [],
        createdAt: asset.created_at,
        imageUrl: media?.id ? (mediaUrlById.get(media.id) ?? null) : null,
      };
    }),
    beforeAfter: attendanceIds
      .map((attendanceId) => {
        const rows = ((attendanceMediaResult.data ?? []) as any[]).filter((item) => item.attendance_id === attendanceId);
        const before = rows.find((item) => item.kind === "entry") ?? null;
        const after = rows.find((item) => item.kind === "ready") ?? null;
        const asset = approvedAssets.find((item) => item.attendance_id === attendanceId) ?? null;

        if (!before || !after || !asset) {
          return null;
        }

        return {
          id: attendanceId,
          title: asset.title ?? "Antes e depois",
          caption: asset.generated_text,
          beforeUrl: mediaUrlById.get(before.id) ?? null,
          afterUrl: mediaUrlById.get(after.id) ?? null,
        };
      })
      .filter(Boolean),
  };
}
