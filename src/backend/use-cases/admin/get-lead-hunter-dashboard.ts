import "server-only";
import { requirePlatformAdmin } from "@/backend/auth/guards";
import {
  getLatestLeadEmailDispatchAdmin,
  getLatestLeadAnalysisAdmin,
  listLeadCompanyActivitiesAdmin,
  getLatestLeadMessageAdmin,
  listLeadCompaniesAdmin,
  listLeadHunterJobsAdmin,
} from "@/backend/repos/lead-hunter-repo";
import { getLeadEmailSequenceEnrollmentAdmin } from "@/backend/repos/lead-email-sequences-repo";
import { getDefaultLeadEmailSequenceConfig } from "@/backend/use-cases/admin/lead-email-sequence-shared";
import { buildLeadWhatsappLink } from "@/backend/use-cases/admin/lead-hunter-shared";
import { getOptionalOpenAiApiKey, getOptionalResendApiKey, getOptionalSerpApiKey } from "@/lib/env";

export async function getLeadHunterDashboardUseCase(filters?: {
  niche?: string | null;
  city?: string | null;
  state?: string | null;
  withWebsite?: boolean | null;
  withPhone?: boolean | null;
  opportunityLevel?: "baixa" | "media" | "alta" | null;
  status?: "found" | "analyzed" | "message_generated" | "contacted" | "responded" | "demo_scheduled" | "closed_won" | "lost" | "kept" | "archived" | null;
  contactRiskLevel?: string | null;
  contactRoleHint?: string | null;
  recommendedChannel?: string | null;
}) {
  const admin = await requirePlatformAdmin();
  const [{ sequence, steps }, leads, jobs] = await Promise.all([
    getDefaultLeadEmailSequenceConfig(),
    listLeadCompaniesAdmin(filters),
    listLeadHunterJobsAdmin(12),
  ]);

  const leadRows = await Promise.all(
    leads.map(async (lead) => {
      const [latestAnalysis, latestWhatsappMessage, latestEmailMessage, latestEmailDispatch, latestEmailSequenceEnrollment, activities] = await Promise.all([
        getLatestLeadAnalysisAdmin(lead.id),
        getLatestLeadMessageAdmin(lead.id, "whatsapp"),
        getLatestLeadMessageAdmin(lead.id, "email"),
        getLatestLeadEmailDispatchAdmin(lead.id),
        getLeadEmailSequenceEnrollmentAdmin(lead.id, sequence.id),
        listLeadCompanyActivitiesAdmin(lead.id),
      ]);

      return {
        lead,
        latestAnalysis,
        latestWhatsappMessage,
        latestEmailMessage,
        latestEmailDispatch,
        latestEmailSequenceEnrollment,
        activities,
        whatsappLink: buildLeadWhatsappLink({
          phone: lead.phone,
          messageText: latestWhatsappMessage?.message_text ?? null,
        }),
      };
    }),
  );

  return {
    admin,
    filters: filters ?? {},
    jobs,
    leads: leadRows,
    emailSequence: {
      sequence,
      steps,
    },
    integrations: {
      serpApiReady: Boolean(getOptionalSerpApiKey()),
      openAiReady: Boolean(getOptionalOpenAiApiKey()),
      resendReady: Boolean(getOptionalResendApiKey()),
    },
  };
}
