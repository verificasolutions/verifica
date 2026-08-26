type CashEntry = { kind: "income" | "expense"; description: string; amount: number; payment_method: string | null };
type Attendance = { final_price: number; service_label?: string | null; services?: { name: string } | { name: string }[] | null; employees?: { name: string } | { name: string }[] | null; vehicles?: { vehicle_type?: string | null } | { vehicle_type?: string | null }[] | null };

function related<T>(value: T | T[] | null | undefined) { return Array.isArray(value) ? value[0] : value; }
function labelFromDescription(description: string) { return description.split(" • ")[0]?.trim() || "Sem descrição"; }
function groupBy(items: CashEntry[], kind: CashEntry["kind"]) {
  const groups = new Map<string, number>();
  items.filter((item) => item.kind === kind).forEach((item) => groups.set(labelFromDescription(item.description), (groups.get(labelFromDescription(item.description)) ?? 0) + item.amount));
  return [...groups.entries()].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);
}

export function buildBusinessIntelligence(input: { cashEntries: CashEntry[]; attendances: Attendance[]; periodLabel: string }) {
  const income = input.cashEntries.filter((entry) => entry.kind === "income").reduce((sum, entry) => sum + entry.amount, 0);
  const expenses = input.cashEntries.filter((entry) => entry.kind === "expense").reduce((sum, entry) => sum + entry.amount, 0);
  const attendanceCount = input.attendances.length;
  const ticket = attendanceCount ? input.attendances.reduce((sum, item) => sum + item.final_price, 0) / attendanceCount : 0;
  const services = new Map<string, { count: number; revenue: number }>();
  input.attendances.forEach((item) => { const name = related(item.services)?.name ?? item.service_label ?? "Serviço não identificado"; const current = services.get(name) ?? { count: 0, revenue: 0 }; services.set(name, { count: current.count + 1, revenue: current.revenue + item.final_price }); });
  const vehicles = new Map<string, number>();
  input.attendances.forEach((item) => { const type = related(item.vehicles)?.vehicle_type ?? "Não informado"; vehicles.set(type, (vehicles.get(type) ?? 0) + 1); });
  const topIncome = groupBy(input.cashEntries, "income")[0];
  const topExpense = groupBy(input.cashEntries, "expense")[0];
  return {
    periodLabel: input.periodLabel,
    metrics: { income, expenses, result: income - expenses, attendanceCount, ticket },
    incomeGroups: groupBy(input.cashEntries, "income"),
    expenseGroups: groupBy(input.cashEntries, "expense"),
    serviceGroups: [...services.entries()].map(([label, value]) => ({ label, ...value, average: value.count ? value.revenue / value.count : 0 })).sort((a, b) => b.revenue - a.revenue),
    vehicleGroups: [...vehicles.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    insights: [
      attendanceCount > 0 ? `Foram registrados ${attendanceCount} atendimentos no período ${input.periodLabel}.` : null,
      topIncome ? `A principal origem registrada foi ${topIncome.label}, com ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(topIncome.amount)}.` : null,
      topExpense ? `A maior categoria de saída registrada foi ${topExpense.label}, com ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(topExpense.amount)}.` : null,
    ].filter((value): value is string => Boolean(value)),
  };
}
