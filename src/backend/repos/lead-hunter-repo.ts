/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { LeadAnalysisRecord, LeadCompanyActivityRecord, LeadCompanyRecord, LeadEmailDispatchRecord, LeadHunterJobRecord, LeadMessageRecord } from "@/backend/types";

function mapLeadCompany(row: any): LeadCompanyRecord {
  const rawData = (row.raw_data ?? {}) as Record<string, any>;
  return {
    id: row.id,
    cnpj: row.cnpj ?? rawData.cnpj ?? null,
    business_name: row.business_name,
    business_type: row.business_type,
    email: row.email ?? rawData.email ?? null,
    cnae_principal: row.cnae_principal ?? rawData.cnae_principal ?? null,
    cnae_secundaria: row.cnae_secundaria ?? rawData.cnae_secundaria ?? null,
    abertura_date: row.abertura_date ?? rawData.abertura_date ?? rawData.data_inicio_atividade ?? null,
    contato_quality: row.contato_quality ?? rawData.qualidade_contato ?? null,
    contact_risk_level: row.contact_risk_level ?? rawData.contact_risk_level ?? null,
    contact_role_hint: row.contact_role_hint ?? rawData.contact_role_hint ?? null,
    contact_evidence: row.contact_evidence ?? rawData.contact_evidence ?? null,
    recommended_channel: row.recommended_channel ?? rawData.recommended_channel ?? null,
    import_batch_label: row.import_batch_label ?? rawData.import_batch_label ?? null,
    phone: row.phone ?? null,
    address: row.address ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    latitude: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude),
    longitude: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
    website: row.website ?? null,
    google_maps_url: row.google_maps_url ?? null,
    rating: row.rating === null || row.rating === undefined ? null : Number(row.rating),
    review_count: Number(row.review_count ?? 0),
    source: row.source,
    raw_data: rawData,
    opportunity_score: Number(row.opportunity_score ?? 0),
    opportunity_level: row.opportunity_level,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapLeadAnalysis(row: any): LeadAnalysisRecord {
  return {
    id: row.id,
    lead_company_id: row.lead_company_id,
    has_website: Boolean(row.has_website),
    has_phone: Boolean(row.has_phone),
    has_google_maps: Boolean(row.has_google_maps),
    has_instagram: Boolean(row.has_instagram),
    instagram_url: row.instagram_url ?? null,
    has_low_reviews: Boolean(row.has_low_reviews),
    has_poor_presence: Boolean(row.has_poor_presence),
    problems_found: Array.isArray(row.problems_found) ? row.problems_found : [],
    opportunity_reason: row.opportunity_reason ?? null,
    ai_summary: row.ai_summary ?? null,
    created_at: row.created_at,
  };
}

function mapLeadMessage(row: any): LeadMessageRecord {
  return {
    id: row.id,
    lead_company_id: row.lead_company_id,
    subject: row.subject ?? null,
    message_text: row.message_text,
    message_type: row.message_type,
    created_at: row.created_at,
  };
}

function mapLeadCompanyActivity(row: any): LeadCompanyActivityRecord {
  return {
    id: row.id,
    lead_company_id: row.lead_company_id,
    activity_type: row.activity_type,
    channel: row.channel ?? null,
    note: row.note ?? null,
    created_by_email: row.created_by_email ?? null,
    created_at: row.created_at,
  };
}

function mapLeadEmailDispatch(row: any): LeadEmailDispatchRecord {
  return {
    id: row.id,
    lead_company_id: row.lead_company_id,
    lead_message_id: row.lead_message_id ?? null,
    provider: row.provider ?? "resend",
    provider_email_id: row.provider_email_id,
    recipient_email: row.recipient_email,
    subject: row.subject,
    status: row.status,
    last_event: row.last_event,
    last_error: row.last_error ?? null,
    raw_events: Array.isArray(row.raw_events) ? row.raw_events : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapLeadHunterJob(row: any): LeadHunterJobRecord {
  return {
    id: row.id,
    niche: row.niche,
    city: row.city,
    state: row.state,
    radius_km: Number(row.radius_km ?? 0),
    max_results: Number(row.max_results ?? 0),
    total_found: Number(row.total_found ?? 0),
    total_saved: Number(row.total_saved ?? 0),
    total_duplicates: Number(row.total_duplicates ?? 0),
    status: row.status,
    error_message: row.error_message ?? null,
    created_at: row.created_at,
    finished_at: row.finished_at ?? null,
  };
}

export async function createLeadHunterJobAdmin(input: {
  niche: string;
  city: string;
  state: string;
  radiusKm: number;
  maxResults: number;
}) {
  const admin = createSupabaseAdminClient() as any;
  const { data, error } = await admin
    .from("lead_hunter_jobs")
    .insert({
      niche: input.niche,
      city: input.city,
      state: input.state,
      radius_km: input.radiusKm,
      max_results: input.maxResults,
      status: "running",
    })
    .select("*")
    .single();

  return { data: data ? mapLeadHunterJob(data) : null, error: error as { message: string } | null };
}

export async function updateLeadHunterJobAdmin(input: {
  jobId: string;
  totalFound?: number;
  totalSaved?: number;
  totalDuplicates?: number;
  status?: LeadHunterJobRecord["status"];
  errorMessage?: string | null;
  finishedAt?: string | null;
}) {
  const admin = createSupabaseAdminClient() as any;
  const patch: Record<string, unknown> = {};
  if (input.totalFound !== undefined) patch.total_found = input.totalFound;
  if (input.totalSaved !== undefined) patch.total_saved = input.totalSaved;
  if (input.totalDuplicates !== undefined) patch.total_duplicates = input.totalDuplicates;
  if (input.status !== undefined) patch.status = input.status;
  if (input.errorMessage !== undefined) patch.error_message = input.errorMessage;
  if (input.finishedAt !== undefined) patch.finished_at = input.finishedAt;

  const { error } = await admin.from("lead_hunter_jobs").update(patch).eq("id", input.jobId);
  return error as { message: string } | null;
}

export async function listLeadHunterJobsAdmin(limit = 20) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin.from("lead_hunter_jobs").select("*").order("created_at", { ascending: false }).limit(limit);
  return ((data ?? []) as any[]).map(mapLeadHunterJob);
}

export async function findLeadCompanyDuplicateAdmin(input: {
  businessName: string;
  cnpj?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
}) {
  const admin = createSupabaseAdminClient() as any;

  if (input.cnpj) {
    const { data } = await admin.from("lead_companies").select("*").eq("cnpj", input.cnpj).limit(1).maybeSingle();
    if (data) return mapLeadCompany(data);
  }

  if (input.phone) {
    const { data } = await admin.from("lead_companies").select("*").eq("phone", input.phone).limit(1).maybeSingle();
    if (data) return mapLeadCompany(data);
  }

  if (input.address && input.city) {
    const { data } = await admin
      .from("lead_companies")
      .select("*")
      .ilike("address", input.address)
      .ilike("city", input.city)
      .limit(1)
      .maybeSingle();
    if (data) return mapLeadCompany(data);
  }

  const { data } = await admin
    .from("lead_companies")
    .select("*")
    .ilike("business_name", input.businessName)
    .limit(1)
    .maybeSingle();

  return data ? mapLeadCompany(data) : null;
}

export async function upsertLeadCompanyAdmin(input: {
  existingId?: string | null;
  cnpj?: string | null;
  businessName: string;
  businessType: string;
  email?: string | null;
  cnaePrincipal?: string | null;
  cnaeSecundaria?: string | null;
  aberturaDate?: string | null;
  contatoQuality?: string | null;
  contactRiskLevel?: string | null;
  contactRoleHint?: string | null;
  contactEvidence?: string | null;
  recommendedChannel?: string | null;
  importBatchLabel?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  website?: string | null;
  googleMapsUrl?: string | null;
  rating?: number | null;
  reviewCount?: number;
  source: string;
  rawData: Record<string, unknown>;
  opportunityScore: number;
  opportunityLevel: LeadCompanyRecord["opportunity_level"];
  status: LeadCompanyRecord["status"];
}) {
  const admin = createSupabaseAdminClient() as any;
  const payload = {
    ...(input.existingId ? { id: input.existingId } : {}),
    cnpj: input.cnpj ?? null,
    business_name: input.businessName,
    business_type: input.businessType,
    email: input.email ?? null,
    cnae_principal: input.cnaePrincipal ?? null,
    cnae_secundaria: input.cnaeSecundaria ?? null,
    abertura_date: input.aberturaDate ?? null,
    contato_quality: input.contatoQuality ?? null,
    contact_risk_level: input.contactRiskLevel ?? null,
    contact_role_hint: input.contactRoleHint ?? null,
    contact_evidence: input.contactEvidence ?? null,
    recommended_channel: input.recommendedChannel ?? null,
    import_batch_label: input.importBatchLabel ?? null,
    phone: input.phone ?? null,
    address: input.address ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    website: input.website ?? null,
    google_maps_url: input.googleMapsUrl ?? null,
    rating: input.rating ?? null,
    review_count: input.reviewCount ?? 0,
    source: input.source,
    raw_data: {
      ...input.rawData,
      cnpj: input.cnpj ?? null,
      email: input.email ?? null,
      cnae_principal: input.cnaePrincipal ?? null,
      cnae_secundaria: input.cnaeSecundaria ?? null,
      abertura_date: input.aberturaDate ?? null,
      qualidade_contato: input.contatoQuality ?? null,
      contact_risk_level: input.contactRiskLevel ?? null,
      contact_role_hint: input.contactRoleHint ?? null,
      contact_evidence: input.contactEvidence ?? null,
      recommended_channel: input.recommendedChannel ?? null,
      import_batch_label: input.importBatchLabel ?? null,
    },
    opportunity_score: input.opportunityScore,
    opportunity_level: input.opportunityLevel,
    status: input.status,
  };

  const { data, error } = await admin.from("lead_companies").upsert(payload).select("*").single();
  return { data: data ? mapLeadCompany(data) : null, error: error as { message: string } | null };
}

export async function saveLeadAnalysisAdmin(input: {
  leadCompanyId: string;
  hasWebsite: boolean;
  hasPhone: boolean;
  hasGoogleMaps: boolean;
  hasInstagram: boolean;
  instagramUrl?: string | null;
  hasLowReviews: boolean;
  hasPoorPresence: boolean;
  problemsFound: string[];
  opportunityReason?: string | null;
  aiSummary?: string | null;
}) {
  const admin = createSupabaseAdminClient() as any;
  const { data, error } = await admin
    .from("lead_analysis")
    .insert({
      lead_company_id: input.leadCompanyId,
      has_website: input.hasWebsite,
      has_phone: input.hasPhone,
      has_google_maps: input.hasGoogleMaps,
      has_instagram: input.hasInstagram,
      instagram_url: input.instagramUrl ?? null,
      has_low_reviews: input.hasLowReviews,
      has_poor_presence: input.hasPoorPresence,
      problems_found: input.problemsFound,
      opportunity_reason: input.opportunityReason ?? null,
      ai_summary: input.aiSummary ?? null,
    })
    .select("*")
    .single();

  return { data: data ? mapLeadAnalysis(data) : null, error: error as { message: string } | null };
}

export async function getLatestLeadAnalysisAdmin(leadCompanyId: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("lead_analysis")
    .select("*")
    .eq("lead_company_id", leadCompanyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? mapLeadAnalysis(data) : null;
}

export async function saveLeadMessageAdmin(input: {
  leadCompanyId: string;
  subject?: string | null;
  messageText: string;
  messageType?: string;
}) {
  const admin = createSupabaseAdminClient() as any;
  const { data, error } = await admin
    .from("lead_messages")
    .insert({
      lead_company_id: input.leadCompanyId,
      subject: input.subject ?? null,
      message_text: input.messageText,
      message_type: input.messageType ?? "whatsapp",
    })
    .select("*")
    .single();

  return { data: data ? mapLeadMessage(data) : null, error: error as { message: string } | null };
}

export async function saveLeadCompanyActivityAdmin(input: {
  leadCompanyId: string;
  activityType: string;
  channel?: string | null;
  note?: string | null;
  createdByEmail?: string | null;
}) {
  const admin = createSupabaseAdminClient() as any;
  const { data, error } = await admin
    .from("lead_company_activities")
    .insert({
      lead_company_id: input.leadCompanyId,
      activity_type: input.activityType,
      channel: input.channel ?? null,
      note: input.note ?? null,
      created_by_email: input.createdByEmail ?? null,
    })
    .select("*")
    .single();

  return { data: data ? mapLeadCompanyActivity(data) : null, error: error as { message: string } | null };
}

export async function listLeadCompanyActivitiesAdmin(leadCompanyId: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("lead_company_activities")
    .select("*")
    .eq("lead_company_id", leadCompanyId)
    .order("created_at", { ascending: false })
    .limit(50);

  return ((data ?? []) as any[]).map(mapLeadCompanyActivity);
}

export async function createLeadEmailDispatchAdmin(input: {
  leadCompanyId: string;
  leadMessageId?: string | null;
  providerEmailId: string;
  recipientEmail: string;
  subject: string;
  status?: LeadEmailDispatchRecord["status"];
  lastEvent?: string;
  lastError?: string | null;
  rawEvents?: Array<Record<string, unknown>>;
}) {
  const admin = createSupabaseAdminClient() as any;
  const { data, error } = await admin
    .from("lead_email_dispatches")
    .upsert(
      {
        lead_company_id: input.leadCompanyId,
        lead_message_id: input.leadMessageId ?? null,
        provider: "resend",
        provider_email_id: input.providerEmailId,
        recipient_email: input.recipientEmail,
        subject: input.subject,
        status: input.status ?? "sent",
        last_event: input.lastEvent ?? "api_accepted",
        last_error: input.lastError ?? null,
        raw_events: input.rawEvents ?? [],
      },
      { onConflict: "provider_email_id" },
    )
    .select("*")
    .single();

  return { data: data ? mapLeadEmailDispatch(data) : null, error: error as { message: string } | null };
}

export async function getLatestLeadEmailDispatchAdmin(leadCompanyId: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("lead_email_dispatches")
    .select("*")
    .eq("lead_company_id", leadCompanyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? mapLeadEmailDispatch(data) : null;
}

export async function findLeadEmailDispatchByProviderIdAdmin(providerEmailId: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("lead_email_dispatches")
    .select("*")
    .eq("provider_email_id", providerEmailId)
    .maybeSingle();

  return data ? mapLeadEmailDispatch(data) : null;
}

export async function updateLeadEmailDispatchByProviderIdAdmin(input: {
  providerEmailId: string;
  status: LeadEmailDispatchRecord["status"];
  lastEvent: string;
  lastError?: string | null;
  rawEvent?: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient() as any;
  const current = await admin
    .from("lead_email_dispatches")
    .select("raw_events")
    .eq("provider_email_id", input.providerEmailId)
    .maybeSingle();

  const previousEvents = Array.isArray(current.data?.raw_events) ? current.data.raw_events : [];
  const nextEvents = input.rawEvent ? [...previousEvents, input.rawEvent] : previousEvents;

  const { data, error } = await admin
    .from("lead_email_dispatches")
    .update({
      status: input.status,
      last_event: input.lastEvent,
      last_error: input.lastError ?? null,
      raw_events: nextEvents,
    })
    .eq("provider_email_id", input.providerEmailId)
    .select("*")
    .single();

  return { data: data ? mapLeadEmailDispatch(data) : null, error: error as { message: string } | null };
}

export async function getLatestLeadMessageAdmin(leadCompanyId: string, messageType?: string | null) {
  const admin = createSupabaseAdminClient() as any;
  let query = admin
    .from("lead_messages")
    .select("*")
    .eq("lead_company_id", leadCompanyId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (messageType) {
    query = query.eq("message_type", messageType);
  }

  const { data } = await query
    .maybeSingle();

  return data ? mapLeadMessage(data) : null;
}

export async function updateLeadCompanyStatusAdmin(leadCompanyId: string, status: LeadCompanyRecord["status"]) {
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin.from("lead_companies").update({ status }).eq("id", leadCompanyId);
  return error as { message: string } | null;
}

export async function getLeadCompanyByIdAdmin(leadCompanyId: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("lead_companies")
    .select("*")
    .eq("id", leadCompanyId)
    .maybeSingle();

  return data ? mapLeadCompany(data) : null;
}

export async function countLeadCompaniesAdmin(filters?: {
  status?: LeadCompanyRecord["status"] | null;
  source?: string | null;
}) {
  const admin = createSupabaseAdminClient() as any;
  let query = admin.from("lead_companies").select("*", { count: "exact", head: true });
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.source) query = query.eq("source", filters.source);
  const { count } = await query;
  return Number(count ?? 0);
}

export async function listLeadCompaniesAdmin(filters?: {
  niche?: string | null;
  city?: string | null;
  state?: string | null;
  withWebsite?: boolean | null;
  withPhone?: boolean | null;
  opportunityLevel?: LeadCompanyRecord["opportunity_level"] | null;
  status?: LeadCompanyRecord["status"] | null;
  contactRiskLevel?: string | null;
  contactRoleHint?: string | null;
  recommendedChannel?: string | null;
}) {
  const admin = createSupabaseAdminClient() as any;
  let query = admin.from("lead_companies").select("*").order("opportunity_score", { ascending: false }).order("created_at", { ascending: false }).limit(200);

  if (filters?.niche) query = query.ilike("business_type", `%${filters.niche}%`);
  if (filters?.city) query = query.ilike("city", `%${filters.city}%`);
  if (filters?.state) query = query.ilike("state", `%${filters.state}%`);
  if (filters?.withWebsite === true) query = query.not("website", "is", null);
  if (filters?.withWebsite === false) query = query.is("website", null);
  if (filters?.withPhone === true) query = query.not("phone", "is", null);
  if (filters?.withPhone === false) query = query.is("phone", null);
  if (filters?.opportunityLevel) query = query.eq("opportunity_level", filters.opportunityLevel);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.contactRiskLevel) query = query.eq("contact_risk_level", filters.contactRiskLevel);
  if (filters?.contactRoleHint) query = query.eq("contact_role_hint", filters.contactRoleHint);
  if (filters?.recommendedChannel) query = query.eq("recommended_channel", filters.recommendedChannel);

  const { data } = await query;
  return ((data ?? []) as any[]).map(mapLeadCompany);
}
