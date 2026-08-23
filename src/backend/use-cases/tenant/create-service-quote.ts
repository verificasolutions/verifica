import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { findCustomerById } from "@/backend/repos/customers-repo";
import { createServiceQuoteForTenant } from "@/backend/repos/service-quotes-repo";
import { listActiveServicesByTenant } from "@/backend/repos/services-repo";
import { listActiveVehiclesByCustomer } from "@/backend/repos/vehicles-repo";
import { parseCurrencyInput } from "@/backend/shared/input-normalizers";

function resolveQuoteErrorTarget(formData: FormData, message: string) {
  const requestedTarget = String(formData.get("redirect_to") ?? "").trim();
  const target = requestedTarget.startsWith("/app/dashboard?section=clientes")
    ? requestedTarget
    : "/app/dashboard?section=clientes&quoteForm=1";
  const separator = target.includes("?") ? "&" : "?";
  return `${target}${separator}error=${encodeURIComponent(message)}`;
}

function text(formData: FormData, field: string) {
  const value = String(formData.get(field) ?? "").trim();
  return value || null;
}

export async function createServiceQuoteUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const customerId = String(formData.get("customer_id") ?? "").trim();
  const vehicleId = String(formData.get("vehicle_id") ?? "").trim() || null;
  const serviceId = String(formData.get("service_id") ?? "").trim();
  const requestDescription = text(formData, "request_description");
  const laborDescription = text(formData, "labor_description");
  const partsDescription = text(formData, "parts_description");
  const notes = text(formData, "notes");
  const laborAmount = parseCurrencyInput(formData.get("labor_amount"));
  const partsAmount = parseCurrencyInput(formData.get("parts_amount"));

  if (!customerId || !serviceId || !requestDescription) {
    redirect(resolveQuoteErrorTarget(formData, "Preencha cliente, serviço operacional e solicitação do orçamento."));
  }

  if (!Number.isFinite(laborAmount) || laborAmount < 0 || !Number.isFinite(partsAmount) || partsAmount < 0) {
    redirect(resolveQuoteErrorTarget(formData, "Valores do orçamento inválidos."));
  }

  const [customer, services, vehicles] = await Promise.all([
    findCustomerById(context.tenantId, customerId),
    listActiveServicesByTenant(context.tenantId),
    listActiveVehiclesByCustomer(context.tenantId, customerId),
  ]);

  if (!customer) {
    redirect(resolveQuoteErrorTarget(formData, "Cliente não encontrado para este orçamento."));
  }

  const service = services.find((item) => item.id === serviceId);
  if (!service) {
    redirect(resolveQuoteErrorTarget(formData, "Serviço operacional inválido para o orçamento."));
  }

  if (vehicleId && !vehicles.some((item) => item.id === vehicleId)) {
    redirect(resolveQuoteErrorTarget(formData, "Veículo inválido para este cliente."));
  }

  const createdQuote = await createServiceQuoteForTenant({
    tenantId: context.tenantId,
    customerId,
    vehicleId,
    serviceId,
    requestDescription,
    laborDescription,
    laborAmount,
    partsDescription,
    partsAmount,
    notes,
    createdBy: context.userId,
  });

  if (createdQuote.error || !createdQuote.data) {
    redirect(resolveQuoteErrorTarget(formData, createdQuote.error?.message ?? "Falha ao salvar orçamento."));
  }

  return createdQuote.data;
}
