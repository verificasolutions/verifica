import "server-only";
import { createCommercialIntake } from "@/backend/repos/commercial-intakes-repo";
import { buildCommercialContract, findCommercialPlan } from "@/backend/shared/commercial-offers";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function digitsOnly(value: string) {
  return value.replace(/\D+/g, "");
}

export async function createCommercialIntakeUseCase(formData: FormData) {
  const selectedPlanCode = text(formData, "selected_plan_code");
  const fullName = text(formData, "full_name");
  const email = text(formData, "email").toLowerCase();
  const whatsapp = digitsOnly(text(formData, "whatsapp"));
  const contactPhone = digitsOnly(text(formData, "contact_phone"));
  const document = digitsOnly(text(formData, "document"));
  const postalCode = digitsOnly(text(formData, "postal_code"));
  const street = text(formData, "street");
  const streetNumber = text(formData, "street_number");
  const neighborhood = text(formData, "neighborhood");
  const city = text(formData, "city");
  const state = text(formData, "state").toUpperCase();
  const acceptedContract = String(formData.get("accepted_contract") ?? "") === "true";

  if (!fullName || !email || !whatsapp || !document || !postalCode || !street || !streetNumber || !neighborhood || !city || !state) {
    throw new Error("Preencha todos os dados obrigatórios do cadastro.");
  }

  if (document.length !== 11 && document.length !== 14) {
    throw new Error("Informe um CPF ou CNPJ válido.");
  }

  if (postalCode.length !== 8) {
    throw new Error("Informe um CEP válido.");
  }

  if (!acceptedContract) {
    throw new Error("É obrigatório ler e aceitar o contrato.");
  }

  const plan = findCommercialPlan(selectedPlanCode);
  const contract = buildCommercialContract(plan);

  return createCommercialIntake({
    full_name: fullName,
    email,
    whatsapp,
    contact_phone: contactPhone || null,
    legal_name: text(formData, "legal_name") || null,
    trade_name: text(formData, "trade_name") || null,
    document,
    document_type: document.length > 11 ? "cnpj" : "cpf",
    state_registration: text(formData, "state_registration") || null,
    municipal_registration: text(formData, "municipal_registration") || null,
    postal_code: postalCode,
    street,
    street_number: streetNumber,
    complement: text(formData, "complement") || null,
    neighborhood,
    city,
    state,
    current_situation: text(formData, "current_situation") || null,
    selected_plan_code: plan.code,
    selected_plan_name: plan.name,
    implementation_fee: plan.implementationFee,
    recurring_fee: plan.recurringFee,
    contract_version: contract.version,
    contract_title: contract.title,
    contract_body: contract.body,
    contract_accepted: true,
    contract_accepted_at: new Date().toISOString(),
    status: "awaiting_payment",
    payment_status: "pending",
    metadata: {},
  });
}
