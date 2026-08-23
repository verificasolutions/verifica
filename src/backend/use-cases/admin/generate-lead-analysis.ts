import "server-only";
import { requirePlatformAdmin } from "@/backend/auth/guards";
import { generateLeadAiSummary } from "@/backend/integrations/openai-lead-analysis";
import {
  getLatestLeadAnalysisAdmin,
  listLeadCompaniesAdmin,
  saveLeadAnalysisAdmin,
  saveLeadCompanyActivityAdmin,
  updateLeadCompanyStatusAdmin,
} from "@/backend/repos/lead-hunter-repo";
import { buildLeadAnalysisFromCompany } from "@/backend/use-cases/admin/lead-hunter-shared";

export async function generateLeadAnalysisUseCase(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const leadCompanyId = String(formData.get("lead_company_id") ?? "").trim();
  if (!leadCompanyId) throw new Error("Lead inválido.");

  const lead = (await listLeadCompaniesAdmin()).find((item) => item.id === leadCompanyId);
  if (!lead) throw new Error("Lead não encontrado.");

  const latestAnalysis = await getLatestLeadAnalysisAdmin(leadCompanyId);
  const analysisBase =
    latestAnalysis ??
    (() => {
      const fallback = buildLeadAnalysisFromCompany({
        website: lead.website,
        phone: lead.phone,
        googleMapsUrl: lead.google_maps_url,
        rating: lead.rating,
        reviewCount: lead.review_count,
        rawData: lead.raw_data,
      });

      return {
        id: "",
        lead_company_id: lead.id,
        has_website: fallback.hasWebsite,
        has_phone: fallback.hasPhone,
        has_google_maps: fallback.hasGoogleMaps,
        has_instagram: fallback.hasInstagram,
        instagram_url: fallback.instagramUrl,
        has_low_reviews: fallback.hasLowReviews,
        has_poor_presence: fallback.hasPoorPresence,
        problems_found: fallback.problemsFound,
        opportunity_reason: fallback.opportunityReason,
        ai_summary: null,
        created_at: new Date().toISOString(),
      };
    })();

  const aiSummary = await generateLeadAiSummary({
    lead,
    analysis: analysisBase,
  });

  await saveLeadAnalysisAdmin({
    leadCompanyId,
    hasWebsite: analysisBase.has_website,
    hasPhone: analysisBase.has_phone,
    hasGoogleMaps: analysisBase.has_google_maps,
    hasInstagram: analysisBase.has_instagram,
    instagramUrl: analysisBase.instagram_url,
    hasLowReviews: analysisBase.has_low_reviews,
    hasPoorPresence: analysisBase.has_poor_presence,
    problemsFound: analysisBase.problems_found,
    opportunityReason: analysisBase.opportunity_reason,
    aiSummary,
  });

  await updateLeadCompanyStatusAdmin(leadCompanyId, "analyzed");
  await saveLeadCompanyActivityAdmin({
    leadCompanyId,
    activityType: "analysis_generated",
    channel: "ia",
    note: "Análise comercial gerada por IA.",
    createdByEmail: admin.email,
  });
}
