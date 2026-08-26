/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ATTENDANCE_MEDIA_BUCKET } from "@/backend/repos/attendance-media-repo";
import { buildGoogleMapsEmbedUrl, buildTenantAddressLabel } from "@/backend/shared/tenant-location";
import { rpcLandingCommentsApproved, rpcLandingPostLikeCount } from "@/backend/repos/landing-engagement-repo";

function firstRelated<T>(value: T[] | T | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

type LandingMediaRow = {
  id: string;
  marketing_asset_id: string | null;
  file_path: string;
  mime_type: string;
  kind: string;
  sort_order: number;
  created_at: string;
};

export type PublicTenantSiteCritical = {
  tenant: any;
  companyProfile: any;
  landing: any;
  tenantSettings: any;
  services: Array<{
    id: string;
    name: string;
    shortDescription: string | null;
    startingPrice: number;
    regularPrice: number;
    priceMedio: number;
    priceGrande: number;
    priceBemGrande: number;
  }>;
  singleSource: {
    displayName: string;
    phone: string | null;
    email: string | null;
    website: string | null;
    cityLabel: string | null;
    addressLabel: string | null;
    mapEmbedUrl: string | null;
  };
};

export type PublicTenantSiteSecondary = {
  posts: Array<{
    id: string;
    attendanceId: string | null;
    kind: string;
    title: string;
    caption: string;
    cta: string | null;
    hashtags: string[];
    createdAt: string;
    imageUrl: string | null;
    images: string[];
    likeCount: number;
    comments: Array<{ id: string; author_name: string; body: string; created_at: string }>;
  }>;
  gallery: Array<{ id: string; url: string; title: string | null }>;
  reviews: Array<{
    id: string;
    customerName: string;
    rating: number;
    quote: string;
    sortOrder: number;
  }>;
  beforeAfter: Array<{
    id: string;
    title: string;
    caption: string;
    beforeUrl: string | null;
    afterUrl: string | null;
  }>;
};

/**
 * CARGA CRÍTICA (não bloqueia a renderização do hero/perfil):
 * tenants + tenant_company_profiles + tenant_landing_pages + tenant_settings + services
 * + URLs assinadas de CAPA e PERFIL. Memoizada por request (React.cache).
 */
async function loadPublicTenantSiteCritical(slug: string): Promise<PublicTenantSiteCritical | null> {
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

  const [companyProfileResult, landingResult, tenantSettingsResult, servicesResult] = await Promise.allSettled([
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
  ]);

  const company = companyProfileResult.status === "fulfilled" ? (companyProfileResult.value.data ?? null) : null;
  const landingData = landingResult.status === "fulfilled" ? (landingResult.value.data ?? null) : null;
  const tenantSettings = tenantSettingsResult.status === "fulfilled" ? (tenantSettingsResult.value.data ?? null) : null;
  const services =
    servicesResult.status === "fulfilled"
      ? ((servicesResult.value.data ?? []) as any[]).map((item) => ({
          id: item.id,
          name: item.name,
          shortDescription: item.short_description ?? null,
          startingPrice: Number(item.price_passeio ?? item.price ?? 0),
          regularPrice: Number(item.price ?? 0),
          priceMedio: Number(item.price_medio ?? item.price ?? 0),
          priceGrande: Number(item.price_grande ?? item.price ?? 0),
          priceBemGrande: Number(item.price_bem_grande ?? item.price ?? 0),
        }))
      : [];

  // URLs assinadas de capa/perfil (críticas para o LCP) — paralelas e nunca derrubam a página.
  let coverImageUrl = landingData?.cover_image_url ?? null;
  let profileImageUrl = landingData?.profile_image_url ?? null;
  await Promise.all([
    (async () => {
      if (coverImageUrl && !/^https?:\/\//i.test(coverImageUrl)) {
        const signed = await admin.storage.from(ATTENDANCE_MEDIA_BUCKET).createSignedUrl(coverImageUrl, 3600);
        coverImageUrl = signed.data?.signedUrl ?? null;
      }
    })(),
    (async () => {
      if (profileImageUrl && !/^https?:\/\//i.test(profileImageUrl)) {
        const signed = await admin.storage.from(ATTENDANCE_MEDIA_BUCKET).createSignedUrl(profileImageUrl, 3600);
        profileImageUrl = signed.data?.signedUrl ?? null;
      }
    })(),
  ]);

  // FONTE ÚNICA: nome, telefone, e-mail, endereço (com CEP), cidade/estado e site SEMPRE do cadastro.
  const singleSource = {
    displayName: company?.trade_name ?? tenant.name,
    phone: company?.phone ?? company?.phone_secondary ?? tenant.whatsapp ?? null,
    email: company?.email ?? null,
    website: company?.website ?? null,
    cityLabel: [company?.city, company?.state].filter(Boolean).join(" - ") || null,
    addressLabel: buildTenantAddressLabel(company),
    mapEmbedUrl: buildGoogleMapsEmbedUrl(buildTenantAddressLabel(company)),
  };

  return {
    tenant,
    companyProfile: company,
    landing: landingData
      ? {
          ...landingData,
          cover_image_url: coverImageUrl,
          profile_image_url: profileImageUrl,
        }
      : null,
    tenantSettings,
    services,
    singleSource,
  };
}

/**
 * CARGA SECUNDÁRIA (streaming; nunca bloqueia o hero): publicações aprovadas, mídias assinadas,
 * likes/comentários, avaliações e antes/depois. Falhas degradam seção a seção (nunca throw).
 */
async function loadPublicTenantSiteSecondary(slug: string): Promise<PublicTenantSiteSecondary | null> {
  const critical = await getPublicTenantSiteCritical(slug);
  if (!critical) {
    return null;
  }
  const admin = createSupabaseAdminClient() as any;
  const tenantId = critical.tenant.id;

  const [assetsResult, reviewsResult] = await Promise.allSettled([
    admin
      .from("marketing_assets")
      .select(`
        id, tenant_id, attendance_id, media_id, kind, title, generated_text, cta, hashtags, status, created_at,
        media:attendance_media(id, file_path, mime_type, caption, created_at)
      `)
      .eq("tenant_id", tenantId)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("tenant_reviews")
      .select("id, customer_name, rating, quote, sort_order, is_active")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const approvedAssets = assetsResult.status === "fulfilled" ? ((assetsResult.value.data ?? []) as any[]) : [];
  const reviews =
    reviewsResult.status === "fulfilled"
      ? ((reviewsResult.value.data ?? []) as any[]).map((item) => ({
          id: item.id,
          customerName: item.customer_name,
          rating: Number(item.rating ?? 5),
          quote: item.quote,
          sortOrder: Number(item.sort_order ?? 0),
        }))
      : [];

  // tenant_landing_media pode ainda não existir no remoto: nunca quebra a landing.
  let mediaRows: LandingMediaRow[] = [];
  try {
    const mediaResult = await admin
      .from("tenant_landing_media")
      .select("id, marketing_asset_id, file_path, mime_type, kind, sort_order, created_at")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(60);
    mediaRows = (mediaResult.data ?? []) as LandingMediaRow[];
  } catch {
    mediaRows = [];
  }

  // URLs assinadas das mídias da landing (posts/galeria)
  const signedUrlByMediaId = new Map<string, string>();
  try {
    await Promise.all(
      mediaRows.map(async (media) => {
        const signed = await admin.storage.from(ATTENDANCE_MEDIA_BUCKET).createSignedUrl(media.file_path, 3600);
        if (signed.data?.signedUrl) {
          signedUrlByMediaId.set(media.id, signed.data.signedUrl);
        }
      }),
    );
  } catch {
    // sem mídia assinada -> posts usam a capa (marketing_assets.media_id)
  }

  const attendanceIds = approvedAssets.map((asset) => asset.attendance_id).filter(Boolean);
  const [attendanceMediaResult, marketingMediaResult] = await Promise.allSettled([
    attendanceIds.length > 0
      ? admin
          .from("attendance_media")
          .select("id, attendance_id, kind, file_path, mime_type, caption, created_at")
          .in("attendance_id", attendanceIds)
          .in("kind", ["entry", "ready"])
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
    attendanceIds.length > 0
      ? admin
          .from("attendance_media")
          .select("id, attendance_id, kind, file_path, mime_type, caption, created_at")
          .in("attendance_id", attendanceIds)
          .in("kind", ["marketing"])
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const attendanceMediaRows =
    attendanceMediaResult.status === "fulfilled" ? ((attendanceMediaResult.value.data ?? []) as any[]) : [];
  const marketingRows =
    marketingMediaResult.status === "fulfilled" ? ((marketingMediaResult.value.data ?? []) as any[]) : [];

  const mediaRowsFromAttendance = [
    ...approvedAssets.map((asset) => firstRelated(asset.media)).filter(Boolean),
    ...attendanceMediaRows,
    ...marketingRows,
  ];
  const mediaUrlById = new Map<string, string | null>();
  await Promise.all(
    mediaRowsFromAttendance.map(async (media) => {
      try {
        const signed = await admin.storage.from(ATTENDANCE_MEDIA_BUCKET).createSignedUrl(media.file_path, 3600);
        mediaUrlById.set(media.id, signed.data?.signedUrl ?? null);
      } catch {
        mediaUrlById.set(media.id, null);
      }
    }),
  );

  // Linha do tempo única: TODAS as publicações aprovadas, created_at DESC.
  // Feed = 3; galeria = 8; drawer = todas. (tenant_landing_media é complemento; media_id é a capa.)
  const posts = await Promise.all(
    approvedAssets.map(async (asset) => {
      const media = firstRelated(asset.media);
      const coverUrl = media?.id ? (mediaUrlById.get(media.id) ?? null) : null;

      const postMediaRows = mediaRows
        .filter((row) => row.marketing_asset_id === asset.id && row.kind === "post")
        .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));

      let images = postMediaRows
        .map((row) => signedUrlByMediaId.get(row.id))
        .filter((url): url is string => Boolean(url));

      // Fallback de carrossel (mídias kind='marketing' do attendance) APENAS quando o post
      // NÃO tem capa própria (sem media_id): nunca substituir a capa real de outro post.
      if (images.length === 0 && asset.attendance_id && !coverUrl) {
        images = marketingRows
          .filter((row) => row.attendance_id === asset.attendance_id)
          .map((row) => mediaUrlById.get(row.id))
          .filter((url): url is string => Boolean(url));
      }

      if (images.length === 0 && coverUrl) {
        images.push(coverUrl);
      }

      // Likes/comentários podem não existir no remoto: fallback vazio.
      let likeCount = 0;
      let comments: Array<{ id: string; author_name: string; body: string; created_at: string }> = [];
      try {
        const [likeCountResult, commentsResult] = await Promise.all([
          rpcLandingPostLikeCount(asset.id),
          rpcLandingCommentsApproved(asset.id),
        ]);
        likeCount = likeCountResult.count;
        comments = commentsResult.data ?? [];
      } catch {
        likeCount = 0;
        comments = [];
      }

      return {
        id: asset.id,
        attendanceId: asset.attendance_id ?? null,
        kind: asset.kind,
        title: asset.title ?? "Publicação",
        caption: asset.generated_text,
        cta: asset.cta ?? null,
        hashtags: Array.isArray(asset.hashtags) ? asset.hashtags : [],
        createdAt: asset.created_at,
        coverMediaId: media?.id ?? null,
        imageUrl: images[0] ?? coverUrl,
        images,
        likeCount,
        comments,
      };
    }),
  );

  // DEDUPLICAÇÃO na origem: cada capa aparece NO MÁXIMO uma vez no feed/galeria.
  // 1) por media_id (associação explícita da capa); 2) proteção por URL normalizada
  // (mesmo arquivo via caminho, sem token). Posts com capa própria NUNCA usam o fallback
  // amplo por attendance_id (ver acima); os dados garantem hashes distintos.
  function coverKey(post: { coverMediaId: string | null; imageUrl: string | null }) {
    if (post.coverMediaId) {
      return `media:${post.coverMediaId}`;
    }
    const url = post.imageUrl ?? "";
    try {
      return `url:${new URL(url).pathname}`;
    } catch {
      return `url:${url}`;
    }
  }
  const seenCovers = new Set<string>();
  const uniquePosts = posts.filter((post) => {
    const key = coverKey(post);
    if (seenCovers.has(key)) {
      return false;
    }
    seenCovers.add(key);
    return true;
  });

  const gallery = uniquePosts.map((post) => ({
    id: post.id,
    url: post.imageUrl ?? "",
    title: post.title,
  }));

  type BeforeAfterItem = {
    id: string;
    title: string;
    caption: string;
    beforeUrl: string | null;
    afterUrl: string | null;
  };

  const beforeAfter = (attendanceIds
    .map((attendanceId) => {
      const rows = attendanceMediaRows.filter((item) => item.attendance_id === attendanceId);
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
    }) as Array<BeforeAfterItem | null>
  ).filter((item): item is BeforeAfterItem => item !== null);

  // feed/galeria/drawer derivam da lista DEDUPLICADA por capa (únicas por media_id/URL).
  return { posts: uniquePosts, gallery, reviews, beforeAfter };
}

export const getPublicTenantSiteCritical = cache(loadPublicTenantSiteCritical);
export const getPublicTenantSiteSecondary = cache(loadPublicTenantSiteSecondary);

/** Compatibilidade: o nome antigo retorna a carga crítica (rápida). */
export const getPublicTenantSiteBySlug = getPublicTenantSiteCritical;
