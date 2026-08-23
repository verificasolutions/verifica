import type {
  LeadAnalysisRecord,
  LeadCompanyRecord,
  LeadEmailDispatchRecord,
  LeadEmailSequenceEnrollmentRecord,
  LeadEmailSequenceRecord,
  LeadEmailSequenceStepRecord,
} from "@/backend/types";
import { calculateLeadOpportunityScore } from "@/backend/shared/lead-opportunity-score";

function stringifyRawData(rawData: Record<string, unknown>) {
  try {
    return JSON.stringify(rawData).toLowerCase();
  } catch {
    return "";
  }
}

export function buildLeadAnalysisFromCompany(lead: {
  website?: string | null;
  phone?: string | null;
  googleMapsUrl?: string | null;
  rating?: number | null;
  reviewCount?: number;
  rawData?: Record<string, unknown>;
}) {
  const rawText = stringifyRawData(lead.rawData ?? {});
  const instagramUrlMatch = rawText.match(/https?:\/\/(?:www\.)?instagram\.com\/[a-z0-9._-]+/i);
  const score = calculateLeadOpportunityScore({
    lead: {
      website: lead.website ?? null,
      phone: lead.phone ?? null,
      google_maps_url: lead.googleMapsUrl ?? null,
      rating: lead.rating ?? null,
      review_count: lead.reviewCount ?? 0,
    },
    instagramUrl: instagramUrlMatch?.[0] ?? null,
  });

  return {
    hasWebsite: score.has_website,
    hasPhone: score.has_phone,
    hasGoogleMaps: score.has_google_maps,
    hasInstagram: score.has_instagram,
    instagramUrl: instagramUrlMatch?.[0] ?? null,
    hasLowReviews: score.has_low_reviews,
    hasPoorPresence: score.has_poor_presence,
    problemsFound: score.problems_found,
    opportunityReason: score.opportunity_reason,
    opportunityScore: score.opportunity_score,
    opportunityLevel: score.opportunity_level,
  };
}

export type LeadDashboardItem = {
  lead: LeadCompanyRecord;
  latestAnalysis: LeadAnalysisRecord | null;
  latestWhatsappMessage: { id: string; message_text: string; created_at: string } | null;
  latestEmailMessage: { id: string; message_text: string; subject: string | null; created_at: string } | null;
  latestEmailDispatch: LeadEmailDispatchRecord | null;
  latestEmailSequenceEnrollment: LeadEmailSequenceEnrollmentRecord | null;
  whatsappLink: string | null;
  activities: Array<{
    id: string;
    activity_type: string;
    channel: string | null;
    note: string | null;
    created_at: string;
    created_by_email: string | null;
  }>;
};

export type LeadEmailSequenceDashboard = {
  sequence: LeadEmailSequenceRecord;
  steps: LeadEmailSequenceStepRecord[];
};

export function buildLeadWhatsappLink(input: {
  phone: string | null;
  messageText: string | null;
}) {
  if (!input.phone || !input.messageText) return null;
  const digits = input.phone.replace(/\D+/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(input.messageText)}`;
}
