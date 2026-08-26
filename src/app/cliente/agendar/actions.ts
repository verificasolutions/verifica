"use server";

import { redirect } from "next/navigation";
import { requireCustomer } from "@/backend/auth/guards";
import { createAppointmentDraftUseCase, confirmAppointmentUseCase } from "@/backend/use-cases/customer/create-appointment";

function flowUrl(params: Record<string, string>) {
  const search = new URLSearchParams(params);
  return `/cliente/agendar?${search.toString()}`;
}

export async function createAppointmentDraftAction(formData: FormData) {
  const { token, customer } = await requireCustomer();
  const vehicleId = String(formData.get("vehicle") ?? "").trim();
  const serviceIds = formData.getAll("service_id").map((v) => String(v));
  const scheduledFor = String(formData.get("scheduled_for") ?? "").trim();

  if (!scheduledFor) {
    redirect(flowUrl({ vehicle: encodeURIComponent(vehicleId), selected: encodeURIComponent(serviceIds.join(",")), error: encodeURIComponent("Escolha data e horário.") }));
  }

  const result = await createAppointmentDraftUseCase({
    token,
    customer,
    vehicleId,
    serviceIds,
    scheduledFor,
  });

  if (result.error || !result.data) {
    redirect(flowUrl({ vehicle: encodeURIComponent(vehicleId), selected: encodeURIComponent(serviceIds.join(",")), error: encodeURIComponent(result.error ?? "Erro.") }));
  }

  redirect(
    flowUrl({ vehicle: encodeURIComponent(vehicleId), selected: encodeURIComponent(serviceIds.join(",")), draft: result.data.draftId, scheduled_for: encodeURIComponent(scheduledFor) }),
  );
}

export async function confirmAppointmentAction(formData: FormData) {
  const { token, customer } = await requireCustomer();
  const draftId = String(formData.get("draft") ?? "").trim();
  const vehicleId = String(formData.get("vehicle") ?? "").trim();
  const scheduledFor = String(formData.get("scheduled_for") ?? "").trim();

  const result = await confirmAppointmentUseCase({ token, customer, draftId, scheduledFor });

  if (result.error || !result.data) {
    redirect(
      flowUrl({ vehicle: encodeURIComponent(vehicleId), draft: encodeURIComponent(draftId), scheduled_for: encodeURIComponent(scheduledFor), error: encodeURIComponent(result.error ?? "Erro.") }),
    );
  }

  redirect(`/cliente/portal?ok=${encodeURIComponent("Agendamento confirmado.")}`);
}

export async function submitAppointmentAction(formData: FormData) {
  const { token, customer } = await requireCustomer();
  const vehicleId = String(formData.get("vehicle") ?? "").trim();
  const serviceIds = formData.getAll("service_id").map(String);
  const scheduledFor = String(formData.get("scheduled_for") ?? "").trim();
  if (!scheduledFor) redirect(flowUrl({ vehicle: vehicleId, selected: serviceIds.join(","), error: "Escolha data e horário." }));
  const draft = await createAppointmentDraftUseCase({ token, customer, vehicleId, serviceIds, scheduledFor });
  if (draft.error || !draft.data) redirect(flowUrl({ vehicle: vehicleId, selected: serviceIds.join(","), scheduled_for: scheduledFor, error: draft.error ?? "Selecione os serviços." }));
  const result = await confirmAppointmentUseCase({ token, customer, draftId: draft.data.draftId, scheduledFor });
  if (result.error || !result.data) redirect(flowUrl({ vehicle: vehicleId, selected: serviceIds.join(","), scheduled_for: scheduledFor, error: result.error ?? "Não foi possível confirmar." }));
  redirect(`/cliente/portal?ok=${encodeURIComponent("Agendamento confirmado.")}`);
}
