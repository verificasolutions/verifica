function getEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function getEnvOrFallback(name: string, fallback: string) {
  const value = process.env[name]?.trim();
  return value || fallback;
}

function getOptionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || null;
}

export function getSupabaseUrl() {
  return getEnv("NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabasePublishableKey() {
  return getEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
}

export function getSupabaseServiceRoleKey() {
  return getEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function getInstagramMetaAppId() {
  return getEnvOrFallback("INSTAGRAM_META_APP_ID", "2080339312885386");
}

export function getInstagramMetaAppSecret() {
  return getEnvOrFallback("INSTAGRAM_META_APP_SECRET", "33e29f8130673b54f9e10f995152aad2");
}

export function getInstagramTokenSecret() {
  return getEnvOrFallback("INSTAGRAM_TOKEN_SECRET", "9NURKA1Aok/WLh/LH0onLWXaJEVFY3PocJPBRg4W0Uw=");
}

export function getOptionalSerpApiKey() {
  return getOptionalEnv("SERPAPI_API_KEY");
}

export function getOptionalOpenAiApiKey() {
  return getOptionalEnv("OPENAI_API_KEY");
}

export function getOptionalResendApiKey() {
  return getOptionalEnv("RESEND_API_KEY");
}

export function getOptionalVehicleLookupProvider() {
  return getOptionalEnv("VEHICLE_LOOKUP_PROVIDER");
}

export function getCustomerSessionTtlHours() {
  const value = getOptionalEnv("CUSTOMER_SESSION_TTL_HOURS");
  const parsed = value ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 168;
}

export function getOptionalGoogleMapsApiKey() {
  return getOptionalEnv("GOOGLE_MAPS_API_KEY");
}
