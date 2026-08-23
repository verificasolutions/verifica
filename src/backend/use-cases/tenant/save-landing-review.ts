import "server-only";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { upsertTenantReview } from "@/backend/repos/tenant-reviews-repo";

function text(formData: FormData, field: string) {
  return String(formData.get(field) ?? "").trim();
}

export async function saveLandingReviewUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const customerName = text(formData, "customer_name");
  const quote = text(formData, "quote");
  const rating = Number(text(formData, "rating") || "5");
  const sortOrder = Number(text(formData, "sort_order") || "0");

  if (!customerName || !quote) {
    throw new Error("Preencha nome e avaliação.");
  }

  const error = await upsertTenantReview({
    id: text(formData, "review_id") || undefined,
    tenantId: context.tenantId,
    customerName,
    quote,
    rating: Number.isFinite(rating) ? Math.max(1, Math.min(5, rating)) : 5,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    isActive: String(formData.get("is_active") ?? "").trim() === "true",
  });

  if (error) {
    throw new Error(error.message);
  }
}
