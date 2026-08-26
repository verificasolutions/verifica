"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteLandingReviewUseCase } from "@/backend/use-cases/tenant/delete-landing-review";
import { reviewLandingCommentUseCase } from "@/backend/use-cases/tenant/review-landing-comment";
import { saveLandingPageUseCase } from "@/backend/use-cases/tenant/save-landing-page";
import { saveLandingReviewUseCase } from "@/backend/use-cases/tenant/save-landing-review";

export type LandingPageActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const LANDING_ROUTE = "/verifica/app/landing";

export async function saveLandingPageAction(
  _prevState: LandingPageActionState,
  formData: FormData,
): Promise<LandingPageActionState> {
  try {
    const result = await saveLandingPageUseCase(formData);
    revalidatePath("/app/landing");
    if (result.tenantSlug) {
      // a landing pública reflete a edição imediatamente
      revalidatePath(`/verifica/${result.tenantSlug}`);
      revalidatePath(`/${result.tenantSlug}`);
    }
    return {
      status: "success",
      message: "Landing salva.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao salvar a landing.";
    return {
      status: "error",
      message,
    };
  }
}

export async function saveLandingReviewAction(formData: FormData) {
  try {
    await saveLandingReviewUseCase(formData);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao salvar a avaliação.";
    redirect(`${LANDING_ROUTE}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/app/landing");
  redirect(`${LANDING_ROUTE}?message=${encodeURIComponent("Avaliação salva.")}`);
}

export async function deleteLandingReviewAction(formData: FormData) {
  try {
    await deleteLandingReviewUseCase(formData);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao remover a avaliação.";
    redirect(`${LANDING_ROUTE}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/app/landing");
  redirect(`${LANDING_ROUTE}?message=${encodeURIComponent("Avaliação removida.")}`);
}

export async function reviewLandingCommentAction(formData: FormData) {
  const commentId = String(formData.get("comment_id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!commentId || (status !== "approved" && status !== "rejected")) {
    redirect(`${LANDING_ROUTE}?error=${encodeURIComponent("Revisão inválida.")}`);
  }

  try {
    await reviewLandingCommentUseCase({ commentId, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao revisar o comentário.";
    redirect(`${LANDING_ROUTE}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/app/landing");
  redirect(`${LANDING_ROUTE}?message=${encodeURIComponent(`Comentário ${status === "approved" ? "aprovado" : "rejeitado"}.`)}`);
}
