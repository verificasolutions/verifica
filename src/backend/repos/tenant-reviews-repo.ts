import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TenantReviewRecord } from "@/backend/types";

const reviewSelect = "id, tenant_id, customer_name, rating, quote, sort_order, is_active, created_at, updated_at";

export async function listTenantReviews(tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("tenant_reviews")
    .select(reviewSelect)
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  return ((data ?? []) as TenantReviewRecord[]).map((item) => ({
    ...item,
    rating: Number(item.rating ?? 5),
    sort_order: Number(item.sort_order ?? 0),
  }));
}

export async function upsertTenantReview(input: {
  id?: string;
  tenantId: string;
  customerName: string;
  rating: number;
  quote: string;
  sortOrder: number;
  isActive: boolean;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("tenant_reviews").upsert({
    ...(input.id ? { id: input.id } : {}),
    tenant_id: input.tenantId,
    customer_name: input.customerName,
    rating: input.rating,
    quote: input.quote,
    sort_order: input.sortOrder,
    is_active: input.isActive,
  });

  return error ? { message: error.message } : null;
}

export async function deleteTenantReview(tenantId: string, reviewId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("tenant_reviews").delete().eq("tenant_id", tenantId).eq("id", reviewId);
  return error ? { message: error.message } : null;
}
