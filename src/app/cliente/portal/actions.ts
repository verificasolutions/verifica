"use server";

import { redirect } from "next/navigation";
import { requireCustomer } from "@/backend/auth/guards";
import { logoutCustomerUseCase } from "@/backend/use-cases/customer/logout";
import { linkVehicleUseCase } from "@/backend/use-cases/customer/link-vehicle";
import { unlinkVehicleUseCase } from "@/backend/use-cases/customer/unlink-vehicle";
import { lookupVehicleUseCase } from "@/backend/use-cases/customer/vehicle-lookup";
import { clearCustomerSessionCookie } from "@/backend/auth/customer-session";

function backUrl(params: Record<string, string>) {
  const search = new URLSearchParams(params);
  return `/cliente/portal?${search.toString()}`;
}

export async function logoutAction() {
  const { token } = await requireCustomer();
  await logoutCustomerUseCase({ token });
  await clearCustomerSessionCookie();
  redirect("/cliente/entrar");
}

export async function linkVehicleAction(formData: FormData) {
  const { token, customer } = await requireCustomer();
  const result = await linkVehicleUseCase({
    token,
    tenantId: customer.tenantId,
    customerId: customer.customerId,
    plate: String(formData.get("plate") ?? ""),
    brand: String(formData.get("brand") ?? "") || null,
    model: String(formData.get("model") ?? "") || null,
    color: String(formData.get("color") ?? "") || null,
    vehicleType: String(formData.get("vehicle_type") ?? "") || null,
    usageType: String(formData.get("usage_type") ?? "") || null,
    sizeTier: String(formData.get("size_tier") ?? "") || null,
    tierSource: "manual",
  });

  if (result.error) {
    redirect(backUrl({ add: "1", error: encodeURIComponent(result.error) }));
  }
  redirect(backUrl({ ok: encodeURIComponent("Veículo vinculado.") }));
}

export async function unlinkVehicleAction(formData: FormData) {
  const { token } = await requireCustomer();
  const vehicleId = String(formData.get("vehicle_id") ?? "").trim();

  if (!vehicleId) {
    redirect(backUrl({ error: encodeURIComponent("Veículo inválido.") }));
  }

  const result = await unlinkVehicleUseCase({ token, vehicleId });

  if (result.error) {
    redirect(backUrl({ error: encodeURIComponent(result.error) }));
  }
  redirect(backUrl({ ok: encodeURIComponent("Veículo desvinculado.") }));
}

export async function lookupVehicleAction(formData: FormData) {
  const { customer } = await requireCustomer();
  const plate = String(formData.get("plate") ?? "").trim();

  if (!plate) {
    redirect(backUrl({ add: "1", error: encodeURIComponent("Informe a placa.") }));
  }

  const result = await lookupVehicleUseCase({
    tenantId: customer.tenantId,
    customerId: customer.customerId,
    plate,
  });

  const vehicle = result.data;
  if (!vehicle || !vehicle.ok) {
    // provedor indisponível -> cadastro manual mínimo
    redirect(backUrl({ add: "1", lookup: "unavailable", plate: encodeURIComponent(plate), error: encodeURIComponent("Consulta indisponível. Preencha manualmente.") }));
  }

  redirect(
    backUrl({
      add: "1",
      lookup: "ok",
      plate: encodeURIComponent(vehicle.plate),
      brand: encodeURIComponent(vehicle.brand ?? ""),
      model: encodeURIComponent(vehicle.model ?? ""),
      color: encodeURIComponent(vehicle.color ?? ""),
      vehicle_type: encodeURIComponent(vehicle.vehicleType ?? ""),
      size_tier: encodeURIComponent(vehicle.sizeTierSuggestion ?? ""),
    }),
  );
}
