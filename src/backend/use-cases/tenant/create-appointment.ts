import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { createAppointmentForTenant } from "@/backend/repos/appointments-repo";
import { createCustomerForTenant, findCustomerById, updateCustomerForTenant } from "@/backend/repos/customers-repo";
import { listActiveServicesByTenant } from "@/backend/repos/services-repo";
import { createVehicleForTenant, findVehicleByPlate, updateVehicleForTenant } from "@/backend/repos/vehicles-repo";
import { digitsOnly, normalizeDocumentType, registrationOnly } from "@/backend/shared/input-normalizers";
import { getVehicleTypeMeta } from "@/backend/shared/vehicle-catalog";

function generateGenericAppointmentCode() {
  return `AG${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

function resolveAppointmentErrorTarget(formData: FormData, message: string) {
  const requestedTarget = String(formData.get("redirect_to") ?? "").trim();
  const target = requestedTarget.startsWith("/app/dashboard") ? requestedTarget : "/app/dashboard?drawer=agendar";
  const separator = target.includes("?") ? "&" : "?";
  return `${target}${separator}error=${encodeURIComponent(message)}`;
}

export async function createAppointmentUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const isAutomotive = context.tenant.operational_profile === "automotive";
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
  const color = String(formData.get("color") ?? "").trim();
  const serviceId = String(formData.get("service_id") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim();
  const time = String(formData.get("time") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const missingFields: string[] = [];

  if (!customerName) missingFields.push("cliente");
  if (!date) missingFields.push("data");
  if (!time) missingFields.push("hora");
  if (isAutomotive && !plate) missingFields.push("placa");
  if (isAutomotive && !vehicleType) missingFields.push("tipo do veículo");

  if (missingFields.length > 0) {
    redirect(resolveAppointmentErrorTarget(formData, `Preencha os dados do agendamento: ${missingFields.join(", ")}.`));
  }

  if (isAutomotive && !getVehicleTypeMeta(vehicleType)) {
    redirect(resolveAppointmentErrorTarget(formData, "Selecione um tipo de veículo válido."));
  }

  let serviceIdToPersist: string | null = null;
  if (serviceId) {
    const services = await listActiveServicesByTenant(context.tenantId);
    const service = services.find((item) => item.id === serviceId);
    if (!service) {
      redirect(resolveAppointmentErrorTarget(formData, "Serviço inválido."));
    }
    serviceIdToPersist = service.id;
  }

  let vehicle = isAutomotive ? await findVehicleByPlate(context.tenantId, plate) : null;
  let customer = vehicle?.customer_id ? await findCustomerById(context.tenantId, vehicle.customer_id) : null;

  if (!customer) {
    const createdCustomer = await createCustomerForTenant({
      tenantId: context.tenantId,
      name: customerName,
      whatsapp: whatsapp || null,
      email: email || null,
      document: document || null,
      documentType,
      contactPhone1: whatsapp || null,
      contactPhone2: contactPhone2 || null,
    });
    if (createdCustomer.error || !createdCustomer.data) {
      redirect(resolveAppointmentErrorTarget(formData, createdCustomer.error?.message ?? "Falha ao criar cliente."));
    }
    customer = createdCustomer.data;
  } else {
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
      redirect(resolveAppointmentErrorTarget(formData, refreshedCustomer.error?.message ?? "Falha ao atualizar cliente."));
    }

    customer = refreshedCustomer.data;
  }

  if (!vehicle) {
    const createdVehicle = await createVehicleForTenant({
      tenantId: context.tenantId,
      customerId: customer.id,
      plate: isAutomotive ? plate : generateGenericAppointmentCode(),
      brand: isAutomotive ? vehicleBrand || null : null,
      model: isAutomotive ? vehicleModel : customer.name,
      color: isAutomotive ? color || null : null,
      vehicleType: isAutomotive ? vehicleType : null,
    });
    if (createdVehicle.error || !createdVehicle.data) {
      redirect(resolveAppointmentErrorTarget(formData, createdVehicle.error?.message ?? "Falha ao criar item do agendamento."));
    }
    vehicle = createdVehicle.data;
  } else if (isAutomotive) {
    const updatedVehicle = await updateVehicleForTenant({
      tenantId: context.tenantId,
      vehicleId: vehicle.id,
      brand: vehicleBrand || vehicle.brand || null,
      model: vehicleModel || vehicle.model,
      color: color || vehicle.color || null,
      vehicleType: vehicleType || vehicle.vehicle_type || null,
    });

    if (updatedVehicle.error || !updatedVehicle.data) {
      redirect(resolveAppointmentErrorTarget(formData, updatedVehicle.error?.message ?? "Falha ao atualizar veículo."));
    }

    vehicle = updatedVehicle.data;
  }

  const scheduledFor = new Date(`${date}T${time}:00`).toISOString();
  const error = await createAppointmentForTenant({
    tenantId: context.tenantId,
    customerId: customer.id,
    vehicleId: vehicle.id,
    serviceId: serviceIdToPersist,
    scheduledFor,
    notes: notes || null,
  });

  if (error) {
    redirect(resolveAppointmentErrorTarget(formData, error.message));
  }
}
