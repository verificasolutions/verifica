export type TenantGrowthPhaseDefinition = {
  key: string;
  title: string;
  description: string;
  steps: Array<{
    key: string;
    title: string;
    description: string;
    prompt: string;
  }>;
};

export const TENANT_GROWTH_ROADMAP: TenantGrowthPhaseDefinition[] = [
  {
    key: "identity",
    title: "Identidade e posicionamento",
    description: "Defina com clareza quem a empresa é, o que entrega e como quer ser percebida.",
    steps: [
      {
        key: "identity-brand",
        title: "Marca e nome comercial alinhados",
        description: "Confirme nome, apresentação e proposta principal da empresa.",
        prompt: "Descreva em uma frase como o cliente reconhece sua marca hoje.",
      },
      {
        key: "identity-offer",
        title: "Proposta principal definida",
        description: "Explique o serviço principal que move a operação.",
        prompt: "Qual é o serviço carro-chefe e por que ele faz o cliente voltar?",
      },
      {
        key: "identity-audience",
        title: "Público ideal mapeado",
        description: "Escolha o tipo de cliente que mais vale a pena atrair.",
        prompt: "Quem é seu cliente ideal e qual problema ele quer resolver com você?",
      },
    ],
  },
  {
    key: "offer",
    title: "Oferta e precificação",
    description: "Estruture serviços, tempos, preços e diferenciais comerciais.",
    steps: [
      {
        key: "offer-catalog",
        title: "Catálogo principal organizado",
        description: "Tenha os serviços principais claros e prontos para venda.",
        prompt: "Liste os serviços principais que já estão validados na sua operação.",
      },
      {
        key: "offer-pricing",
        title: "Preços e tempos revisados",
        description: "Garanta que valor e execução estejam coerentes.",
        prompt: "Explique como você definiu preço, tempo e margem dos serviços principais.",
      },
      {
        key: "offer-upsell",
        title: "Complementos e upgrades pensados",
        description: "Crie oportunidades de aumentar o ticket médio.",
        prompt: "Quais extras, combos ou complementos podem ser oferecidos no atendimento?",
      },
    ],
  },
  {
    key: "operation",
    title: "Operação e rotina",
    description: "Transforme o dia a dia em um fluxo previsível e replicável.",
    steps: [
      {
        key: "operation-flow",
        title: "Fluxo de trabalho ajustado",
        description: "Boxes ou etapas precisam refletir a operação real.",
        prompt: "Descreva como o cliente ou serviço percorre sua operação do início ao fim.",
      },
      {
        key: "operation-team",
        title: "Equipe e responsabilidades definidas",
        description: "Cada pessoa precisa saber o que faz e quando faz.",
        prompt: "Quem cuida de atendimento, execução, conferência e entrega hoje?",
      },
      {
        key: "operation-quality",
        title: "Padrão de qualidade documentado",
        description: "Defina o que significa serviço bem executado.",
        prompt: "Quais checkpoints você usa para garantir que a entrega saiu no padrão certo?",
      },
    ],
  },
  {
    key: "financial",
    title: "Financeiro e metas",
    description: "Saiba quanto entra, quanto sai e o que precisa melhorar para crescer.",
    steps: [
      {
        key: "financial-metrics",
        title: "Indicadores financeiros acompanhados",
        description: "Acompanhe faturamento, ticket médio e recorrência.",
        prompt: "Quais números você precisa olhar toda semana para saber se o mês está saudável?",
      },
      {
        key: "financial-costs",
        title: "Custos operacionais revisados",
        description: "Entenda o que pesa mais no caixa.",
        prompt: "Quais são hoje os principais custos fixos e variáveis do negócio?",
      },
      {
        key: "financial-goals",
        title: "Meta mensal definida",
        description: "Tenha um alvo real de vendas e produção.",
        prompt: "Qual meta mensal você quer atingir e como ela se divide por semana?",
      },
    ],
  },
  {
    key: "marketing",
    title: "Marketing e presença digital",
    description: "Faça o mercado enxergar o valor da empresa de forma recorrente.",
    steps: [
      {
        key: "marketing-site",
        title: "Landing pública organizada",
        description: "Perfil público com serviços, contato e imagem profissional.",
        prompt: "O que não pode faltar na sua página pública para gerar confiança imediata?",
      },
      {
        key: "marketing-social",
        title: "Conteúdo recorrente planejado",
        description: "Use fotos e provas reais da operação para vender.",
        prompt: "Quais tipos de postagem você quer publicar toda semana?",
      },
      {
        key: "marketing-reputation",
        title: "Avaliações e prova social em uso",
        description: "Clientes satisfeitos precisam aparecer.",
        prompt: "Como você pretende pedir, organizar e expor avaliações positivas?",
      },
    ],
  },
  {
    key: "expansion",
    title: "Crescimento e expansão",
    description: "Planeje o próximo salto sem perder o controle da operação atual.",
    steps: [
      {
        key: "expansion-retention",
        title: "Estratégia de retorno e fidelização",
        description: "Defina como o cliente volta e compra de novo.",
        prompt: "Que ação simples você consegue repetir para fazer o cliente retornar mais vezes?",
      },
      {
        key: "expansion-capacity",
        title: "Capacidade de produção mapeada",
        description: "Saiba o limite da estrutura antes de vender mais.",
        prompt: "Hoje, quantos atendimentos ou serviços sua operação sustenta com qualidade?",
      },
      {
        key: "expansion-next-step",
        title: "Próximo passo do negócio definido",
        description: "Escolha a próxima alavanca de expansão.",
        prompt: "Seu próximo avanço será equipe, marketing, estrutura, ticket médio ou nova unidade? Explique.",
      },
    ],
  },
];

export const TENANT_GROWTH_STEP_KEYS = new Set(
  TENANT_GROWTH_ROADMAP.flatMap((phase) => phase.steps.map((step) => step.key)),
);

