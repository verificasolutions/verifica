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
  bio: string | null;
  backgroundStyle: TenantLandingPageRecord["background_style"];
  coverImageUrl: string | null;
  profileImageUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  openingHours: string | null;
  ctaWhatsappMessage: string | null;
  isPublished: boolean;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("tenant_landing_pages").upsert({
    tenant_id: input.tenantId,
    category: input.category,
    // Fonte única: nome/telefone/e-mail/endereço/CEP/cidade/estado/site vêm do cadastro;
    // a landing NÃO persiste overrides (campos legados zerados).
    city_label: null,
    contact_email: null,
    website_url: null,
    address_label: null,
    map_embed_url: null,
    bio: input.bio,
    background_style: input.backgroundStyle,
    cover_image_url: input.coverImageUrl,
    profile_image_url: input.profileImageUrl,
    instagram_url: input.instagramUrl,
    facebook_url: input.facebookUrl,
    opening_hours: input.openingHours,
    cta_whatsapp_message: input.ctaWhatsappMessage,
    is_published: input.isPublished,
  });

  return error ? { message: error.message } : null;
}
