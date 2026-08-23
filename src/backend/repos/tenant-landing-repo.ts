import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TenantLandingPageRecord } from "@/backend/types";

const landingPageSelect = `
  tenant_id, category, city_label, bio, background_style, cover_image_url, profile_image_url,
  contact_email, instagram_url, facebook_url, website_url, address_label, map_embed_url,
  opening_hours, cta_whatsapp_message, is_published, created_at, updated_at
`;

export async function getTenantLandingPage(tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("tenant_landing_pages").select(landingPageSelect).eq("tenant_id", tenantId).maybeSingle();
  return (data as TenantLandingPageRecord | null) ?? null;
}

export async function upsertTenantLandingPage(input: {
  tenantId: string;
  category: string | null;
  cityLabel: string | null;
  bio: string | null;
  backgroundStyle: TenantLandingPageRecord["background_style"];
  coverImageUrl: string | null;
  profileImageUrl: string | null;
  contactEmail: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  websiteUrl: string | null;
  addressLabel: string | null;
  mapEmbedUrl: string | null;
  openingHours: string | null;
  ctaWhatsappMessage: string | null;
  isPublished: boolean;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("tenant_landing_pages").upsert({
    tenant_id: input.tenantId,
    category: input.category,
    city_label: input.cityLabel,
    bio: input.bio,
    background_style: input.backgroundStyle,
    cover_image_url: input.coverImageUrl,
    profile_image_url: input.profileImageUrl,
    contact_email: input.contactEmail,
    instagram_url: input.instagramUrl,
    facebook_url: input.facebookUrl,
    website_url: input.websiteUrl,
    address_label: input.addressLabel,
    map_embed_url: input.mapEmbedUrl,
    opening_hours: input.openingHours,
    cta_whatsapp_message: input.ctaWhatsappMessage,
    is_published: input.isPublished,
  });

  return error ? { message: error.message } : null;
}
