import "server-only";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { listAttendancesForTodayByTenant } from "@/backend/repos/attendances-repo";
import { listAppointmentsForTodayWithStatusesByTenant } from "@/backend/repos/appointments-repo";
import { getOpenCashSessionByTenant } from "@/backend/repos/cash-sessions-repo";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function firstName(value: string | null | undefined, email: string | null | undefined) {
  if (value?.trim()) {
    return value.trim().split(" ")[0];
  }
  return email?.split("@")[0] ?? "Operador";
}

export async function getOwnerDashboardUseCase() {
  const context = await requireOwnerOrManager();
  const [{ today, active, todayWithServices }, openCashSession, todayAppointments] = await Promise.all([
    listAttendancesForTodayByTenant(context.tenantId),
    getOpenCashSessionByTenant(context.tenantId),
    listAppointmentsForTodayWithStatusesByTenant(context.tenantId),
  ]);

  const totalRevenue = today.reduce((sum, item) => sum + Number(item.final_price ?? 0), 0);
  const waiting = active.filter((item) => item.status === "waiting").length;
  const washing = active.filter((item) => item.status === "washing").length;
  const finishing = active.filter((item) => item.status === "finishing").length;
  const ready = active.filter((item) => item.status === "ready").length;
  const completedAttendances = (todayWithServices ?? []).filter((item) => item.status === "ready" || item.status === "delivered");
  const serviceSummaryMap = new Map<string, number>();

  for (const item of completedAttendances) {
    const serviceName =
      Array.isArray((item as { services?: { name?: string }[] | { name?: string } | null }).services)
        ? ((item as { services?: { name?: string }[] }).services?.[0]?.name ?? "Serviço sem nome")
        : ((item as { services?: { name?: string } | null }).services?.name ?? "Serviço sem nome");
    serviceSummaryMap.set(serviceName, (serviceSummaryMap.get(serviceName) ?? 0) + 1);
  }

  const appointmentsCompleted = todayAppointments.filter((item) => item.status === "completed").length;
  const appointmentsCanceled = todayAppointments.filter((item) => item.status === "canceled").length;

  return {
    actor: {
      firstName: firstName(context.profile?.full_name, context.email),
      role: context.role,
    },
    tenant: context.tenant,
    stats: {
      totalToday: today.length,
      revenueToday: formatCurrency(totalRevenue),
      waiting,
      washing,
      finishing,
      ready,
      cashStatus: openCashSession ? "Aberto" : "Fechado",
      servicesCompletedToday: completedAttendances.length,
      appointmentsCompletedToday: appointmentsCompleted,
      appointmentsCanceledToday: appointmentsCanceled,
      employeesPresent: 0,
      servicesByType: Array.from(serviceSummaryMap.entries()).map(([name, count]) => ({ name, count })),
    },
  };
}
