export type CommercialPlanCode = "starter" | "implementation" | "custom_saas";

export type CommercialPlanDefinition = {
  code: CommercialPlanCode;
  name: string;
  priceLabel: string;
  implementationFee: number | null;
  recurringFee: number | null;
  summary: string;
  highlights: string[];
  recurringIncludes?: string[];
};

export const COMMERCIAL_CONTRACT_VERSION = "2026-06-25";

export const commercialPlans: CommercialPlanDefinition[] = [
  {
    code: "implementation",
    name: "Implantação Verifica",
    priceLabel: "R$ 1.000,00 de implantação + R$ 149,00/mês após 30 dias",
    implementationFee: 1000,
    recurringFee: 149,
    summary: "Inserção digital, implantação do sistema, treinamento e ativação completa da operação online.",
    highlights: [
      "Fase de entendimento da sua situação atual e desenho do plano de inserção online.",
      "Treinamento para utilização do SaaS e organização da operação.",
      "Criação de capa, imagem de perfil e mídias essenciais para presença digital.",
      "Criação ou ajuste das mídias quando a empresa ainda não tiver estrutura pronta.",
      "Habilitação completa do sistema, com fluxo operacional e automações configuradas.",
    ],
    recurringIncludes: [
      "Uso contínuo do SaaS.",
      "Assistência técnica.",
      "Revisões e insights para evolução do negócio.",
      "Uso de IA para ajustes e melhorias do dia a dia.",
      "Acompanhamento de performance operacional e digital.",
      "Suporte para evolução de presença online e rotina da operação.",
    ],
  },
  {
    code: "custom_saas",
    name: "Crie um SaaS pra mim",
    priceLabel: "A partir de R$ 4.900,00",
    implementationFee: 4900,
    recurringFee: null,
    summary: "Projeto sob medida para quem gostou da proposta, mas precisa de algo exclusivo ou mais profundo.",
    highlights: [
      "Reuniões para entender a necessidade real, o processo atual e o resultado desejado.",
      "Duas visitas presenciais inclusas: diagnóstico e implementação com treinamento.",
      "Escopo personalizado conforme operação, necessidade comercial e rotina da empresa.",
      "Entrega orientada a uso real, não apenas a tela bonita ou sistema genérico.",
    ],
  },
  {
    code: "starter",
    name: "Básico do básico",
    priceLabel: "R$ 39,90/mês",
    implementationFee: null,
    recurringFee: 39.9,
    summary: "Uso direto do dashboard para começar simples e rápido.",
    highlights: [
      "Uso do dashboard.",
      "Cadastro de novo atendimento.",
      "Acompanhamento do fluxo pelo dashboard.",
      "Modo TV para visão operacional básica.",
    ],
  },
];

export const commercialOfferHighlights = [
  "Inserção online com posicionamento profissional.",
  "Existência e presença no Google Maps.",
  "Site próprio com domínio próprio.",
  "Automatização de mensagens de WhatsApp do fluxo de trabalho.",
  "Controle do fluxo de trabalho e da operação.",
  "Caixa para apoiar o controle das contas.",
  "Cadastro e gestão de colaboradores.",
  "Treinamento e apoio de uso real no dia a dia.",
];

export function findCommercialPlan(code: string) {
  return commercialPlans.find((item) => item.code === code) ?? commercialPlans[0];
}

export function buildCommercialContract(plan: CommercialPlanDefinition) {
  const recurring = plan.recurringIncludes?.length
    ? `Itens do mensal:\n- ${plan.recurringIncludes.join("\n- ")}`
    : "";

  const implementationText =
    plan.implementationFee !== null
      ? `Valor de implantação: R$ ${plan.implementationFee.toFixed(2).replace(".", ",")}.`
      : "Sem taxa de implantação para este plano.";

  const recurringText =
    plan.recurringFee !== null
      ? `Valor recorrente mensal: R$ ${plan.recurringFee.toFixed(2).replace(".", ",")}.`
      : "Valor recorrente será definido conforme o escopo aprovado.";

  const body = [
    `Plano contratado: ${plan.name}.`,
    implementationText,
    recurringText,
    "O cliente declara que leu, entendeu e concorda com a proposta comercial apresentada pela Verifica Solutions.",
    "A implantação contempla diagnóstico inicial, definição da estratégia de inserção digital, configuração do sistema e treinamento conforme o plano escolhido.",
    `Escopo principal do plano:\n- ${plan.highlights.join("\n- ")}`,
    recurring,
    "O início da operação e da cobrança recorrente depende da confirmação do pagamento e da disponibilidade das informações fornecidas pelo cliente.",
    "A Verifica Solutions poderá usar as informações do cadastro exclusivamente para implantação, suporte, cobrança, envio contratual e operação comercial do serviço.",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    title: `Contrato Comercial - ${plan.name}`,
    body,
    version: COMMERCIAL_CONTRACT_VERSION,
  };
}
