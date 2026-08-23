"use server";

import { revalidatePath } from "next/cache";
import { createCommercialIntakeUseCase } from "@/backend/use-cases/public/create-commercial-intake";

export type CommercialIntakeFormState = {
  error?: string;
  paymentPath?: string;
};

export async function submitCommercialIntakeAction(_: CommercialIntakeFormState, formData: FormData): Promise<CommercialIntakeFormState> {
  try {
    const intake = await createCommercialIntakeUseCase(formData);
    revalidatePath("/admin");
    return { paymentPath: `/quero/pagamento/${intake.id}` };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Falha ao salvar o cadastro comercial.",
    };
  }
}
