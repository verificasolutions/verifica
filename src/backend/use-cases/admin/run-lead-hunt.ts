import "server-only";
import { requirePlatformAdmin } from "@/backend/auth/guards";
import { searchLocalBusinesses } from "@/backend/integrations/local-search";
import {
  createLeadHunterJobAdmin,
  findLeadCompanyDuplicateAdmin,
  saveLeadAnalysisAdmin,
  updateLeadHunterJobAdmin,
  upsertLeadCompanyAdmin,
} from "@/backend/repos/lead-hunter-repo";
import { buildLeadAnalysisFromCompany } from "@/backend/use-cases/admin/lead-hunter-shared";

function requiredText(value: FormDataEntryValue | null, label: string) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} é obrigatório.`);
  return text;
}

function numberInRange(value: FormDataEntryValue | null, label: string, min: number, max: number) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} inválido.`);
  }
  return parsed;
}

export async function runLeadHuntUseCase(formData: FormData) {
  await requirePlatformAdmin();

  const niche = requiredText(formData.get("niche"), "Nicho");
  const city = requiredText(formData.get("city"), "Cidade");
  const state = requiredText(formData.get("state"), "Estado").toUpperCase();
  const radiusKm = numberInRange(formData.get("radius_km"), "Raio", 1, 300);
  const maxResults = numberInRange(formData.get("max_results"), "Quantidade máxima", 1, 50);

  const jobResult = await createLeadHunterJobAdmin({
    niche,
    city,
    state,
    radiusKm,
    maxResults,
  });

  if (jobResult.error || !jobResult.data) {
    throw new Error(jobResult.error?.message ?? "Não foi possível abrir o job de prospecção.");
  }

  try {
    const results = await searchLocalBusinesses({ niche, city, state, radiusKm, maxResults });
    let totalSaved = 0;
    let totalDuplicates = 0;

    for (const result of results) {
      const duplicate = await findLeadCompanyDuplicateAdmin({
        businessName: result.businessName,
        phone: result.phone,
        address: result.address,
        city: result.city,
      });

      const analysis = buildLeadAnalysisFromCompany({
        website: result.website,
        phone: result.phone,
        googleMapsUrl: result.googleMapsUrl,
        rating: result.rating,
        reviewCount: result.reviewCount,
        rawData: result.rawData,
      });

      const companyResult = await upsertLeadCompanyAdmin({
        existingId: duplicate?.id ?? null,
        businessName: result.businessName,
        businessType: result.businessType,
        phone: result.phone,
        address: result.address,
        city: result.city,
        state: result.state,
        latitude: result.latitude,
        longitude: result.longitude,
        website: result.website,
        googleMapsUrl: result.googleMapsUrl,
        rating: result.rating,
        reviewCount: result.reviewCount,
        source: result.source,
        rawData: result.rawData,
        opportunityScore: analysis.opportunityScore,
        opportunityLevel: analysis.opportunityLevel,
        status: duplicate?.status ?? "found",
      });

      if (companyResult.error || !companyResult.data) {
        continue;
      }

      await saveLeadAnalysisAdmin({
        leadCompanyId: companyResult.data.id,
        hasWebsite: analysis.hasWebsite,
        hasPhone: analysis.hasPhone,
        hasGoogleMaps: analysis.hasGoogleMaps,
        hasInstagram: analysis.hasInstagram,
        instagramUrl: analysis.instagramUrl,
        hasLowReviews: analysis.hasLowReviews,
        hasPoorPresence: analysis.hasPoorPresence,
        problemsFound: analysis.problemsFound,
        opportunityReason: analysis.opportunityReason,
        aiSummary: null,
      });

      totalSaved += 1;
      if (duplicate) totalDuplicates += 1;
    }

    await updateLeadHunterJobAdmin({
      jobId: jobResult.data.id,
      totalFound: results.length,
      totalSaved,
      totalDuplicates,
      status: "finished",
      errorMessage: null,
      finishedAt: new Date().toISOString(),
    });
  } catch (error) {
    await updateLeadHunterJobAdmin({
      jobId: jobResult.data.id,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Falha ao caçar clientes.",
      finishedAt: new Date().toISOString(),
    });
    throw error;
  }
}
