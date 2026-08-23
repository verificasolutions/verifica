import { createClient } from "@supabase/supabase-js";
import {
  getSupabasePublishableKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "@/lib/env";

let adminClient: ReturnType<typeof createClient> | null = null;

export function createSupabaseAdminClient(): ReturnType<typeof createClient> {
  if (!adminClient) {
    adminClient = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}

export function createSupabasePublicServerClient(): ReturnType<typeof createClient> {
  return createClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
