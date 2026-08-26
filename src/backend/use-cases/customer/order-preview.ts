import "server-only";
import type { CustomerSessionIdentity } from "@/backend/auth/customer-session";
import { hashSessionToken } from "@/backend/auth/customer-session";
import { getOpenOrderDraft } from "@/backend/repos/order-drafts-repo";
import { rpcCustomerListServices, rpcCustomerListVehicles } from "@/backend/repos/customer-rpc-repo";
import { getTenantSettingsAdmin } from "@/backend/repos/tenant-settings-repo";

/** Mesma semântica da RPC: 0 = não configurado (nullif-0). Preview informativo; a autoridade é a confirmação. */
function pick(values: Array<number | null | undefined>): number {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== 0) return Number(value);
  }
  return 0;
}

function defaultTierByType(vehicleType: string | null | undefined): string {
  switch (vehicleType) {
    case "sedan":
    case "wagon":
      return "medio";
    case "pickup_small":
    case "suv":
    case "pickup_large":
    case "van":
    case "micro_bus":
      return "grande";
    case "truck":
    case "bus":
      return "bem_grande";
    default:
      return "passeio";
  }
}

export async function getOrderPreviewUseCase(input: {
  token: string;
  customer: CustomerSessionIdentity;
  draftId: string;
}) {
  const sessionTokenHash = hashSessionToken(input.token);
  const draft = await getOpenOrderDraft({ draftId: input.draftId, sessionTokenHash });

  if (!draft || draft.kind !== "order") {
    return { error: "Tentativa inválida ou expirada." };
  }

  const [vehicles, services, settings] = await Promise.all([
    rpcCustomerListVehicles(input.token),
    rpcCustomerListServices(input.token),
    getTenantSettingsAdmin(input.customer.tenantId),
  ]);

  const vehicle = (vehicles.data ?? []).find((item) => item.id === draft.vehicle_id);
  if (!vehicle) {
    return { error: "Veículo inválido." };
  }

  const overrides = settings?.vehicle_type_tier_overrides ?? {};
  const tier =
    vehicle.size_tier ?? overrides[vehicle.vehicle_type as keyof typeof overrides] ?? defaultTierByType(vehicle.vehicle_type);

  const selected = (services.data ?? []).filter((item) => draft.service_ids.includes(item.id));
  let total = 0;
  let minutes = 0;

  const items = selected.map((service) => {
    const isExtra = service.kind === "extra";
    const price =
      tier === "medio"
        ? pick(
            isExtra
              ? [service.addon_price_app_medio, service.addon_price_medio, service.price_app_medio, service.price_medio, service.price]
              : [service.price_app_medio, service.price_medio, service.price],
          )
        : tier === "grande"
          ? pick(
              isExtra
                ? [service.addon_price_app_grande, service.addon_price_grande, service.price_app_grande, service.price_grande, service.price]
                : [service.price_app_grande, service.price_grande, service.price],
            )
          : tier === "bem_grande"
            ? pick(
                isExtra
                  ? [service.addon_price_app_bem_grande, service.addon_price_bem_grande, service.price_app_bem_grande, service.price_bem_grande, service.price]
                  : [service.price_app_bem_grande, service.price_bem_grande, service.price],
              )
            : pick(
                isExtra
                  ? [service.addon_price_app_passeio, service.addon_price_passeio, service.price_app_passeio, service.price_passeio, service.price]
                  : [service.price_app_passeio, service.price_passeio, service.price],
              );

    const mins = isExtra
      ? tier === "medio"
        ? service.addon_minutes_medio ?? service.addon_minutes ?? 0
        : tier === "grande"
          ? service.addon_minutes_grande ?? service.addon_minutes ?? 0
          : tier === "bem_grande"
            ? service.addon_minutes_bem_grande ?? service.addon_minutes ?? 0
            : service.addon_minutes_passeio ?? service.addon_minutes ?? 0
      : tier === "medio"
        ? service.minutes_medio ?? service.average_minutes ?? 0
        : tier === "grande"
          ? service.minutes_grande ?? service.average_minutes ?? 0
          : tier === "bem_grande"
            ? service.minutes_bem_grande ?? service.average_minutes ?? 0
            : service.minutes_passeio ?? service.average_minutes ?? 0;

    total += price;
    minutes += mins;
    return { name: service.name, price, minutes: mins };
  });

  return { data: { vehicle, items, total, minutes, draftId: draft.id } };
}
