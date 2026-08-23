import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { createAttendanceServiceItemsForTenant } from "@/backend/repos/attendance-service-items-repo";
import {
  createAttendanceForTenant,
  createAttendancePublicStatus,
  findActiveAttendanceByVehicle,
  listQueueForTodayByTenant,
} from "@/backend/repos/attendances-operations-repo";
import { findCustomerById } from "@/backend/repos/customers-repo";
import { listOperationBoxesByTenant, moveAttendanceToBoxForTenant } from "@/backend/repos/operation-boxes-repo";
import { findServiceQuoteById, updateServiceQuoteForTenant } from "@/backend/repos/service-quotes-repo";
import { listActiveServicesByTenant } from "@/backend/repos/services-repo";
import { createVehicleForTenant, listActiveVehiclesByCustomer } from "@/backend/repos/vehicles-repo";
import { formatVehicleDisplayLabel, resolveServiceMinutesByVehicleType, resolveServicePriceByVehicleType } from "@/backend/shared/vehicle-catalog";

function resolveQuoteApprovalErrorTarget(formData: FormData, message: string) {
  const requestedTarget = String(formData.get("redirect_to") ?? "").trim();
  const target = requestedTarget.startsWith("/app/dashboard?section=clientes")
    ? requestedTarget
    : "/app/dashboard?section=clientes";
  const separator = target.includes("?") ? "&" : "?";
  return `${target}${separator}error=${encodeURIComponent(message)}`;
}

function generateGenericAttendanceCode() {
  return `OS${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

export async function approveServiceQuoteUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const quoteId = String(formData.get("quote_id") ?? "").trim();

  if (!quoteId) {
    redirect(resolveQuoteApprovalErrorTarget(formData, "Orcamento invalido."));
  }

  const quote = await findServiceQuoteById(context.tenantId, quoteId);
  if (!quote || quote.status !== "draft") {
    redirect(resolveQuoteApprovalErrorTarget(formData, "Orcamento nao encontrado ou ja processado."));
  }

  const [customer, services, vehicles, operationBoxes, currentQueue] = await Promise.all([
    findCustomerById(context.tenantId, quote.customer_id),
    listActiveServicesByTenant(context.tenantId),
    listActiveVehiclesByCustomer(context.tenantId, quote.customer_id),
    listOperationBoxesByTenant(context.tenantId),
    listQueueForTodayByTenant(context.tenantId),
  ]);

  if (!customer) {
    redirect(resolveQuoteApprovalErrorTarget(formData, "Cliente do orcamento nao encontrado."));
  }

  const service = services.find((item) => item.id === quote.service_id);
  if (!service) {
    redirect(resolveQuoteApprovalErrorTarget(formData, "Servico do orcamento nao encontrado."));
  }

  let vehicle = quote.vehicle_id ? vehicles.find((item) => item.id === quote.vehicle_id) ?? null : null;

  if (context.tenant.operational_profile === "automotive" && !vehicle) {
    redirect(resolveQuoteApprovalErrorTarget(formData, "Selecione ou cadastre um veiculo antes de aprovar este orcamento."));
  }

  if (!vehicle) {
    const createdVehicle = await createVehicleForTenant({
      tenantId: context.tenantId,
      customerId: customer.id,
      plate: generateGenericAttendanceCode(),
      brand: null,
      model: customer.name,
      color: null,
      vehicleType: null,
    });

    if (createdVehicle.error || !createdVehicle.data) {
      redirect(resolveQuoteApprovalErrorTarget(formData, createdVehicle.error?.message ?? "Falha ao criar item operacional do atendimento."));
    }

    vehicle = createdVehicle.data;
  }

  if (context.tenant.operational_profile === "automotive") {
    const activeAttendance = await findActiveAttendanceByVehicle({
      tenantId: context.tenantId,
      vehicleId: vehicle.id,
    });

    if (activeAttendance) {
      redirect(resolveQuoteApprovalErrorTarget(formData, "Este veiculo ja esta em atendimento ativo."));
    }
  }

  const effectiveVehicleType = context.tenant.operational_profile === "automotive" ? vehicle.vehicle_type ?? null : null;
  const estimatedMinutes = resolveServiceMinutesByVehicleType(service, effectiveVehicleType);
  const serviceBasePrice = resolveServicePriceByVehicleType(service, effectiveVehicleType);
  const finalPrice = Number(quote.labor_amount ?? 0) + Number(quote.parts_amount ?? 0) || serviceBasePrice;

  const createdAttendance = await createAttendanceForTenant({
    tenantId: context.tenantId,
    customerId: customer.id,
    vehicleId: vehicle.id,
    serviceId: service.id,
    serviceLabel: service.name,
    estimatedMinutes,
    extraMinutes: 0,
    finalPrice,
    paymentMethod: "pending",
    notifyCustomer: false,
  });

  if (createdAttendance.error || !createdAttendance.data) {
    redirect(resolveQuoteApprovalErrorTarget(formData, createdAttendance.error?.message ?? "Falha ao transformar orcamento em atendimento."));
  }

  const serviceItems = await createAttendanceServiceItemsForTenant({
    tenantId: context.tenantId,
    attendanceId: createdAttendance.data.id,
    items: [
      {
        serviceId: service.id,
        name: service.name,
        estimatedMinutes,
        unitPrice: finalPrice,
        isPrimary: true,
        notes: quote.request_description,
      },
    ],
  });

  if (serviceItems.error) {
    redirect(resolveQuoteApprovalErrorTarget(formData, serviceItems.error.message));
  }

  const entryBox =
    operationBoxes.find((box) => box.kind === "entry" && box.is_active) ??
    [...operationBoxes].sort((a, b) => a.sort_order - b.sort_order).find((box) => box.is_active) ??
    null;

  if (entryBox) {
    const queuePosition =
      currentQueue
        .filter((item) => item.status === "waiting")
        .reduce((max, item) => Math.max(max, item.queue_position ?? 0), 0) + 1;

    const moveError = await moveAttendanceToBoxForTenant({
      attendanceId: createdAttendance.data.id,
      boxId: entryBox.id,
      queuePosition,
      note: "Atendimento criado a partir de orcamento aprovado",
    });

    if (moveError) {
      redirect(resolveQuoteApprovalErrorTarget(formData, moveError.message));
    }
  }

  const publicStatusError = await createAttendancePublicStatus({
    attendanceId: createdAttendance.data.id,
    publicCode: createdAttendance.data.public_code,
    vehicleLabel:
      context.tenant.operational_profile === "automotive"
        ? `${formatVehicleDisplayLabel(vehicle)}${vehicle.color ? ` ${vehicle.color}` : ""}`.trim()
        : customer.name,
    status: "waiting",
    etaMinutes: estimatedMinutes,
    stepIndex: 2,
  });

  if (publicStatusError) {
    redirect(resolveQuoteApprovalErrorTarget(formData, publicStatusError.message));
  }

  const quoteUpdate = await updateServiceQuoteForTenant({
    tenantId: context.tenantId,
    quoteId: quote.id,
    status: "approved",
    approvedAttendanceId: createdAttendance.data.id,
    approvedBy: context.userId,
    approvedAt: new Date().toISOString(),
  });

  if (quoteUpdate.error || !quoteUpdate.data) {
    redirect(resolveQuoteApprovalErrorTarget(formData, quoteUpdate.error?.message ?? "Falha ao finalizar aprovacao do orcamento."));
  }
}
