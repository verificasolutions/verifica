import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { sendEvolutionTextMessage } from "@/backend/integrations/evolution";
import { digitsOnly } from "@/backend/shared/input-normalizers";

export async function sendWhatsappTestUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const number = digitsOnly(String(formData.get("test_number") ?? "").trim());

  if (!number) {
    redirect("/app/dashboard?error=Informe um número para teste.");
  }

  const result = await sendEvolutionTextMessage({
    tenantId: context.tenantId,
    number,
    text: `Teste de conexão Evolution - ${context.tenant.name}`,
  });

  if (!result.ok) {
    redirect(`/app/dashboard?error=${encodeURIComponent(result.message)}`);
  }
}
