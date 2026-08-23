"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteLandingReviewUseCase } from "@/backend/use-cases/tenant/delete-landing-review";
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
    await saveLandingPageUseCase(formData);
    revalidatePath("/app/landing");
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
