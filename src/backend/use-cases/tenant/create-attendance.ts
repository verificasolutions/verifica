import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { triggerMessageDispatchProcessing } from "@/backend/integrations/message-dispatch-trigger";
import { buildQueueEntryMessage } from "@/backend/integrations/whatsapp-templates";
import { createAttendanceServiceItemsForTenant } from "@/backend/repos/attendance-service-items-repo";
import {
  createAttendanceForTenant,
  createAttendancePublicStatus,
  findActiveAttendanceByVehicle,
  listQueueForTodayByTenant,
} from "@/backend/repos/attendances-operations-repo";
import { createCustomerForTenant, findCustomerById, updateCustomerForTenant } from "@/backend/repos/customers-repo";
import { enqueueMessageDispatch } from "@/backend/repos/message-dispatch-queue-repo";
import { listOperationBoxesByTenant, moveAttendanceToBoxForTenant } from "@/backend/repos/operation-boxes-repo";
import { listActiveServicesByTenant } from "@/backend/repos/services-repo";
import { getTenantSettings } from "@/backend/repos/tenant-settings-repo";
import { createVehicleForTenant, findVehicleByPlate, listActiveVehiclesByCustomer, updateVehicleForTenant } from "@/backend/repos/vehicles-repo";
import { getTrackingUrl } from "@/backend/shared/app-url";
import { digitsOnly, normalizeDocumentType, registrationOnly } from "@/backend/shared/input-normalizers";
import { summarizeAttendanceServiceItems } from "@/backend/shared/attendance-service-summary";
import { isTenantMessageStageEnabled } from "@/backend/shared/tenant-whatsapp-messages";
import {
  formatVehicleDisplayLabel,
  getVehicleLabelByType,
  getVehicleTypeMeta,
  resolveServiceMinutesByVehicleType,
  resolveServicePriceByVehicleType,
} from "@/backend/shared/vehicle-catalog";

function resolveAttendanceErrorTarget(formData: FormData, message: string) {
  const requestedTarget = String(formData.get("redirect_to") ?? "").trim();
  const [path, query = ""] = (requestedTarget.startsWith("/app/dashboard") ? requestedTarget : "/app/dashboard").split("?");
  const params = new URLSearchParams(query);
  params.set("drawer", "novo");
  params.delete("message");
  params.set("error", message);
  return `${path}?${params.toString()}`;
}

