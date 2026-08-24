import "server-only";
import { redirect } from "next/navigation";
import type { ServiceRecord, TenantOperationalProfile } from "@/backend/types";
import { parseCurrencyInput, parseDurationInput } from "@/backend/shared/input-normalizers";
import { normalizeOperationBoxTimeUnit, parseOperationBoxDurationToMinutes } from "@/backend/shared/operation-box-duration";

export function buildServicePayloadFromForm(formData: FormData, services: ServiceRecord[], operationalProfile: TenantOperationalProfile) {
  const name = String(formData.get("name") ?? "").trim();
  const shortDescription = String(formData.get("short_description") ?? "").trim();
  const rawBaseServiceId = String(formData.get("base_service_id") ?? "").trim() || null;
  const currentServiceId = String(formData.get("service_id") ?? "").trim() || null;
  const baseServiceId = rawBaseServiceId === currentServiceId ? null : rawBaseServiceId;
  const isGenericProfile = operationalProfile === "generic";
  const timeUnit = isGenericProfile ? normalizeOperationBoxTimeUnit(formData.get("time_unit")) : "minutes";
  const genericMinutesInput = parseOperationBoxDurationToMinutes(formData.get("minutes_default"), timeUnit);

  const addonMinutesPasseio = isGenericProfile
    ? genericMinutesInput ?? 0
    : parseDurationInput(formData.get("minutes_passeio"));
  const addonMinutesMedio = isGenericProfile ? addonMinutesPasseio : parseDurationInput(formData.get("minutes_medio"));
  const addonMinutesGrande = isGenericProfile ? addonMinutesPasseio : parseDurationInput(formData.get("minutes_grande"));
  const addonMinutesBemGrande = isGenericProfile ? addonMinutesPasseio : parseDurationInput(formData.get("minutes_bem_grande"));

  const addonPricePasseio = parseCurrencyInput(formData.get(isGenericProfile ? "price_default" : "price_passeio"));
  const addonPriceMedio = isGenericProfile ? addonPricePasseio : parseCurrencyInput(formData.get("price_medio"));
  const addonPriceGrande = isGenericProfile ? addonPricePasseio : parseCurrencyInput(formData.get("price_grande"));
  const addonPriceBemGrande = isGenericProfile ? addonPricePasseio : parseCurrencyInput(formData.get("price_bem_grande"));
  const addonPriceAppPasseio = parseCurrencyInput(formData.get(isGenericProfile ? "price_app_default" : "price_app_passeio"));
  const addonPriceAppMedio = isGenericProfile ? addonPriceAppPasseio : parseCurrencyInput(formData.get("price_app_medio"));
  const addonPriceAppGrande = isGenericProfile ? addonPriceAppPasseio : parseCurrencyInput(formData.get("price_app_grande"));
  const addonPriceAppBemGrande = isGenericProfile ? addonPriceAppPasseio : parseCurrencyInput(formData.get("price_app_bem_grande"));

  if (
    !name ||
    !Number.isFinite(addonMinutesPasseio) ||
    !Number.isFinite(addonMinutesMedio) ||
    !Number.isFinite(addonMinutesGrande) ||
    !Number.isFinite(addonMinutesBemGrande) ||
    !Number.isFinite(addonPricePasseio) ||
    !Number.isFinite(addonPriceMedio) ||
    !Number.isFinite(addonPriceGrande) ||
    !Number.isFinite(addonPriceBemGrande)
    || !Number.isFinite(addonPriceAppPasseio)
    || !Number.isFinite(addonPriceAppMedio)
    || !Number.isFinite(addonPriceAppGrande)
    || !Number.isFinite(addonPriceAppBemGrande)
  ) {
    redirect("/app/dashboard?error=Dados inválidos para serviço.");
  }

  const baseService = baseServiceId ? services.find((item) => item.id === baseServiceId) : null;

  if (baseServiceId && !baseService) {
    redirect("/app/dashboard?error=Serviço base inválido.");
  }

  const minutesPasseio = Number(baseService?.minutes_passeio ?? baseService?.average_minutes ?? 0) + addonMinutesPasseio;
  const minutesMedio = Number(baseService?.minutes_medio ?? baseService?.average_minutes ?? 0) + addonMinutesMedio;
  const minutesGrande = Number(baseService?.minutes_grande ?? baseService?.average_minutes ?? 0) + addonMinutesGrande;
  const minutesBemGrande = Number(baseService?.minutes_bem_grande ?? baseService?.average_minutes ?? 0) + addonMinutesBemGrande;

  const pricePasseio = Number(baseService?.price_passeio ?? baseService?.price ?? 0) + addonPricePasseio;
  const priceMedio = Number(baseService?.price_medio ?? baseService?.price ?? 0) + addonPriceMedio;
  const priceGrande = Number(baseService?.price_grande ?? baseService?.price ?? 0) + addonPriceGrande;
  const priceBemGrande = Number(baseService?.price_bem_grande ?? baseService?.price ?? 0) + addonPriceBemGrande;
  const priceAppPasseio = Number(baseService?.price_app_passeio ?? baseService?.price_passeio ?? baseService?.price ?? 0) + addonPriceAppPasseio;
  const priceAppMedio = Number(baseService?.price_app_medio ?? baseService?.price_medio ?? baseService?.price ?? 0) + addonPriceAppMedio;
  const priceAppGrande = Number(baseService?.price_app_grande ?? baseService?.price_grande ?? baseService?.price ?? 0) + addonPriceAppGrande;
  const priceAppBemGrande = Number(baseService?.price_app_bem_grande ?? baseService?.price_bem_grande ?? baseService?.price ?? 0) + addonPriceAppBemGrande;

  return {
    name,
    shortDescription: shortDescription || null,
    baseServiceId,
    pricePasseio,
    priceMedio,
    priceGrande,
    priceBemGrande,
    priceAppPasseio,
    priceAppMedio,
    priceAppGrande,
    priceAppBemGrande,
    minutesPasseio,
    minutesMedio,
    minutesGrande,
    minutesBemGrande,
    addonMinutes: addonMinutesPasseio,
    addonMinutesPasseio,
    addonMinutesMedio,
    addonMinutesGrande,
    addonMinutesBemGrande,
    addonPricePasseio,
    addonPriceMedio,
    addonPriceGrande,
    addonPriceBemGrande,
    addonPriceAppPasseio,
    addonPriceAppMedio,
    addonPriceAppGrande,
    addonPriceAppBemGrande,
    averageMinutes: minutesPasseio,
    timeUnit,
  };
}
