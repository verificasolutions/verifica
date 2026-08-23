import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { createSupportTicketForTenant } from "@/backend/repos/support-tickets-repo";

export async function createSupportTicketUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const subject = String(formData.get("subject") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!subject) {
    redirect("/app/dashboard?section=suporte&error=Informe o assunto do suporte.");
  }

  const error = await createSupportTicketForTenant({
    tenantId: context.tenantId,
    createdBy: context.userId,
    subject,
    description: description || null,
  });

  if (error) {
    redirect(`/app/dashboard?section=suporte&error=${encodeURIComponent(error.message)}`);
  }
}
