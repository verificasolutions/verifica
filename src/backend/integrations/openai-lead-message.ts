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

export async function generateLeadWhatsappMessage(input: {
  lead: LeadCompanyRecord;
  analysis: LeadAnalysisRecord | null;
}) {
  const apiKey = getOptionalOpenAiApiKey();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada no ambiente.");
  }

  const prompt = `Crie uma mensagem curta de WhatsApp para abordar esta empresa.

Tom:
- direto;
- simples;
- sem linguagem corporativa;
- sem parecer propaganda genérica;
- linguagem de quem fala com dono de oficina, funilaria, lava-rápido ou estética automotiva.

Comece com uma dor forte, por exemplo:
'Não adianta ser bom se ninguém te encontra.'

Dados da empresa:
Nome: ${input.lead.business_name}
Tipo: ${input.lead.business_type}
Cidade: ${input.lead.city ?? "-"}
Problemas encontrados: ${input.analysis?.problems_found?.length ? input.analysis.problems_found.join("; ") : "-"}
Score de oportunidade: ${input.lead.opportunity_score}

Objetivo:
Gerar curiosidade e fazer a pessoa responder.
Não tentar vender tudo na primeira mensagem.`;

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
    throw new Error(`Falha ao gerar mensagem IA (${response.status}).`);
  }

  const payload = (await response.json()) as OpenAiResponsePayload;
  const text = extractText(payload);

  if (!text) {
    throw new Error("A IA não retornou texto para a mensagem.");
  }

  return text;
}
