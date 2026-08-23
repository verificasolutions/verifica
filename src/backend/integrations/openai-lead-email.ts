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

function parseEmailDraft(raw: string) {
  const normalized = raw.replace(/\r/g, "").trim();
  const subjectMatch = normalized.match(/ASSUNTO:\s*(.+)/i);
  const bodyMatch = normalized.match(/CORPO:\s*([\s\S]+)/i);

  const subject = subjectMatch?.[1]?.trim() ?? "";
  const body = bodyMatch?.[1]?.trim() ?? "";

  if (!subject || !body) {
    throw new Error("A IA nao retornou assunto e corpo do e-mail no formato esperado.");
  }

  return { subject, body };
}

export function buildFallbackLeadEmailMessage(input: {
  lead: LeadCompanyRecord;
  analysis: LeadAnalysisRecord | null;
}) {
  const firstProblem = input.analysis?.problems_found?.[0] ?? null;
  const citySuffix = input.lead.city ? ` em ${input.lead.city}` : "";
  const subject = `${input.lead.business_name}: uma ideia simples para captar mais clientes`;
  const body = [
    `Oi, tudo bem?`,
    `Vi a ${input.lead.business_name}${citySuffix} e achei que valia um contato rapido.`,
    firstProblem
      ? `Notei um ponto que pode estar atrapalhando a captacao hoje: ${firstProblem.toLowerCase()}.`
      : `Hoje ajudamos operacoes locais a organizar melhor a presenca digital e transformar interesse em atendimento.`,
    `Se fizer sentido, eu te mostro em 10 minutos como isso pode virar mais pedidos sem complicar a rotina.`,
    `Posso te enviar um exemplo direto no seu caso?`,
  ].join("\n\n");

  return { subject, body };
}

export async function generateLeadEmailMessage(input: {
  lead: LeadCompanyRecord;
  analysis: LeadAnalysisRecord | null;
}) {
  const apiKey = getOptionalOpenAiApiKey();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY nao configurada no ambiente.");
  }

  const prompt = `Crie um e-mail comercial curto para prospeccao fria desta empresa.

Regras:
- responder em portugues do Brasil;
- parecer mensagem humana, nao newsletter;
- evitar termos como revolucao, potencializar, transformar;
- sem excesso de formalidade;
- no maximo 140 palavras no corpo;
- fechar com uma pergunta simples;
- entregar a resposta neste formato exato:
ASSUNTO: <assunto>
CORPO:
<corpo do e-mail>

Dados da empresa:
Nome: ${input.lead.business_name}
Tipo: ${input.lead.business_type}
Cidade: ${input.lead.city ?? "-"}
Site: ${input.lead.website ?? "-"}
Telefone: ${input.lead.phone ?? "-"}
Problemas encontrados: ${input.analysis?.problems_found?.length ? input.analysis.problems_found.join("; ") : "-"}
Score de oportunidade: ${input.lead.opportunity_score}

Objetivo:
- chamar a atencao para presenca digital, captacao ou operacao;
- propor uma conversa curta;
- soar como abordagem 1 a 1.`;

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
    throw new Error(`Falha ao gerar e-mail IA (${response.status}).`);
  }

  const payload = (await response.json()) as OpenAiResponsePayload;
  const text = extractText(payload);

  if (!text) {
    throw new Error("A IA nao retornou texto para o e-mail.");
  }

  return parseEmailDraft(text);
}
