import "server-only";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { listBusinessIntelligenceRows, type IntelligencePeriod, type IntelligenceRow, type IntelligenceCashRow, type IntelligenceCustomerRow } from "@/backend/repos/business-intelligence-repo";
export type { IntelligencePeriod } from "@/backend/repos/business-intelligence-repo";

function dateKey(date: Date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date); }
function range(period: IntelligencePeriod) {
  const now = new Date();
  const end = new Date(`${dateKey(now)}T12:00:00`);
  const start = new Date(end);
  if (period === "today") start.setDate(start.getDate());
  else if (period === "7d") start.setDate(start.getDate() - 6);
  else if (period === "14d") start.setDate(start.getDate() - 13);
  else if (period === "30d") start.setDate(start.getDate() - 29);
  else if (period === "month") start.setDate(1);
  else if (period === "previous_month") { start.setMonth(start.getMonth() - 1, 1); end.setDate(0); }
  else { start.setMonth(start.getMonth() - 2, 1); }
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const previousEnd = new Date(start); previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd); previousStart.setDate(previousStart.getDate() - days + 1);
  return { start: dateKey(start), end: dateKey(end), previousStart: dateKey(previousStart), previousEnd: dateKey(previousEnd), label: period === "today" ? "Hoje" : period === "7d" ? "Últimos 7 dias" : period === "14d" ? "Últimos 14 dias" : period === "30d" ? "Últimos 30 dias" : period === "month" ? "Este mês" : period === "previous_month" ? "Mês anterior" : "Últimos 3 meses" };
}
function one<T>(value: T | T[] | null | undefined) { return Array.isArray(value) ? value[0] : value; }
function money(value: number) { return Math.round(value * 100) / 100; }
function summarize(rows: { attendances: IntelligenceRow[]; cash: IntelligenceCashRow[]; customers: IntelligenceCustomerRow[] }, periodStart: string, periodEnd: string) {
  const service = new Map<string, { count: number; revenue: number }>();
  const employee = new Map<string, { count: number; minutes: number[] }>();
  const vehicle = new Map<string, { count: number; revenue: number }>();
  const weekday = Array.from({ length: 7 }, (_, day) => ({ label: ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][day], count: 0 }));
  const hour = Array.from({ length: 24 }, (_, value) => ({ label: `${String(value).padStart(2, "0")}h`, count: 0 }));
  const heatmap = Array.from({ length: 7 }, (_, day) => Array.from({ length: 24 }, (_, value) => ({ day, hour: value, count: 0 })));
  const payments = new Map<string, { count: number; amount: number }>();
  const income = new Map<string, number>(); const expense = new Map<string, number>();
  for (const row of rows.attendances) {
    const serviceName = one(row.services)?.name ?? "Serviço não identificado"; const current = service.get(serviceName) ?? { count: 0, revenue: 0 }; service.set(serviceName, { count: current.count + 1, revenue: current.revenue + Number(row.final_price ?? 0) });
    const vehicleType = one(row.vehicles)?.vehicle_type ?? "Não informado"; const vehicleCurrent = vehicle.get(vehicleType) ?? { count: 0, revenue: 0 }; vehicle.set(vehicleType, { count: vehicleCurrent.count + 1, revenue: vehicleCurrent.revenue + Number(row.final_price ?? 0) });
    if (row.employee_id) { const item = employee.get(row.employee_id) ?? { count: 0, minutes: [] }; if (row.started_at && row.ready_at) item.minutes.push(Math.max(0, (new Date(row.ready_at).getTime() - new Date(row.started_at).getTime()) / 60000)); item.count++; employee.set(row.employee_id, item); }
    const date = new Date(row.created_at); weekday[date.getDay()].count++; hour[date.getHours()].count++; heatmap[date.getDay()][date.getHours()].count++;
  }
  for (const row of rows.cash) { const key = row.payment_method ?? "Não informado"; const p = payments.get(key) ?? { count: 0, amount: 0 }; payments.set(key, { count: p.count + 1, amount: p.amount + Number(row.amount ?? 0) }); const category = row.description.split(" • ")[0] || "Sem categoria"; const target = row.kind === "income" ? income : expense; target.set(category, (target.get(category) ?? 0) + Number(row.amount ?? 0)); }
  const totalIncome = rows.cash.filter((row) => row.kind === "income").reduce((sum, row) => sum + Number(row.amount ?? 0), 0); const totalExpense = rows.cash.filter((row) => row.kind === "expense").reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const customerVisits = new Map<string, number>(); for (const row of rows.attendances) if (row.customer_id) customerVisits.set(row.customer_id, (customerVisits.get(row.customer_id) ?? 0) + 1);
  const customers = { total: rows.customers.length, active: customerVisits.size, recurrent: [...customerVisits.values()].filter((count) => count > 1).length, newInPeriod: rows.customers.filter((customer) => customer.created_at >= `${periodStart}T00:00:00.000Z` && customer.created_at <= `${periodEnd}T23:59:59.999Z`).length };
  return { metrics: { income: money(totalIncome), expenses: money(totalExpense), result: money(totalIncome - totalExpense), attendances: rows.attendances.length, ticket: rows.attendances.length ? money(rows.attendances.reduce((sum, row) => sum + Number(row.final_price ?? 0), 0) / rows.attendances.length) : 0 }, customers, services: [...service.entries()].map(([label, value]) => ({ label, ...value, average: value.count ? money(value.revenue / value.count) : 0 })).sort((a, b) => b.revenue - a.revenue), vehicles: [...vehicle.entries()].map(([label, value]) => ({ label, ...value })).sort((a, b) => b.revenue - a.revenue), employees: [...employee.entries()].map(([label, value]) => ({ label, count: value.count, averageMinutes: value.minutes.length ? money(value.minutes.reduce((sum, item) => sum + item, 0) / value.minutes.length) : null })).sort((a, b) => b.count - a.count), weekday, hour, heatmap, payments: [...payments.entries()].map(([label, value]) => ({ label, ...value })).sort((a, b) => b.amount - a.amount), income: [...income.entries()].map(([label, amount]) => ({ label, amount: money(amount) })).sort((a, b) => b.amount - a.amount), expense: [...expense.entries()].map(([label, amount]) => ({ label, amount: money(amount) })).sort((a, b) => b.amount - a.amount) };
}

