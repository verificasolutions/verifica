import "server-only";
import { requirePlatformAdmin } from "@/backend/auth/guards";
import {
  listLeadEmailSequenceEnrollmentsAdmin,
  listLeadEmailSequenceStepsAdmin,
  upsertLeadEmailSequenceEnrollmentAdmin,
  upsertLeadEmailSequenceStepsAdmin,
} from "@/backend/repos/lead-email-sequences-repo";
import { findNextActiveLeadEmailStep, getDefaultLeadEmailSequenceConfig } from "@/backend/use-cases/admin/lead-email-sequence-shared";

function readTrimmed(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function saveLeadEmailSequenceUseCase(formData: FormData) {
  await requirePlatformAdmin();
  const { sequence } = await getDefaultLeadEmailSequenceConfig();

  const steps = Array.from({ length: 6 }, (_, index) => {
    const stepNumber = index + 1;
    const delayRaw = readTrimmed(formData, `step_${stepNumber}_delay_days`);
    const delayDays = Number.parseInt(delayRaw || "7", 10);

    return {
      stepNumber,
      subject: readTrimmed(formData, `step_${stepNumber}_subject`) || null,
      bodyText: readTrimmed(formData, `step_${stepNumber}_body_text`) || null,
      imageUrl: readTrimmed(formData, `step_${stepNumber}_image_url`) || null,
      delayDays: Number.isFinite(delayDays) && delayDays > 0 ? delayDays : 7,
      isActive: String(formData.get(`step_${stepNumber}_is_active`) ?? "").trim() === "true",
    };
  });

  const error = await upsertLeadEmailSequenceStepsAdmin({
    sequenceId: sequence.id,
    steps,
  });

  if (error) {
    throw new Error(error.message || "Nao foi possivel salvar a cadencia de e-mails.");
  }

  const [savedSteps, enrollments] = await Promise.all([
    listLeadEmailSequenceStepsAdmin(sequence.id),
    listLeadEmailSequenceEnrollmentsAdmin(sequence.id),
  ]);

  for (const enrollment of enrollments) {
    if (enrollment.status !== "active") {
      continue;
    }

    const nextStep = findNextActiveLeadEmailStep(savedSteps, enrollment.current_step);
    const anchorDate = enrollment.last_sent_at ? new Date(enrollment.last_sent_at) : new Date(enrollment.created_at);
    const nextSendAt = nextStep
      ? new Date(anchorDate.getTime() + nextStep.delay_days * 24 * 60 * 60 * 1000).toISOString()
      : null;

    await upsertLeadEmailSequenceEnrollmentAdmin({
      leadCompanyId: enrollment.lead_company_id,
      sequenceId: sequence.id,
      currentStep: enrollment.current_step,
      lastSentAt: enrollment.last_sent_at,
      nextSendAt,
      status: nextStep || enrollment.current_step < 6 ? "active" : "completed",
      lastError: enrollment.last_error,
    });
  }
}
