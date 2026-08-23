import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function getTenantWhatsappPairingByToken(token: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("tenant_settings")
    .select(`
      tenant_id,
      evolution_base_url,
      evolution_instance,
      evolution_api_key,
      evolution_enabled,
      customer_messages_enabled,
      whatsapp_pairing_token,
      tenants(name, slug, whatsapp, is_active)
    `)
    .eq("whatsapp_pairing_token", token)
    .maybeSingle();

  return data as
    | {
        tenant_id: string;
        evolution_base_url: string | null;
        evolution_instance: string | null;
        evolution_api_key: string | null;
        evolution_enabled: boolean;
        customer_messages_enabled: boolean;
        whatsapp_pairing_token: string;
        tenants?: {
          name: string;
          slug: string | null;
          whatsapp: string | null;
          is_active: boolean;
        } | null;
      }
    | null;
}
