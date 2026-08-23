import "server-only";
import { ensureLeadResendWebhookConfigured, sendLeadEmailWithResend } from "@/backend/integrations/resend-lead-email";
import { getLeadCompanyByIdAdmin, saveLeadCompanyActivityAdmin } from "@/backend/repos/lead-hunter-repo";
import { listDueLeadEmailSequenceEnrollmentsAdmin } from "@/backend/repos/lead-email-sequences-repo";
import { buildLeadEmailContentFromStep, persistLeadEmailSequenceStepSend } from "@/backend/use-cases/admin/lead-email-sequence-dispatch-shared";
import { getDefaultLeadEmailSequenceConfig } from "@/backend/use-cases/admin/lead-email-sequence-shared";

export async function processLeadEmailSequencesUseCase() {
  await ensureLeadResendWebhookConfigured();

  const { sequence, steps } = await getDefaultLeadEmailSequenceConfig();
  const dueEnrollments = await listDueLeadEmailSequenceEnrollmentsAdmin(sequence.id, 100);

  let processed = 0;
  let sent = 0;
  let failed = 0;

  for (const enrollment of dueEnrollments) {
    processed += 1;
    const nextStep = steps.find(
      (step) =>
        step.step_number > enrollment.current_step &&
        step.is_active &&
        step.subject?.trim() &&
        step.body_text?.trim(),
    );

    if (!nextStep) {
      continue;
    }

    const lead = await getLeadCompanyByIdAdmin(enrollment.lead_company_id);
    if (!lead?.email?.trim()) {
      failed += 1;
      await saveLeadCompanyActivityAdmin({
        leadCompanyId: enrollment.lead_company_id,
        activityType: "email_failed",
        channel: "email",
        note: "Cadencia automatica nao enviada porque o lead nao possui e-mail valido.",
        createdByEmail: "cron@verificasolutions.com.br",
      });
      continue;
    }

    try {
      const content = buildLeadEmailContentFromStep({
        lead,
        step: nextStep,
      });

      const result = await sendLeadEmailWithResend({
        lead,
        content,
        idempotencyKey: `lead-sequence-${sequence.id}-${lead.id}-step-${nextStep.step_number}`,
      });

      if (!result.id) {
        throw new Error("O Resend nao retornou o identificador do e-mail.");
      }

      await persistLeadEmailSequenceStepSend({
        lead,
        sequenceId: sequence.id,
        step: nextStep,
        steps,
        providerEmailId: result.id,
        subject: result.subject,
        body: content.body,
        createdByEmail: "cron@verificasolutions.com.br",
        previousEnrollment: enrollment,
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      await saveLeadCompanyActivityAdmin({
        leadCompanyId: enrollment.lead_company_id,
        activityType: "email_failed",
        channel: "email",
        note: error instanceof Error ? error.message : "Falha ao processar a cadencia automatica.",
        createdByEmail: "cron@verificasolutions.com.br",
      });
    }
  }

  return {
    processed,
    sent,
    failed,
    checkedAt: new Date().toISOString(),
  };
}
