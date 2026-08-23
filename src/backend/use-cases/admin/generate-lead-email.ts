import "server-only";
import { requirePlatformAdmin } from "@/backend/auth/guards";
import { generateLeadEmailMessage } from "@/backend/integrations/openai-lead-email";
import {
  getLatestLeadAnalysisAdmin,
  listLeadCompaniesAdmin,
  saveLeadCompanyActivityAdmin,
  saveLeadMessageAdmin,
} from "@/backend/repos/lead-hunter-repo";

export async function generateLeadEmailUseCase(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const leadCompanyId = String(formData.get("lead_company_id") ?? "").trim();
  if (!leadCompanyId) throw new Error("Lead invalido.");

  const lead = (await listLeadCompaniesAdmin()).find((item) => item.id === leadCompanyId);
  if (!lead) throw new Error("Lead nao encontrado.");
  if (!lead.email?.trim()) throw new Error("Esse lead nao possui e-mail.");

  const latestAnalysis = await getLatestLeadAnalysisAdmin(leadCompanyId);
  const draft = await generateLeadEmailMessage({
    lead,
    analysis: latestAnalysis,
  });

  await saveLeadMessageAdmin({
    leadCompanyId,
    subject: draft.subject,
    messageText: draft.body,
    messageType: "email",
  });

  await saveLeadCompanyActivityAdmin({
    leadCompanyId,
    activityType: "email_generated",
    channel: "email",
    note: `Rascunho de e-mail gerado. Assunto: ${draft.subject}`,
    createdByEmail: admin.email,
  });
}
