import "server-only";
import { getOptionalSerpApiKey } from "@/lib/env";

export type LocalBusinessResult = {
  businessName: string;
  businessType: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  website: string | null;
  googleMapsUrl: string | null;
  rating: number | null;
  reviewCount: number;
  source: string;
  rawData: Record<string, unknown>;
};

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function splitCityState(address: string | null, fallbackCity?: string | null, fallbackState?: string | null) {
  if (!address) {
    return { city: fallbackCity ?? null, state: fallbackState ?? null };
  }

  const parts = address.split(",").map((item) => item.trim()).filter(Boolean);
  const last = parts.at(-1) ?? "";
  const match = last.match(/([A-Za-zÀ-ÿ\s]+)\s*-\s*([A-Z]{2})$/);

  if (match) {
    return {
      city: match[1]?.trim() || fallbackCity || null,
      state: match[2]?.trim() || fallbackState || null,
    };
  }

  return { city: fallbackCity ?? null, state: fallbackState ?? null };
}

export async function searchLocalBusinesses(input: {
  niche: string;
  city: string;
  state: string;
  radiusKm: number;
  maxResults: number;
}) {
  const serpApiKey = getOptionalSerpApiKey();

  if (!serpApiKey) {
    throw new Error("SERPAPI_API_KEY não configurada no ambiente.");
  }

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_maps");
  url.searchParams.set("q", `${input.niche} em ${input.city} ${input.state}`);
  url.searchParams.set("type", "search");
  url.searchParams.set("hl", "pt-BR");
  url.searchParams.set("gl", "br");
  url.searchParams.set("api_key", serpApiKey);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Falha na busca local (${response.status}).`);
  }

  const json = (await response.json()) as {
    error?: string;
    local_results?: Array<Record<string, unknown>>;
  };

  if (json.error) {
    throw new Error(json.error);
  }

  const results = (json.local_results ?? []).slice(0, Math.max(1, input.maxResults));

  return results.map((item) => {
    const title = normalizeText(item.title) ?? "Empresa sem nome";
    const address = normalizeText(item.address);
    const parsedCityState = splitCityState(address, input.city, input.state);
    const latitude = asNumber(item.gps_coordinates && typeof item.gps_coordinates === "object" ? (item.gps_coordinates as Record<string, unknown>).latitude : null);
    const longitude = asNumber(item.gps_coordinates && typeof item.gps_coordinates === "object" ? (item.gps_coordinates as Record<string, unknown>).longitude : null);
    const phone = normalizeText(item.phone);
    const website = normalizeText(item.website);
    const googleMapsUrl =
      normalizeText(item.place_id)
        ? `https://www.google.com/maps/place/?q=place_id:${String(item.place_id)}`
        : normalizeText(item.link) ?? normalizeText(item.directions);

    return {
      businessName: title,
      businessType: input.niche,
      phone,
      address,
      city: parsedCityState.city,
      state: parsedCityState.state,
      latitude,
      longitude,
      website,
      googleMapsUrl,
      rating: asNumber(item.rating),
      reviewCount: asNumber(item.reviews) ?? 0,
      source: "serpapi_google_maps",
      rawData: item,
    } satisfies LocalBusinessResult;
  });
}
