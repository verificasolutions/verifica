import "server-only";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { deleteTenantReview } from "@/backend/repos/tenant-reviews-repo";

export async function deleteLandingReviewUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const reviewId = String(formData.get("review_id") ?? "").trim();

  if (!reviewId) {
    throw new Error("Avaliação inválida.");
  }

  const error = await deleteTenantReview(context.tenantId, reviewId);
  if (error) {
    throw new Error(error.message);
  }
}
