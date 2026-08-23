import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { saveLandingPageUseCase } from "@/backend/use-cases/tenant/save-landing-page";

export async function POST(request: Request) {
  const formData = await request.formData();

  try {
    const result = await saveLandingPageUseCase(formData);
    revalidatePath("/app/landing");
    if (result.tenantSlug) {
      revalidatePath(`/${result.tenantSlug}`);
    }
    return NextResponse.json({
      ok: true,
      message: "Landing salva.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao salvar a landing.";
    return NextResponse.json(
      {
        ok: false,
        message,
      },
      {
        status: 500,
      },
    );
  }
}
