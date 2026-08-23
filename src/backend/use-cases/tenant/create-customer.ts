import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { createCustomerForTenant } from "@/backend/repos/customers-repo";
import { createVehicleForTenant } from "@/backend/repos/vehicles-repo";
import { digitsOnly } from "@/backend/shared/input-normalizers";

function resolveCustomerErrorTarget(formData: FormData, message: string) {
  const requestedTarget = String(formData.get("redirect_to") ?? "").trim();
  const target = requestedTarget.startsWith("/app/dashboard?section=clientes")
    ? requestedTarget
    : "/app/dashboard?section=clientes&customerForm=1";
  const separator = target.includes("?") ? "&" : "?";
  return `${target}${separator}error=${encodeURIComponent(message)}`;
}

function normalizeText(value: FormDataEntryValue | null | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizePlate(value: FormDataEntryValue | null | undefined) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 7);
}

function resolveDocumentType(documentDigits: string) {
  if (documentDigits.length === 11) return "cpf" as const;
  if (documentDigits.length === 14) return "cnpj" as const;
  return null;
}

export async function createCustomerUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const isAutomotive = context.tenant.operational_profile === "automotive";
  const displayName = normalizeText(formData.get("name"));
  const legalName = normalizeText(formData.get("legal_name"));
  const tradeName = normalizeText(formData.get("trade_name"));
  const email = normalizeText(formData.get("email"))?.toLowerCase() ?? null;
  const whatsapp = digitsOnly(String(formData.get("whatsapp") ?? "").trim()) || null;
  const contactPhone1 = digitsOnly(String(formData.get("contact_phone_1") ?? "").trim()) || null;
  const contactPhone2 = digitsOnly(String(formData.get("contact_phone_2") ?? "").trim()) || null;
  const postalCode = digitsOnly(String(formData.get("postal_code") ?? "").trim()) || null;
  const document = digitsOnly(String(formData.get("document") ?? "").trim()) || null;
  const documentType = document ? resolveDocumentType(document) : null;
  const isFleet = String(formData.get("is_fleet") ?? "") === "true";
  const resolvedName = displayName ?? tradeName ?? legalName;

  if (!resolvedName) {
    redirect(resolveCustomerErrorTarget(formData, "Informe o nome, razão social ou nome fantasia do cliente."));
  }

  if (document && !documentType) {
    redirect(resolveCustomerErrorTarget(formData, "CPF ou CNPJ inválido."));
  }

  const createdCustomer = await createCustomerForTenant({
    tenantId: context.tenantId,
    name: resolvedName,
    whatsapp,
    legalName,
    tradeName,
    email,
    document,
    documentType,
    stateRegistration: normalizeText(formData.get("state_registration")),
    municipalRegistration: normalizeText(formData.get("municipal_registration")),
    postalCode,
    street: normalizeText(formData.get("street")),
    streetNumber: normalizeText(formData.get("street_number")),
    complement: normalizeText(formData.get("complement")),
    neighborhood: normalizeText(formData.get("neighborhood")),
    city: normalizeText(formData.get("city")),
    state: normalizeText(formData.get("state")),
    contactPhone1,
    contactPhone2,
    isFleet,
  });

  if (createdCustomer.error || !createdCustomer.data) {
    redirect(resolveCustomerErrorTarget(formData, createdCustomer.error?.message ?? "Falha ao cadastrar cliente."));
  }

  if (isAutomotive) {
    const plates = formData.getAll("vehicle_plate").map((value) => normalizePlate(value));
    const types = formData.getAll("vehicle_type").map((value) => normalizeText(value));
    const brands = formData.getAll("vehicle_brand").map((value) => normalizeText(value));
    const models = formData.getAll("vehicle_model").map((value) => normalizeText(value));
    const colors = formData.getAll("vehicle_color").map((value) => normalizeText(value));

    const vehicles = plates
      .map((plateValue, index) => ({
        plate: plateValue,
        vehicleType: types[index] ?? null,
        brand: brands[index] ?? null,
        model: models[index] ?? null,
        color: colors[index] ?? null,
      }))
      .filter((vehicle) => vehicle.plate || vehicle.model || vehicle.brand || vehicle.color || vehicle.vehicleType);

    for (const vehicle of vehicles) {
      if (!vehicle.plate || !vehicle.model) {
        redirect(resolveCustomerErrorTarget(formData, "Cada veículo precisa ter placa e modelo para ser salvo."));
      }

      const createdVehicle = await createVehicleForTenant({
        tenantId: context.tenantId,
        customerId: createdCustomer.data.id,
        plate: vehicle.plate,
        brand: vehicle.brand,
        model: vehicle.model,
        color: vehicle.color,
        vehicleType: vehicle.vehicleType,
      });

      if (createdVehicle.error || !createdVehicle.data) {
        redirect(resolveCustomerErrorTarget(formData, createdVehicle.error?.message ?? "Falha ao cadastrar veículo do cliente."));
      }
    }
  }

  return createdCustomer.data;
}
