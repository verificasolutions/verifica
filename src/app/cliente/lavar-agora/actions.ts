"use server";

import { redirect } from "next/navigation";
import { requireCustomer } from "@/backend/auth/guards";
import { createOrderDraftUseCase } from "@/backend/use-cases/customer/create-order-draft";
import { confirmOrderUseCase } from "@/backend/use-cases/customer/confirm-order";

function flowUrl(params: Record<string, string>) {
  const search = new URLSearchParams(params);
  return `/cliente/lavar-agora?${search.toString()}`;
}

export async function createOrderDraftAction(formData: FormData) {
  const { token, customer } = await requireCustomer();
  const vehicleId = String(formData.get("vehicle") ?? "").trim();
  const serviceIds = formData.getAll("service_id").map((v) => String(v));

  const result = await createOrderDraftUseCase({
    token,
    customer,
    vehicleId,
    serviceIds,
  });

  if (result.error || !result.data) {
    redirect(flowUrl({ vehicle: encodeURIComponent(vehicleId), selected: encodeURIComponent(serviceIds.join(",")), error: encodeURIComponent(result.error ?? "Erro.") }));
  }

  redirect(flowUrl({ vehicle: encodeURIComponent(vehicleId), selected: encodeURIComponent(serviceIds.join(",")), draft: result.data.draftId }));
}

export async function confirmOrderAction(formData: FormData) {
  const { token, customer } = await requireCustomer();
  const draftId = String(formData.get("draft") ?? "").trim();
  const vehicleId = String(formData.get("vehicle") ?? "").trim();

  const result = await confirmOrderUseCase({ token, customer, draftId });

  if (result.error || !result.data) {
    redirect(flowUrl({ vehicle: encodeURIComponent(vehicleId), error: encodeURIComponent(result.error ?? "Erro.") }));
  }

  redirect(`/cliente/portal?ok=${encodeURIComponent("Pedido criado. Acompanhe o status na operação.")}`);
}