export async function getBusinessIntelligenceUseCase(period: IntelligencePeriod = "30d") {
  const context = await requireOwnerOrManager(); const selected = range(period); const [current, previous] = await Promise.all([listBusinessIntelligenceRows(context.tenantId, selected.start, selected.end), listBusinessIntelligenceRows(context.tenantId, selected.previousStart, selected.previousEnd)]); const currentSummary = summarize(current, selected.start, selected.end); const previousSummary = summarize(previous, selected.previousStart, selected.previousEnd); const percent = (now: number, before: number) => before ? money(((now - before) / before) * 100) : null;
  const insights = currentSummary.metrics.attendances === 0 && currentSummary.metrics.income === 0 ? [] : [currentSummary.metrics.attendances ? `${currentSummary.metrics.attendances} atendimentos registrados em ${selected.label}.` : null, currentSummary.services[0] ? `${currentSummary.services[0].label} é o serviço mais frequente no período.` : null, currentSummary.metrics.income && previousSummary.metrics.income ? `A receita variou ${percent(currentSummary.metrics.income, previousSummary.metrics.income)}% em relação ao período anterior.` : null].filter((item): item is string => Boolean(item));
  const forecast = currentSummary.metrics.attendances >= 5 && previousSummary.metrics.attendances >= 5 ? { available: true, projectedIncome: currentSummary.metrics.income, projectedAttendances: currentSummary.metrics.attendances, basis: "projeção simples pela repetição do período selecionado" } : { available: false, projectedIncome: null, projectedAttendances: null, basis: "histórico insuficiente" };
  const recommendations = currentSummary.services.length ? [`Priorize ${currentSummary.services[0].label}, que lidera a receita no período.`, currentSummary.metrics.ticket ? `O ticket médio atual é ${money(currentSummary.metrics.ticket)}; compare-o ao período anterior antes de alterar preços.` : "Registre atendimentos com preço para formar o ticket médio."] : ["Registre atendimentos e lançamentos para liberar recomendações baseadas no negócio."];
  return { period: selected, current: currentSummary, previous: previousSummary, comparisons: { income: percent(currentSummary.metrics.income, previousSummary.metrics.income), expenses: percent(currentSummary.metrics.expenses, previousSummary.metrics.expenses), attendances: percent(currentSummary.metrics.attendances, previousSummary.metrics.attendances), ticket: percent(currentSummary.metrics.ticket, previousSummary.metrics.ticket) }, insights, recommendations, forecast, sufficient: currentSummary.metrics.attendances >= 5 };
}
