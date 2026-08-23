import "server-only";
import type { TenantSettingsRecord } from "@/backend/types";

type MessageTemplateInput = {
  tenantName: string;
  customerName: string;
  vehicleModel: string;
  vehiclePlate: string;
  serviceName: string;
  etaMinutes: number;
  trackingUrl: string;
  operationalProfile?: "automotive" | "generic";
};

function fillTemplate(template: string, input: MessageTemplateInput) {
  return template
    .replaceAll("{tenant}", input.tenantName)
    .replaceAll("{cliente}", input.customerName)
    .replaceAll("{veiculo}", input.vehicleModel)
    .replaceAll("{placa}", input.vehiclePlate)
    .replaceAll("{servico}", input.serviceName)
    .replaceAll("{previsao}", String(input.etaMinutes))
    .replaceAll("{link}", input.trackingUrl);
}

function baseTemplate(kind: "queue" | "washing" | "finishing" | "ready", input: MessageTemplateInput) {
  if (kind === "queue") {
    return `Olá, ${input.customerName}. Recebemos seu atendimento de ${input.serviceName} na ${input.tenantName}. Previsão: ${input.etaMinutes} min. Acompanhe: ${input.trackingUrl}`;
  }

  if (kind === "washing") {
    return `Olá, ${input.customerName}. Seu atendimento de ${input.serviceName} entrou em execução agora na ${input.tenantName}. Acompanhe: ${input.trackingUrl}`;
  }

  if (kind === "finishing") {
    return `Olá, ${input.customerName}. Seu atendimento está na etapa final de conferência e acabamento na ${input.tenantName}. Acompanhe: ${input.trackingUrl}`;
  }

  return `Olá, ${input.customerName}. Seu serviço ${input.serviceName} foi concluído na ${input.tenantName}. Nossa equipe está à disposição. Acompanhe: ${input.trackingUrl}`;
}

export function buildQueueEntryMessage(settings: TenantSettingsRecord | null, input: MessageTemplateInput) {
  const template = settings?.queue_entry_message?.trim();
  return fillTemplate(template || baseTemplate("queue", input), input);
}

export function buildWashStartMessage(settings: TenantSettingsRecord | null, input: MessageTemplateInput) {
  const template = settings?.wash_start_message?.trim();
  return fillTemplate(template || baseTemplate("washing", input), input);
}

export function buildFinishingMessage(settings: TenantSettingsRecord | null, input: MessageTemplateInput) {
  const template = settings?.finishing_message?.trim();
  return fillTemplate(template || baseTemplate("finishing", input), input);
}

export function buildReadyMessage(settings: TenantSettingsRecord | null, input: MessageTemplateInput) {
  const template = settings?.ready_message?.trim();
  return fillTemplate(template || baseTemplate("ready", input), input);
}

export function buildReturnReminderMessage(settings: TenantSettingsRecord | null, input: MessageTemplateInput) {
  const template = settings?.return_reminder_message?.trim();
  const fallback = `Olá, ${input.customerName}. Já faz alguns dias desde seu último atendimento na ${input.tenantName}. Quer agendar um novo serviço?`;
  return fillTemplate(template || fallback, input);
}