function generateGenericAttendanceCode() {
  return `OS${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

function parseManualServiceItems(formData: FormData) {
  const raw = String(formData.get("manual_service_items") ?? "").trim();
  if (!raw) return [];

  const seen = new Set<string>();
  return raw
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => {
      if (!item) return false;
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export async function createAttendanceUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const isAutomotive = context.tenant.operational_profile === "automotive";
  const selectedCustomerId = String(formData.get("customer_id") ?? "").trim();
  const customerName = String(formData.get("customer_name") ?? "").trim();
  const whatsapp = digitsOnly(String(formData.get("whatsapp") ?? "").trim());
  const contactPhone2 = digitsOnly(String(formData.get("contact_phone_2") ?? "").trim());
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const document = digitsOnly(String(formData.get("document") ?? "").trim());
  const documentType = normalizeDocumentType(document);
  const plate = registrationOnly(String(formData.get("plate") ?? "").trim());
  const vehicleType = String(formData.get("vehicle_type") ?? "").trim();
  const vehicleBrand = String(formData.get("vehicle_brand") ?? "").trim();
  const vehicleModel = String(formData.get("vehicle_model") ?? "").trim();
  const model = vehicleModel || getVehicleLabelByType(vehicleType);
  const color = String(formData.get("color") ?? "").trim();
  const selectedServiceIds = formData
    .getAll("service_ids")
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  const paymentMethod = String(formData.get("payment_method") ?? "pending").trim() as "cash" | "pix" | "card" | "pending";
  const notifyCustomer = String(formData.get("notify_customer") ?? "") === "true";
  const fleetBilling = isAutomotive && String(formData.get("fleet_billing") ?? "") === "true";
  const billingDueDate = isAutomotive ? String(formData.get("billing_due_date") ?? "").trim() || null : null;
  const extraMinutesInput = Number(String(formData.get("extra_minutes") ?? "0").trim());
  const extraMinutes = Number.isFinite(extraMinutesInput) && extraMinutesInput > 0 ? Math.floor(extraMinutesInput) : 0;
  const manualServiceItems = parseManualServiceItems(formData);

  if (isAutomotive && !plate) {
    redirect(resolveAttendanceErrorTarget(formData, "Informe a placa do atendimento."));
  }

  if (fleetBilling && !billingDueDate) {
    redirect(resolveAttendanceErrorTarget(formData, "Informe a data de cobrança para atendimento de frota."));
  }

  const services = await listActiveServicesByTenant(context.tenantId);
  const selectedServices = services.filter((item) => selectedServiceIds.includes(item.id));

  if (selectedServiceIds.length > 0 && selectedServices.length !== selectedServiceIds.length) {
    redirect(
      services.length === 0
        ? resolveAttendanceErrorTarget(formData, "Os serviços marcados não existem mais.")
        : resolveAttendanceErrorTarget(formData, "Serviço inválido."),
    );
  }

  let vehicle = isAutomotive ? await findVehicleByPlate(context.tenantId, plate) : null;

  if (isAutomotive && !vehicle && !getVehicleTypeMeta(vehicleType)) {
    redirect(resolveAttendanceErrorTarget(formData, "Selecione o porte do veículo para concluir o cadastro."));
  }

  if (!selectedCustomerId && !customerName && !vehicle && !whatsapp) {
    redirect(resolveAttendanceErrorTarget(formData, "Informe ao menos o nome do cliente, selecione um cliente ou use um WhatsApp cadastrado."));
  }

  let customerSource: "selected" | "vehicle" | "new" | null = null;
  let customer = null;
  let customerNameFallback = customerName;

  if (vehicle?.customer_id) {
    customer = await findCustomerById(context.tenantId, vehicle.customer_id);
    if (customer) {
      customerSource = "vehicle";
    }
  }

  if (!customer && selectedCustomerId) {
    customer = await findCustomerById(context.tenantId, selectedCustomerId);
    if (customer) {
      customerSource = "selected";
    }
  }

  if (isAutomotive && customerSource === "selected" && customer && !customer.is_fleet && !vehicle) {
    const selectedCustomerVehicles = await listActiveVehiclesByCustomer(context.tenantId, customer.id);
    const hasDifferentPlate = selectedCustomerVehicles.some((item) => item.plate !== plate);

    if (hasDifferentPlate) {
      customerNameFallback = customerName || customer.name;
      customer = null;
      customerSource = null;
    }
  }

  if (!customer) {
    const createdCustomer = await createCustomerForTenant({
      tenantId: context.tenantId,
      name: customerNameFallback || "Cliente sem nome",
      whatsapp: whatsapp || null,
      email: email || null,
      document: document || null,
      documentType,
      contactPhone1: whatsapp || null,
      contactPhone2: contactPhone2 || null,
    });

    if (createdCustomer.error || !createdCustomer.data) {
      redirect(resolveAttendanceErrorTarget(formData, createdCustomer.error?.message ?? "Falha ao criar cliente."));
    }

    customer = createdCustomer.data;
    customerSource = "new";
  } else if (customerSource === "selected") {
    const refreshedCustomer = await updateCustomerForTenant({
      tenantId: context.tenantId,
      customerId: customer.id,
      name: customerName || customer.name,
      whatsapp: whatsapp || customer.whatsapp,
      email: email || customer.email || null,
      document: document || customer.document || null,
      documentType: documentType ?? customer.document_type ?? null,
      contactPhone1: whatsapp || customer.contact_phone_1 || customer.whatsapp,
      contactPhone2: contactPhone2 || customer.contact_phone_2 || null,
    });

    if (refreshedCustomer.error || !refreshedCustomer.data) {
      redirect(resolveAttendanceErrorTarget(formData, refreshedCustomer.error?.message ?? "Falha ao atualizar cliente."));
    }

    customer = refreshedCustomer.data;
  }

  if (!vehicle) {
    const createdVehicle = await createVehicleForTenant({
      tenantId: context.tenantId,
      customerId: customer.id,
      plate: isAutomotive ? plate : generateGenericAttendanceCode(),
      brand: isAutomotive ? vehicleBrand || null : null,
      model: isAutomotive ? model : customer.name,
      color: isAutomotive ? color || null : null,
      vehicleType: isAutomotive ? vehicleType : null,
    });

    if (createdVehicle.error || !createdVehicle.data) {
      redirect(resolveAttendanceErrorTarget(formData, createdVehicle.error?.message ?? "Falha ao criar item do atendimento."));
    }

    vehicle = createdVehicle.data;
  } else if (isAutomotive && (vehicleBrand || vehicleModel || color || vehicleType)) {
    const updatedVehicle = await updateVehicleForTenant({
      tenantId: context.tenantId,
      vehicleId: vehicle.id,
      brand: vehicleBrand || vehicle.brand || null,
      model: vehicleModel || vehicle.model,
      color: color || vehicle.color || null,
      vehicleType: vehicleType || vehicle.vehicle_type || null,
    });

    if (updatedVehicle.error || !updatedVehicle.data) {
      redirect(resolveAttendanceErrorTarget(formData, updatedVehicle.error?.message ?? "Falha ao atualizar veículo."));
    }

    vehicle = updatedVehicle.data;
  }

  if (isAutomotive) {
    const activeAttendance = await findActiveAttendanceByVehicle({
      tenantId: context.tenantId,
      vehicleId: vehicle.id,
    });

    if (activeAttendance) {
      redirect(resolveAttendanceErrorTarget(formData, "Este veículo já está em atendimento ativo na operação."));
    }
  }

  const effectiveVehicleType = isAutomotive ? vehicle.vehicle_type ?? vehicleType : null;
  const serviceItemsPayload =
    selectedServices.length > 0 || manualServiceItems.length > 0
      ? [
          ...selectedServices.map((item, index) => ({
            serviceId: item.id,
            name: item.name,
            estimatedMinutes: resolveServiceMinutesByVehicleType(item, effectiveVehicleType),
            unitPrice: resolveServicePriceByVehicleType(item, effectiveVehicleType),
            isPrimary: index === 0,
          })),
          ...manualServiceItems.map((name, index) => ({
            serviceId: null,
            name,
            estimatedMinutes: null,
            unitPrice: 0,
            isPrimary: selectedServices.length === 0 && index === 0,
          })),
        ]
      : [
          {
            serviceId: null,
            name: "Orçamento / diagnóstico",
            estimatedMinutes: null,
            unitPrice: 0,
            isPrimary: true,
          },
        ];

  const primaryService = serviceItemsPayload.find((item) => item.isPrimary) ?? serviceItemsPayload[0];
  const estimatedMinutes =
    serviceItemsPayload.reduce((sum, item) => sum + Number(item.estimatedMinutes ?? 0), 0) + extraMinutes;
  const finalPrice = serviceItemsPayload.reduce((sum, item) => sum + Number(item.unitPrice ?? 0), 0);

  const createdAttendance = await createAttendanceForTenant({
    tenantId: context.tenantId,
    customerId: customer.id,
    vehicleId: vehicle.id,
    serviceId: primaryService?.serviceId ?? null,
    serviceLabel: primaryService?.name ?? "Orçamento / diagnóstico",
    estimatedMinutes,
    extraMinutes,
    finalPrice,
    paymentMethod,
    notifyCustomer,
    billingMode: fleetBilling ? "fleet" : "standard",
    billingDueDate: fleetBilling ? billingDueDate : null,
  });

  if (createdAttendance.error || !createdAttendance.data) {
    redirect(resolveAttendanceErrorTarget(formData, createdAttendance.error?.message ?? "Falha ao criar atendimento."));
  }

  const createdServiceItems = await createAttendanceServiceItemsForTenant({
    tenantId: context.tenantId,
    attendanceId: createdAttendance.data.id,
    items: serviceItemsPayload,
  });

  if (createdServiceItems.error || createdServiceItems.data.length === 0) {
    redirect(resolveAttendanceErrorTarget(formData, createdServiceItems.error?.message ?? "Falha ao salvar os serviços do atendimento."));
  }

  const [settings, operationBoxes, currentQueue] = await Promise.all([
    getTenantSettings(context.tenantId),
    listOperationBoxesByTenant(context.tenantId),
    listQueueForTodayByTenant(context.tenantId),
  ]);

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
      note: "Entrada inicial do atendimento",
    });

    if (moveError) {
      redirect(resolveAttendanceErrorTarget(formData, moveError.message));
    }
  }

  const publicStatusError = await createAttendancePublicStatus({
    attendanceId: createdAttendance.data.id,
    publicCode: createdAttendance.data.public_code,
    vehicleLabel: `${formatVehicleDisplayLabel(vehicle)}${vehicle.color ? ` ${vehicle.color}` : ""}`.trim(),
    status: "waiting",
    etaMinutes: estimatedMinutes,
    stepIndex: 2,
  });

  if (publicStatusError) {
    redirect(resolveAttendanceErrorTarget(formData, publicStatusError.message));
  }

  if (notifyCustomer && customer.whatsapp && isTenantMessageStageEnabled(settings, "queue")) {
    const trackingUrl = getTrackingUrl(createdAttendance.data.public_code);
    const message = buildQueueEntryMessage(settings, {
      tenantName: context.tenant.name,
      customerName: customer.name,
      vehicleModel: isAutomotive ? formatVehicleDisplayLabel(vehicle) : "",
      vehiclePlate: isAutomotive ? vehicle.plate : "",
      serviceName: summarizeAttendanceServiceItems(createdServiceItems.data) ?? primaryService?.name ?? "Orçamento / diagnóstico",
      etaMinutes: estimatedMinutes,
      trackingUrl,
      operationalProfile: context.tenant.operational_profile,
    });
    const dispatch = await enqueueMessageDispatch({
      tenantId: context.tenantId,
      attendanceId: createdAttendance.data.id,
      customerId: customer.id,
      stage: "queue",
      whatsapp: customer.whatsapp,
      text: message,
    });

    if (dispatch.error) {
      console.error("Falha ao enfileirar mensagem de entrada na fila", {
        tenantId: context.tenantId,
        attendanceId: createdAttendance.data.id,
        whatsapp: customer.whatsapp,
        reason: dispatch.error.message,
      });
    } else {
      void triggerMessageDispatchProcessing();
    }
  }
}
