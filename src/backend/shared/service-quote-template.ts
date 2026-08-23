import type { CustomerRecord, ServiceQuoteRecord, TenantRecord } from "@/backend/types";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function buildServiceQuoteText(input: {
  tenant: Pick<TenantRecord, "name">;
  customer: Pick<CustomerRecord, "name" | "email" | "whatsapp" | "document">;
  quote: Pick<ServiceQuoteRecord, "request_description" | "labor_description" | "labor_amount" | "parts_description" | "parts_amount" | "notes">;
  serviceName: string;
  vehicleLabel?: string | null;
}) {
  const total = Number(input.quote.labor_amount ?? 0) + Number(input.quote.parts_amount ?? 0);

  return [
    `${input.tenant.name} - Orçamento`,
    ``,
    `Cliente: ${input.customer.name}`,
    input.customer.whatsapp ? `WhatsApp: ${input.customer.whatsapp}` : null,
    input.customer.email ? `E-mail: ${input.customer.email}` : null,
    input.customer.document ? `Documento: ${input.customer.document}` : null,
    input.vehicleLabel ? `Veículo: ${input.vehicleLabel}` : null,
    `Serviço operacional: ${input.serviceName}`,
    ``,
    `Solicitação: ${input.quote.request_description}`,
    input.quote.labor_description ? `Mão de obra: ${input.quote.labor_description}` : null,
    `Valor da mão de obra: ${formatCurrency(Number(input.quote.labor_amount ?? 0))}`,
    input.quote.parts_description ? `Peças e acessórios: ${input.quote.parts_description}` : null,
    `Valor de peças e acessórios: ${formatCurrency(Number(input.quote.parts_amount ?? 0))}`,
    `Total: ${formatCurrency(total)}`,
    input.quote.notes ? `Observações: ${input.quote.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
