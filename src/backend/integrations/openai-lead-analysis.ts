import "server-only";
import { getOptionalOpenAiApiKey } from "@/lib/env";
import type { LeadAnalysisRecord, LeadCompanyRecord } from "@/backend/types";

type OpenAiResponsePayload = {
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

function extractText(payload: OpenAiResponsePayload) {
  return (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

export async function generateLeadAiSummary(input: {
  lead: LeadCompanyRecord;
  analysis: LeadAnalysisRecord | null;
}) {
  const apiKey = getOptionalOpenAiApiKey();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada no ambiente.");
  }

  const prompt = `Analise esta empresa automotiva como possível cliente do Verifica.

Dados:
Nome: ${input.lead.business_name}
Tipo de negócio: ${input.lead.business_type}
Cidade: ${input.lead.city ?? "-"}
Telefone: ${input.lead.phone ?? "-"}
Site: ${input.lead.website ?? "-"}
Instagram: ${input.analysis?.instagram_url ?? "-"}
Nota no Google: ${input.lead.rating ?? "-"}
Quantidade de avaliações: ${input.lead.review_count}

Problemas já identificados:
${input.analysis?.problems_found?.length ? input.analysis.problems_found.join("; ") : "-"}

Identifique de forma direta quais problemas de presença digital ou organização essa empresa aparenta ter.

Explique por que ela pode ser uma boa oportunidade comercial.

Use linguagem simples, prática e voltada para dono de oficina, lava-rápido, funilaria ou estética automotiva.`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: prompt,
    }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao gerar análise IA (${response.status}).`);
  }

  const payload = (await response.json()) as OpenAiResponsePayload;
  const text = extractText(payload);

  if (!text) {
    throw new Error("A IA não retornou texto para a análise.");
  }

  return text;
}
