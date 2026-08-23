import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MarketingAssetRecord } from "@/backend/types";

export async function listMarketingAssetsByTenant(tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("marketing_assets")
    .select("id, tenant_id, attendance_id, media_id, kind, title, generated_text, cta, hashtags, status, prompt_snapshot, created_at, approved_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(30);

  return ((data ?? []) as MarketingAssetRecord[]).map((item) => ({
    ...item,
    hashtags: item.hashtags ?? [],
    prompt_snapshot: item.prompt_snapshot ?? {},
    approved_at: item.approved_at ?? null,
  }));
}

export async function getMarketingAssetByIdForTenant(tenantId: string, assetId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("marketing_assets")
    .select("id, tenant_id, attendance_id, media_id, kind, title, generated_text, cta, hashtags, status, prompt_snapshot, created_at, approved_at")
    .eq("tenant_id", tenantId)
    .eq("id", assetId)
    .maybeSingle();

  if (!data) {
    return null;
  }

  const item = data as MarketingAssetRecord;
  return {
    ...item,
    hashtags: item.hashtags ?? [],
    prompt_snapshot: item.prompt_snapshot ?? {},
    approved_at: item.approved_at ?? null,
  };
}

export async function createMarketingAssetForTenant(input: {
  tenantId: string;
  attendanceId: string | null;
  mediaId: string | null;
  kind: "post" | "story" | "promo";
  title: string | null;
  generatedText: string;
  cta: string | null;
  hashtags: string[];
  promptSnapshot: Record<string, unknown>;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("marketing_assets").insert({
    tenant_id: input.tenantId,
    attendance_id: input.attendanceId,
    media_id: input.mediaId,
    kind: input.kind,
    title: input.title,
    generated_text: input.generatedText,
    cta: input.cta,
    hashtags: input.hashtags,
    prompt_snapshot: input.promptSnapshot,
    status: "draft",
  });

  return error ? { message: error.message } : null;
}

export async function updateMarketingAssetStatusForTenant(input: {
  tenantId: string;
  assetId: string;
  status: "draft" | "approved" | "discarded";
}) {
  const supabase = await createSupabaseServerClient();
  const patch: Record<string, unknown> = {
    status: input.status,
    approved_at: input.status === "approved" ? new Date().toISOString() : null,
  };
  const { error } = await supabase
    .from("marketing_assets")
    .update(patch)
    .eq("tenant_id", input.tenantId)
    .eq("id", input.assetId);

  return error ? { message: error.message } : null;
}
