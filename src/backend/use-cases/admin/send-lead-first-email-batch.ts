import "server-only";
import { ensureLeadResendWebhookConfigured, sendLeadEmailBatchWithResend, sendLeadEmailWithResend } from "@/backend/integrations/resend-lead-email";
import { requirePlatformAdmin } from "@/backend/auth/guards";
import {
  getLatestLeadEmailDispatchAdmin,
  listLeadCompaniesAdmin,
  saveLeadCompanyActivityAdmin,
} from "@/backend/repos/lead-hunter-repo";
import { getLeadEmailSequenceEnrollmentAdmin } from "@/backend/repos/lead-email-sequences-repo";
import { persistLeadEmailSequenceStepSend, buildLeadEmailContentFromStep } from "@/backend/use-cases/admin/lead-email-sequence-dispatch-shared";
import { getDefaultLeadEmailSequenceConfig } from "@/backend/use-cases/admin/lead-email-sequence-shared";
import type { LeadCompanyRecord } from "@/backend/types";

function normalizeLeadIds(formData: FormData) {
  return [...new Set(formData.getAll("lead_company_ids").map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function shouldSkipBecauseAlreadySent(status: string | null | undefined) {
  return status === "sent" || status === "delivered" || status === "opened" || status === "clicked" || status === "complained";
}

async function markEmailSkipped(input: {
  leadCompanyId: string;
  reason: string;
  createdByEmail: string | null;
}) {
  await saveLeadCompanyActivityAdmin({
    leadCompanyId: input.leadCompanyId,
    activityType: "email_skipped",
    channel: "email",
    note: input.reason,
    createdByEmail: input.createdByEmail,
  });
}

async function markEmailFailed(input: {
  leadCompanyId: string;
  reason: string;
  createdByEmail: string | null;
}) {
  await saveLeadCompanyActivityAdmin({
    leadCompanyId: input.leadCompanyId,
    activityType: "email_failed",
    channel: "email",
    note: input.reason,
    createdByEmail: input.createdByEmail,
  });
}

export async function sendLeadFirstEmailBatchUseCase(formData: FormData) {
  const admin = await requirePlatformAdmin();
  await ensureLeadResendWebhookConfigured();

  const leadIds = normalizeLeadIds(formData);
  if (!leadIds.length) {
    throw new Error("Nenhum lead foi enviado para o disparo.");
  }

  const { sequence, steps } = await getDefaultLeadEmailSequenceConfig();
  const firstStep = steps.find((step) => step.step_number === 1);
  if (!firstStep?.is_active || !firstStep.subject?.trim() || !firstStep.body_text?.trim()) {
    throw new Error("O e-mail 1 da cadencia precisa estar ativo, com assunto e texto.");
  }

  const leads = (await listLeadCompaniesAdmin()).filter((lead) => leadIds.includes(lead.id));
  const prepared = await Promise.all(
    leads.map(async (lead) => {
      const email = lead.email?.trim().toLowerCase() ?? "";
      if (!email || !isValidEmail(email)) {
        await markEmailSkipped({
          leadCompanyId: lead.id,
          reason: "Lead ignorado no disparo em massa porque nao possui e-mail valido.",
          createdByEmail: admin.email,
        });
        return null;
      }

      const [latestDispatch, enrollment] = await Promise.all([
        getLatestLeadEmailDispatchAdmin(lead.id),
        getLeadEmailSequenceEnrollmentAdmin(lead.id, sequence.id),
      ]);

      if ((enrollment?.current_step ?? 0) >= 1) {
        await markEmailSkipped({
          leadCompanyId: lead.id,
          reason: "Lead ignorado porque ja entrou na cadencia automatica.",
          createdByEmail: admin.email,
        });
        return null;
      }

      if (shouldSkipBecauseAlreadySent(latestDispatch?.status)) {
        await markEmailSkipped({
          leadCompanyId: lead.id,
          reason: `Lead ignorado porque o ultimo disparo ja consta como ${latestDispatch?.status}.`,
          createdByEmail: admin.email,
        });
        return null;
      }

      return {
        lead,
        content: buildLeadEmailContentFromStep({
          lead,
          step: firstStep,
        }),
      };
    }),
  );

  const items = prepared.filter((item): item is { lead: LeadCompanyRecord; content: { subject: string; body: string; imageUrl: string | null } } => Boolean(item));

  let sent = 0;
  let failed = 0;
  const skipped = leadIds.length - items.length;

  for (const chunk of chunkArray(items, 100)) {
    try {
      const results = await sendLeadEmailBatchWithResend({
        items: chunk,
        idempotencyKey: `lead-sequence-step-1-batch-${crypto.randomUUID()}`,
      });

      for (const result of results) {
        if (!result.id) {
          failed += 1;
          await markEmailFailed({
            leadCompanyId: result.lead.id,
            reason: "O Resend nao retornou o identificador do e-mail no lote.",
            createdByEmail: admin.email,
          });
          continue;
        }

        await persistLeadEmailSequenceStepSend({
          lead: result.lead,
          sequenceId: sequence.id,
          step: firstStep,
          steps,
          providerEmailId: result.id,
          subject: result.subject,
          body: result.content.body,
          createdByEmail: admin.email,
        });
        sent += 1;
      }
      continue;
    } catch {
      for (const item of chunk) {
        try {
          const result = await sendLeadEmailWithResend({
            lead: item.lead,
            content: item.content,
            idempotencyKey: `lead-sequence-step-1-${item.lead.id}`,
          });

          if (!result.id) {
            throw new Error("O Resend nao retornou o identificador do e-mail.");
          }

          await persistLeadEmailSequenceStepSend({
            lead: item.lead,
            sequenceId: sequence.id,
            step: firstStep,
            steps,
            providerEmailId: result.id,
            subject: result.subject,
            body: item.content.body,
            createdByEmail: admin.email,
          });
          sent += 1;
        } catch (error) {
          failed += 1;
          await markEmailFailed({
            leadCompanyId: item.lead.id,
            reason: error instanceof Error ? error.message : "Falha ao enviar o primeiro e-mail da cadencia.",
            createdByEmail: admin.email,
          });
        }
      }
    }
  }

  return {
    sent,
    failed,
    skipped,
  };
}
