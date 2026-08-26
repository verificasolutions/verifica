import type { CustomerCatalogService, VehicleRecord } from "@/backend/types";

export type CustomerPricedService = CustomerCatalogService & { customerPrice: number };

function pick(values: Array<number | null | undefined>) {
  return values.find((value) => value !== null && value !== undefined && Number(value) !== 0) ?? 0;
}

function defaultTier(vehicleType: string | null | undefined) {
  if (vehicleType === "sedan" || vehicleType === "wagon") return "medio";
  if (["pickup_small", "suv", "pickup_large", "van", "micro_bus"].includes(vehicleType ?? "")) return "grande";
  if (["truck", "bus"].includes(vehicleType ?? "")) return "bem_grande";
  return "passeio";
}

export function priceCustomerServices(services: CustomerCatalogService[], vehicle: VehicleRecord | null | undefined) {
  const tier = vehicle?.size_tier ?? defaultTier(vehicle?.vehicle_type);
  return services.map((service) => {
    const isExtra = service.kind === "extra";
    const customerPrice = tier === "medio"
      ? pick(isExtra ? [service.addon_price_app_medio, service.addon_price_medio, service.price_app_medio, service.price_medio, service.price] : [service.price_app_medio, service.price_medio, service.price])
      : tier === "grande"
        ? pick(isExtra ? [service.addon_price_app_grande, service.addon_price_grande, service.price_app_grande, service.price_grande, service.price] : [service.price_app_grande, service.price_grande, service.price])
        : tier === "bem_grande"
          ? pick(isExtra ? [service.addon_price_app_bem_grande, service.addon_price_bem_grande, service.price_app_bem_grande, service.price_bem_grande, service.price] : [service.price_app_bem_grande, service.price_bem_grande, service.price])
          : pick(isExtra ? [service.addon_price_app_passeio, service.addon_price_passeio, service.price_app_passeio, service.price_passeio, service.price] : [service.price_app_passeio, service.price_passeio, service.price]);
    return { ...service, customerPrice: Number(customerPrice) };
  });
}
