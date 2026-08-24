import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ServiceRecord } from "@/backend/types";

type ServiceRow = Omit<ServiceRecord, "base_service"> & {
  base_service?: { name: string }[] | { name: string } | null;
};

export async function listActiveServicesByTenant(tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("services")
    .select("id, tenant_id, name, base_service_id, time_unit, price, price_passeio, price_medio, price_grande, price_bem_grande, price_app_passeio, price_app_medio, price_app_grande, price_app_bem_grande, minutes_passeio, minutes_medio, minutes_grande, minutes_bem_grande, addon_minutes, addon_minutes_passeio, addon_minutes_medio, addon_minutes_grande, addon_minutes_bem_grande, addon_price_passeio, addon_price_medio, addon_price_grande, addon_price_bem_grande, addon_price_app_passeio, addon_price_app_medio, addon_price_app_grande, addon_price_app_bem_grande, average_minutes, short_description, kind, is_active, base_service:base_service_id(name)")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  return ((data ?? []) as ServiceRow[]).map((item) => ({
    ...item,
    base_service: Array.isArray(item.base_service) ? (item.base_service[0] ?? null) : (item.base_service ?? null),
  })) as ServiceRecord[];
}

export async function createServiceForTenant(input: {
  tenantId: string;
  name: string;
  baseServiceId: string | null;
  pricePasseio: number;
  priceMedio: number;
  priceGrande: number;
  priceBemGrande: number;
  priceAppPasseio: number;
  priceAppMedio: number;
  priceAppGrande: number;
  priceAppBemGrande: number;
  minutesPasseio: number;
  minutesMedio: number;
  minutesGrande: number;
  minutesBemGrande: number;
  addonMinutes: number;
  addonMinutesPasseio: number;
  addonMinutesMedio: number;
  addonMinutesGrande: number;
  addonMinutesBemGrande: number;
  addonPricePasseio: number;
  addonPriceMedio: number;
  addonPriceGrande: number;
  addonPriceBemGrande: number;
  addonPriceAppPasseio: number;
  addonPriceAppMedio: number;
  addonPriceAppGrande: number;
  addonPriceAppBemGrande: number;
  averageMinutes: number;
  timeUnit: ServiceRecord["time_unit"];
  shortDescription: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("services").insert({
    tenant_id: input.tenantId,
    name: input.name,
    base_service_id: input.baseServiceId,
    time_unit: input.timeUnit,
    price: input.pricePasseio,
    price_passeio: input.pricePasseio,
    price_medio: input.priceMedio,
    price_grande: input.priceGrande,
    price_bem_grande: input.priceBemGrande,
    price_app_passeio: input.priceAppPasseio,
    price_app_medio: input.priceAppMedio,
    price_app_grande: input.priceAppGrande,
    price_app_bem_grande: input.priceAppBemGrande,
    minutes_passeio: input.minutesPasseio,
    minutes_medio: input.minutesMedio,
    minutes_grande: input.minutesGrande,
    minutes_bem_grande: input.minutesBemGrande,
    addon_minutes: input.addonMinutes,
    addon_minutes_passeio: input.addonMinutesPasseio,
    addon_minutes_medio: input.addonMinutesMedio,
    addon_minutes_grande: input.addonMinutesGrande,
    addon_minutes_bem_grande: input.addonMinutesBemGrande,
    addon_price_passeio: input.addonPricePasseio,
    addon_price_medio: input.addonPriceMedio,
    addon_price_grande: input.addonPriceGrande,
    addon_price_bem_grande: input.addonPriceBemGrande,
    addon_price_app_passeio: input.addonPriceAppPasseio,
    addon_price_app_medio: input.addonPriceAppMedio,
    addon_price_app_grande: input.addonPriceAppGrande,
    addon_price_app_bem_grande: input.addonPriceAppBemGrande,
    average_minutes: input.averageMinutes,
    short_description: input.shortDescription,
    kind: "main",
    is_active: true,
  });

  return error as { message: string } | null;
}

export async function updateServiceForTenant(input: {
  tenantId: string;
  serviceId: string;
  name: string;
  baseServiceId: string | null;
  pricePasseio: number;
  priceMedio: number;
  priceGrande: number;
  priceBemGrande: number;
  priceAppPasseio: number;
  priceAppMedio: number;
  priceAppGrande: number;
  priceAppBemGrande: number;
  minutesPasseio: number;
  minutesMedio: number;
  minutesGrande: number;
  minutesBemGrande: number;
  addonMinutes: number;
  addonMinutesPasseio: number;
  addonMinutesMedio: number;
  addonMinutesGrande: number;
  addonMinutesBemGrande: number;
  addonPricePasseio: number;
  addonPriceMedio: number;
  addonPriceGrande: number;
  addonPriceBemGrande: number;
  addonPriceAppPasseio: number;
  addonPriceAppMedio: number;
  addonPriceAppGrande: number;
  addonPriceAppBemGrande: number;
  averageMinutes: number;
  timeUnit: ServiceRecord["time_unit"];
  shortDescription: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("services")
    .update({
      name: input.name,
      base_service_id: input.baseServiceId,
      time_unit: input.timeUnit,
      price: input.pricePasseio,
      price_passeio: input.pricePasseio,
      price_medio: input.priceMedio,
      price_grande: input.priceGrande,
      price_bem_grande: input.priceBemGrande,
      price_app_passeio: input.priceAppPasseio,
      price_app_medio: input.priceAppMedio,
      price_app_grande: input.priceAppGrande,
      price_app_bem_grande: input.priceAppBemGrande,
      minutes_passeio: input.minutesPasseio,
      minutes_medio: input.minutesMedio,
      minutes_grande: input.minutesGrande,
      minutes_bem_grande: input.minutesBemGrande,
      addon_minutes: input.addonMinutes,
      addon_minutes_passeio: input.addonMinutesPasseio,
      addon_minutes_medio: input.addonMinutesMedio,
      addon_minutes_grande: input.addonMinutesGrande,
      addon_minutes_bem_grande: input.addonMinutesBemGrande,
      addon_price_passeio: input.addonPricePasseio,
      addon_price_medio: input.addonPriceMedio,
      addon_price_grande: input.addonPriceGrande,
      addon_price_bem_grande: input.addonPriceBemGrande,
      addon_price_app_passeio: input.addonPriceAppPasseio,
      addon_price_app_medio: input.addonPriceAppMedio,
      addon_price_app_grande: input.addonPriceAppGrande,
      addon_price_app_bem_grande: input.addonPriceAppBemGrande,
      average_minutes: input.averageMinutes,
      short_description: input.shortDescription,
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.serviceId);

  return error as { message: string } | null;
}
