import "server-only";
import { requirePlatformAdmin } from "@/backend/auth/guards";
import { ensureLeadResendWebhookConfigured, sendLeadEmailWithResend } from "@/backend/integrations/resend-lead-email";
import {
  createLeadEmailDispatchAdmin,
  getLatestLeadMessageAdmin,
  listLeadCompaniesAdmin,
  saveLeadCompanyActivityAdmin,
  updateLeadCompanyStatusAdmin,
} from "@/backend/repos/lead-hunter-repo";

export async function sendLeadEmailUseCase(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const leadCompanyId = String(formData.get("lead_company_id") ?? "").trim();
  if (!leadCompanyId) throw new Error("Lead invalido.");

  const lead = (await listLeadCompaniesAdmin()).find((item) => item.id === leadCompanyId);
  if (!lead) throw new Error("Lead nao encontrado.");
  if (!lead.email?.trim()) throw new Error("Esse lead nao possui e-mail.");

  const latestEmail = await getLatestLeadMessageAdmin(leadCompanyId, "email");
  if (!latestEmail?.message_text?.trim()) {
    throw new Error("Gere o rascunho do e-mail antes de enviar.");
  }

  await ensureLeadResendWebhookConfigured();

  const result = await sendLeadEmailWithResend({
    lead,
    content: {
      subject: latestEmail.subject?.trim() || `Ideia rapida para ${lead.business_name}`,
      body: latestEmail.message_text,
      imageUrl: null,
    },
    idempotencyKey: `lead-email-${lead.id}-${latestEmail.id}`,
  });

  if (!result.id) {
    throw new Error("Resend nao retornou o identificador do e-mail.");
  }

  await createLeadEmailDispatchAdmin({
    leadCompanyId,
    leadMessageId: latestEmail.id,
    providerEmailId: result.id,
    recipientEmail: lead.email.trim().toLowerCase(),
    subject: result.subject,
    status: "sent",
    lastEvent: "api_accepted",
    rawEvents: [
      {
        type: "api_accepted",
        provider_email_id: result.id,
        created_at: new Date().toISOString(),
      },
    ],
  });

  await updateLeadCompanyStatusAdmin(leadCompanyId, "contacted");
  await saveLeadCompanyActivityAdmin({
    leadCompanyId,
    activityType: "email_sent",
    channel: "email",
    note: `E-mail enviado para ${lead.email}. Assunto: ${result.subject}. Resend ID: ${result.id}`,
    createdByEmail: admin.email,
  });
}
