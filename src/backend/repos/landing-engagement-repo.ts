/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ApprovedLandingComment = {
  id: string;
  author_name: string;
  body: string;
  created_at: string;
};

export type PendingLandingComment = {
  id: string;
  marketing_asset_id: string;
  author_name: string;
  body: string;
  moderation_suggestion: string | null;
  status: string;
  created_at: string;
};

export async function findApprovedAssetTenant(assetId: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("marketing_assets")
    .select("tenant_id")
    .eq("id", assetId)
    .eq("status", "approved")
    .maybeSingle();

  return (data?.tenant_id as string | undefined) ?? null;
}

export async function rpcLandingLikePost(assetId: string, identityHash: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data, error } = await admin.rpc("landing_like_post", {
    p_marketing_asset_id: assetId,
    p_identity_hash: identityHash,
  });
  return { count: Number(data ?? 0), error: error as { message: string } | null };
}

export async function rpcLandingPostLikeCount(assetId: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data, error } = await admin.rpc("landing_post_like_count", { p_marketing_asset_id: assetId });
  return { count: Number(data ?? 0), error: error as { message: string } | null };
}

export async function rpcLandingCommentSubmit(input: {
  assetId: string;
  authorName: string;
  identityHash: string;
  body: string;
}) {
  const admin = createSupabaseAdminClient() as any;
  const { data, error } = await admin.rpc("landing_comment_submit", {
    p_marketing_asset_id: input.assetId,
    p_author_name: input.authorName,
    p_author_identity_hash: input.identityHash,
    p_body: input.body,
  });
  return { id: (data as string | null | undefined) ?? null, error: error as { message: string } | null };
}

export async function rpcLandingCommentsApproved(assetId: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data, error } = await admin.rpc("landing_comments_approved", { p_marketing_asset_id: assetId });
  return { data: (data ?? []) as ApprovedLandingComment[], error: error as { message: string } | null };
}

export async function updateLandingCommentModerationSuggestion(commentId: string, suggestion: string) {
  const admin = createSupabaseAdminClient() as any;
  await admin
    .from("landing_comments")
    .update({ moderation_suggestion: suggestion.slice(0, 200) })
    .eq("id", commentId);
}

export async function listPendingLandingCommentsByTenant(tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("landing_comments")
    .select("id, marketing_asset_id, author_name, body, moderation_suggestion, status, created_at")
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);

  return (data ?? []) as PendingLandingComment[];
}

export async function updateLandingCommentStatus(input: {
  tenantId: string;
  commentId: string;
  status: "approved" | "rejected";
  reviewedBy: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("landing_comments")
    .update({
      status: input.status,
      reviewed_by: input.reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.commentId);

  return error as { message: string } | null;
}
