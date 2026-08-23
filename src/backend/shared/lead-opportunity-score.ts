import "server-only";
import type { LeadCompanyRecord } from "@/backend/types";

export function calculateLeadOpportunityScore(input: {
  lead: Pick<LeadCompanyRecord, "website" | "phone" | "google_maps_url" | "rating" | "review_count">;
  instagramUrl?: string | null;
}) {
  const problemsFound: string[] = [];
  let score = 0;

  const hasWebsite = Boolean(input.lead.website?.trim());
  const hasPhone = Boolean(input.lead.phone?.trim());
  const hasGoogleMaps = Boolean(input.lead.google_maps_url?.trim());
  const hasInstagram = Boolean(input.instagramUrl?.trim());
  const lowReviews = Number(input.lead.review_count ?? 0) < 20;
  const poorRating = Number(input.lead.rating ?? 0) > 0 && Number(input.lead.rating ?? 0) < 4.2;
  const poorPresence = !hasWebsite && !hasInstagram;

  if (!hasWebsite) {
    score += 30;
    problemsFound.push("Sem site");
  }

  if (!hasPhone) {
    score += 20;
    problemsFound.push("Sem telefone visível");
  }

  if (!hasInstagram) {
    score += 20;
    problemsFound.push("Sem Instagram identificado");
  }

  if (lowReviews) {
    score += 15;
    problemsFound.push("Poucas avaliações no Google");
  }

  if (poorRating) {
    score += 10;
    problemsFound.push("Nota abaixo de 4.2 no Google");
  }

  if (poorPresence) {
    score += 20;
    problemsFound.push("Presença digital fraca");
  }

  const opportunityScore = Math.max(0, Math.min(100, score));
  const opportunityLevel = opportunityScore >= 70 ? "alta" : opportunityScore >= 40 ? "media" : "baixa";

  const opportunityReason =
    problemsFound.length === 0
      ? "Empresa já aparenta ter presença digital bem estruturada."
      : `Oportunidade detectada por: ${problemsFound.join(", ")}.`;

  return {
    opportunity_score: opportunityScore,
    opportunity_level: opportunityLevel as "baixa" | "media" | "alta",
    problems_found: problemsFound,
    opportunity_reason: opportunityReason,
    has_website: hasWebsite,
    has_phone: hasPhone,
    has_google_maps: hasGoogleMaps,
    has_instagram: hasInstagram,
    has_low_reviews: lowReviews,
    has_poor_presence: poorPresence,
  };
}
