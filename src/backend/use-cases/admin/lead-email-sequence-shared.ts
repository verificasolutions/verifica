import "server-only";
import { getPublicRootUrl } from "@/backend/shared/app-url";
import { getLeadEmailSequenceByKeyAdmin, listLeadEmailSequenceStepsAdmin } from "@/backend/repos/lead-email-sequences-repo";
import type { LeadCompanyRecord, LeadEmailSequenceRecord, LeadEmailSequenceStepRecord } from "@/backend/types";

export function renderLeadEmailSequenceText(template: string | null | undefined, lead: LeadCompanyRecord) {
  const replacements: Record<string, string> = {
    "{{business_name}}": lead.business_name,
    "{{city}}": lead.city ?? "",
    "{{state}}": lead.state ?? "",
    "{{email}}": lead.email ?? "",
    "{{phone}}": lead.phone ?? "",
  };

  let output = template?.trim() ?? "";
  for (const [key, value] of Object.entries(replacements)) {
    output = output.replaceAll(key, value);
  }

  return output.trim();
}

export function normalizeSequenceImageUrl(value: string | null | undefined) {
  const imageUrl = value?.trim() ?? "";
  if (!imageUrl) {
    return null;
  }

  if (/^https?:\/\//i.test(imageUrl)) {
    return imageUrl;
  }

  const path = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
  return `${getPublicRootUrl()}${path}`;
}

export function findNextActiveLeadEmailStep(steps: LeadEmailSequenceStepRecord[], currentStep: number) {
  return steps
    .filter((step) => step.is_active && step.step_number > currentStep && step.subject?.trim() && step.body_text?.trim())
    .sort((left, right) => left.step_number - right.step_number)[0] ?? null;
}

export async function getDefaultLeadEmailSequenceConfig(): Promise<{
  sequence: LeadEmailSequenceRecord;
  steps: LeadEmailSequenceStepRecord[];
}> {
  const sequence = await getLeadEmailSequenceByKeyAdmin("lead-default");
  if (!sequence) {
    throw new Error("Cadencia padrao de e-mail nao encontrada.");
  }

  const steps = await listLeadEmailSequenceStepsAdmin(sequence.id);
  return { sequence, steps };
}
