import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SocialPublicationRecord } from "@/backend/types";

const socialPublicationSelect = `
  id, tenant_id, marketing_asset_id, platform, status, instagram_media_id,
  instagram_publish_id, published_at, error_message, created_by, created_at, updated_at
`;

export async function listSocialPublicationsByTenant(tenantId: string, limit = 50) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("social_publications")
    .select(socialPublicationSelect)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as SocialPublicationRecord[]) ?? [];
}

export async function listSocialPublicationsByAssetIds(tenantId: string, assetIds: string[]) {
  if (assetIds.length === 0) {
    return new Map<string, SocialPublicationRecord[]>();
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("social_publications")
    .select(socialPublicationSelect)
    .eq("tenant_id", tenantId)
    .in("marketing_asset_id", assetIds)
    .order("created_at", { ascending: false });

  const grouped = new Map<string, SocialPublicationRecord[]>();
  for (const row of (data ?? []) as SocialPublicationRecord[]) {
    const bucket = grouped.get(row.marketing_asset_id) ?? [];
    bucket.push(row);
    grouped.set(row.marketing_asset_id, bucket);
  }

  return grouped;
}

export async function createSocialPublicationAttempt(input: {
  tenantId: string;
  marketingAssetId: string;
  createdBy: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("social_publications")
    .insert({
      tenant_id: input.tenantId,
      marketing_asset_id: input.marketingAssetId,
      platform: "instagram",
      status: "pending",
      created_by: input.createdBy,
    })
    .select(socialPublicationSelect)
    .single();

  return {
    data: (data as SocialPublicationRecord | null) ?? null,
    error: error as { message: string } | null,
  };
}

export async function markSocialPublicationPublishing(input: {
  publicationId: string;
  tenantId: string;
  instagramMediaId: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("social_publications")
    .update({
      status: "publishing",
      instagram_media_id: input.instagramMediaId,
      error_message: null,
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.publicationId);

  return error as { message: string } | null;
}

export async function markSocialPublicationPublished(input: {
  publicationId: string;
  tenantId: string;
  instagramMediaId: string | null;
  instagramPublishId: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("social_publications")
    .update({
      status: "published",
      instagram_media_id: input.instagramMediaId,
      instagram_publish_id: input.instagramPublishId,
      published_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.publicationId);

  return error as { message: string } | null;
}

export async function markSocialPublicationFailed(input: {
  publicationId: string;
  tenantId: string;
  errorMessage: string;
  instagramMediaId?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("social_publications")
    .update({
      status: "failed",
      instagram_media_id: input.instagramMediaId ?? null,
      error_message: input.errorMessage,
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.publicationId);

  return error as { message: string } | null;
}
