export const tenant = {
  greeting: "Bom dia, João",
  washName: "Lava Rápido Central",
  cashStatus: "Aberto",
  cashLabel: "Caixa: Aberto",
  cashOpenAt: "08:12",
  cashToday: "R$ 1.240",
};

export const dashboardStats = [
  { label: "Lavagens hoje", value: "18", note: "+12% que ontem", tone: "cyan" },
  { label: "Faturamento", value: "R$ 1.240", note: "Caixa em andamento", tone: "mint" },
  { label: "Na fila", value: "4", note: "3 em lavagem", tone: "amber" },
  { label: "Prontos", value: "2", note: "1 aguardando retirada", tone: "green" },
] as const;

export const queueTabs = ["Todos", "Aguardando", "Em lavagem", "Finalização", "Pronto"] as const;

export const queueItems = [
  {
    id: "atd-001",
    vehicle: "Honda Civic Preto",
    plate: "ABC-1234",
    customer: "João",
    service: "Lavagem completa",
    eta: "42 min",
    washer: "Carlos",
    status: "Aguardando",
    statusTone: "amber",
  },
  {
    id: "atd-002",
    vehicle: "Toyota Corolla Prata",
    plate: "XYZ-9876",
    customer: "Maria",
    service: "Lavagem simples",
    eta: "18 min",
    washer: "Rafael",
    status: "Em lavagem",
    statusTone: "cyan",
  },
  {
    id: "atd-003",
    vehicle: "Hilux Branca",
    plate: "HIL-2026",
    customer: "Pedro",
    service: "Higienização interna",
    eta: "8 min",
    washer: "Carlos",
    status: "Pronto",
    statusTone: "green",
  },
] as const;

export const appointments = [
  { time: "09:00", vehicle: "Civic", customer: "João" },
  { time: "10:30", vehicle: "Corolla", customer: "Maria" },
  { time: "14:00", vehicle: "Hilux", customer: "Pedro" },
] as const;

export const cashEntries = [
  { label: "Dinheiro", value: "R$ 320" },
  { label: "Pix", value: "R$ 540" },
  { label: "Cartão", value: "R$ 680" },
  { label: "Pendente", value: "R$ 120" },
  { label: "Despesas", value: "R$ 80" },
  { label: "Total bruto", value: "R$ 1.660" },
  { label: "Total líquido", value: "R$ 1.580" },
] as const;

export const dayWashes = [
  { vehicle: "Civic", amount: "R$ 80", method: "Pix" },
  { vehicle: "Gol", amount: "R$ 50", method: "Dinheiro" },
  { vehicle: "Hilux", amount: "R$ 120", method: "Cartão" },
] as const;

export const employees = [
  {
    name: "Carlos",
    presence: "Presente",
    production: "6 lavagens hoje",
    payment: "Comissão: R$ 90",
  },
  {
    name: "Rafael",
    presence: "Presente",
    production: "4 lavagens hoje",
    payment: "Diária: R$ 80",
  },
] as const;

export const services = [
  { name: "Lavagem simples", price: "R$ 50", duration: "30 min", state: "Ativo" },
  { name: "Completa", price: "R$ 90", duration: "60 min", state: "Ativo" },
] as const;

export const customers = [
  {
    name: "João Silva",
    vehicle: "Civic Preto - ABC-1234",
    lastWash: "Última lavagem: 12/05",
  },
  {
    name: "Maria",
    vehicle: "Corolla Prata - XYZ-9876",
    lastWash: "Última lavagem: hoje",
  },
] as const;

export const reportCards = [
  { label: "Lavagens", value: "18" },
  { label: "Faturamento", value: "R$ 1.240" },
  { label: "Ticket médio", value: "R$ 68,88" },
  { label: "Mais vendido", value: "Simples" },
] as const;

export const operatorStats = [
  { label: "Minha fila", value: "2" },
  { label: "Em andamento", value: "1" },
  { label: "Prontos", value: "1" },
] as const;

export const operatorHistory = [
  { vehicle: "Gol", service: "Simples", finishedAt: "Finalizada 09:30" },
  { vehicle: "Civic", service: "Completa", finishedAt: "Finalizada 11:10" },
] as const;

export const trackerSteps = ["Recebido", "Na fila", "Em lavagem", "Finalização", "Pronto"] as const;
