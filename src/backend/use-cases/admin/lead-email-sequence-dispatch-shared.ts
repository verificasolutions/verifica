import "server-only";
import {
  createLeadEmailDispatchAdmin,
  saveLeadCompanyActivityAdmin,
  saveLeadMessageAdmin,
  updateLeadCompanyStatusAdmin,
} from "@/backend/repos/lead-hunter-repo";
import { upsertLeadEmailSequenceEnrollmentAdmin } from "@/backend/repos/lead-email-sequences-repo";
import { findNextActiveLeadEmailStep, normalizeSequenceImageUrl, renderLeadEmailSequenceText } from "@/backend/use-cases/admin/lead-email-sequence-shared";
import type {
  LeadCompanyRecord,
  LeadEmailSequenceEnrollmentRecord,
  LeadEmailSequenceStepRecord,
} from "@/backend/types";

export function buildLeadEmailContentFromStep(input: {
  lead: LeadCompanyRecord;
  step: LeadEmailSequenceStepRecord;
}) {
  return {
    subject: renderLeadEmailSequenceText(input.step.subject, input.lead),
    body: renderLeadEmailSequenceText(input.step.body_text, input.lead),
    imageUrl: normalizeSequenceImageUrl(input.step.image_url),
  };
}

export async function persistLeadEmailSequenceStepSend(input: {
  lead: LeadCompanyRecord;
  sequenceId: string;
  step: LeadEmailSequenceStepRecord;
  steps: LeadEmailSequenceStepRecord[];
  providerEmailId: string;
  subject: string;
  body: string;
  createdByEmail: string | null;
  previousEnrollment?: LeadEmailSequenceEnrollmentRecord | null;
}) {
  const savedMessage = await saveLeadMessageAdmin({
    leadCompanyId: input.lead.id,
    subject: input.subject,
    messageText: input.body,
    messageType: "email",
  });

  if (savedMessage.error || !savedMessage.data) {
    throw new Error(savedMessage.error?.message || "Nao foi possivel salvar o e-mail da sequencia.");
  }

  await createLeadEmailDispatchAdmin({
    leadCompanyId: input.lead.id,
    leadMessageId: savedMessage.data.id,
    providerEmailId: input.providerEmailId,
    recipientEmail: input.lead.email!.trim().toLowerCase(),
    subject: input.subject,
    status: "sent",
    lastEvent: "api_accepted",
    rawEvents: [
      {
        type: "api_accepted",
        provider_email_id: input.providerEmailId,
        sequence_step: input.step.step_number,
        created_at: new Date().toISOString(),
      },
    ],
  });

  const nextStep = findNextActiveLeadEmailStep(input.steps, input.step.step_number);
  const now = new Date();
  const nextSendAt = nextStep
    ? new Date(now.getTime() + nextStep.delay_days * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const nextStatus: LeadEmailSequenceEnrollmentRecord["status"] =
    nextStep || input.step.step_number < 6 ? "active" : "completed";

  const enrollment = await upsertLeadEmailSequenceEnrollmentAdmin({
    leadCompanyId: input.lead.id,
    sequenceId: input.sequenceId,
    currentStep: input.step.step_number,
    nextSendAt,
    lastSentAt: now.toISOString(),
    status: nextStatus,
    lastError: null,
  });

  if (enrollment.error) {
    throw new Error(enrollment.error.message);
  }

  await updateLeadCompanyStatusAdmin(input.lead.id, "contacted");
  await saveLeadCompanyActivityAdmin({
    leadCompanyId: input.lead.id,
    activityType: "email_sequence_sent",
    channel: "email",
    note: `E-mail ${input.step.step_number} da cadencia enviado para ${input.lead.email}. Assunto: ${input.subject}. Resend ID: ${input.providerEmailId}${nextStep ? `. Proximo e-mail previsto para ${new Intl.DateTimeFormat("pt-BR").format(new Date(nextSendAt!))}.` : ""}`,
    createdByEmail: input.createdByEmail,
  });

  if (!nextStep) {
    await saveLeadCompanyActivityAdmin({
      leadCompanyId: input.lead.id,
      activityType: "email_sequence_completed",
      channel: "email",
      note: "Cadencia automatica concluida para este lead.",
      createdByEmail: input.createdByEmail,
    });
  }
}
