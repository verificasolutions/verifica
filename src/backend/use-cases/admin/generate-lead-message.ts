import "server-only";
import { requirePlatformAdmin } from "@/backend/auth/guards";
import { generateLeadWhatsappMessage } from "@/backend/integrations/openai-lead-message";
import {
  getLatestLeadAnalysisAdmin,
  listLeadCompaniesAdmin,
  saveLeadCompanyActivityAdmin,
  saveLeadMessageAdmin,
  updateLeadCompanyStatusAdmin,
} from "@/backend/repos/lead-hunter-repo";

export async function generateLeadMessageUseCase(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const leadCompanyId = String(formData.get("lead_company_id") ?? "").trim();
  if (!leadCompanyId) throw new Error("Lead inválido.");

  const lead = (await listLeadCompaniesAdmin()).find((item) => item.id === leadCompanyId);
  if (!lead) throw new Error("Lead não encontrado.");

  const latestAnalysis = await getLatestLeadAnalysisAdmin(leadCompanyId);
  const messageText = await generateLeadWhatsappMessage({
    lead,
    analysis: latestAnalysis,
  });

  await saveLeadMessageAdmin({
    leadCompanyId,
    messageText,
    messageType: "whatsapp",
  });

  await updateLeadCompanyStatusAdmin(leadCompanyId, "message_generated");
  await saveLeadCompanyActivityAdmin({
    leadCompanyId,
    activityType: "message_generated",
    channel: "whatsapp",
    note: "Mensagem inicial gerada para abordagem.",
    createdByEmail: admin.email,
  });
}
