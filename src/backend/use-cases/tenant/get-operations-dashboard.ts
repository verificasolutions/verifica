import "server-only";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { listAppointmentsForMonthByTenant, listScheduledAppointmentsByTenant } from "@/backend/repos/appointments-repo";
import { listQueueForTodayByTenant } from "@/backend/repos/attendances-operations-repo";
import { getOpenCashSession, listCashEntriesForCurrentMonth, listCashEntriesForOpenDay } from "@/backend/repos/cash-repo";
import {
  getCustomerWorkspaceByTenant,
  listCustomersWithLastAttendanceByTenant,
  listRecentCustomersByTenant,
} from "@/backend/repos/customers-repo";
import { listEmployeesByTenant } from "@/backend/repos/employees-repo";
import { listActiveEmployeeSessionsByTenant, listEmployeeWorkHistoryByEmployee } from "@/backend/repos/employee-work-sessions-repo";
import { listOperationBoxesByTenant } from "@/backend/repos/operation-boxes-repo";
import { listActiveServicesByTenant } from "@/backend/repos/services-repo";
import { getTenantSettings } from "@/backend/repos/tenant-settings-repo";
import { listVehicleCatalog } from "@/backend/repos/vehicle-catalog-repo";

export async function getOperationsDashboardUseCase(options?: {
  customerSearch?: string | null;
  selectedCustomerId?: string | null;
  selectedServiceId?: string | null;
  selectedEmployeeId?: string | null;
  appointmentMonth?: string | null;
}) {
  const context = await requireOwnerOrManager();
  const appointmentMonthValue = (options?.appointmentMonth ?? "").trim();
  const appointmentMonthMatch = /^(\d{4})-(\d{2})$/.exec(appointmentMonthValue);
  const referenceDate = new Date();
  const appointmentCalendarYear = appointmentMonthMatch ? Number(appointmentMonthMatch[1]) : referenceDate.getFullYear();
  const appointmentCalendarMonth = appointmentMonthMatch ? Number(appointmentMonthMatch[2]) : referenceDate.getMonth() + 1;

  const [services, customers, customersWithHistory, queue, employees, appointments, monthAppointments, cashSession, cashEntries, monthlyCashEntries, settings, operationBoxes, customerWorkspace, vehicleCatalog, activeEmployeeSessions, selectedEmployeeHistory] =
    await Promise.all([
      listActiveServicesByTenant(context.tenantId),
      listRecentCustomersByTenant(context.tenantId),
      listCustomersWithLastAttendanceByTenant(context.tenantId, options?.customerSearch),
      listQueueForTodayByTenant(context.tenantId),
      listEmployeesByTenant(context.tenantId),
      listScheduledAppointmentsByTenant(context.tenantId),
      listAppointmentsForMonthByTenant(context.tenantId, appointmentCalendarYear, appointmentCalendarMonth),
      getOpenCashSession(context.tenantId),
      listCashEntriesForOpenDay(context.tenantId),
      listCashEntriesForCurrentMonth(context.tenantId),
      getTenantSettings(context.tenantId),
      listOperationBoxesByTenant(context.tenantId),
      options?.selectedCustomerId ? getCustomerWorkspaceByTenant(context.tenantId, options.selectedCustomerId) : Promise.resolve(null),
      listVehicleCatalog(),
      listActiveEmployeeSessionsByTenant(context.tenantId),
      options?.selectedEmployeeId ? listEmployeeWorkHistoryByEmployee(context.tenantId, options.selectedEmployeeId) : Promise.resolve([]),
    ]);

  const cashTotals = cashEntries.reduce(
    (acc, item) => {
      if (item.kind === "expense") {
        acc.expenses += item.amount;
      } else {
        acc.income += item.amount;
        if (item.payment_method === "cash") acc.cash += item.amount;
        if (item.payment_method === "pix") acc.pix += item.amount;
        if (item.payment_method === "card") acc.card += item.amount;
        if (item.payment_method === "pending") acc.pending += item.amount;
      }
      return acc;
    },
    { cash: 0, pix: 0, card: 0, pending: 0, income: 0, expenses: 0 },
  );

  const cashExpense = cashEntries
    .filter((item) => item.kind === "expense" && (item.payment_method === "cash" || item.payment_method === null))
    .reduce((sum, item) => sum + item.amount, 0);
  const openingBalance = Number(cashSession?.opening_balance ?? 0);
  const currentBalance = openingBalance + cashTotals.cash - cashExpense;
  const operationalBalance = openingBalance + cashTotals.income - cashTotals.expenses;
  const dailyPayoutEntries = cashEntries.filter((item) => item.kind === "expense" && item.description.startsWith("DIARIA:"));
  const dailyPayouts = dailyPayoutEntries.map((entry) => {
    const [, employeeId, employeeName] = entry.description.split(":");
    const employee = employees.find((item) => item.id === employeeId);

    return {
      id: entry.id,
      tenant_id: entry.tenant_id,
      employee_id: employeeId,
      payout_date: entry.created_at,
      amount: entry.amount,
      status: entry.payment_method === "cash" ? ("paid" as const) : ("pending" as const),
      paid_at: entry.payment_method === "cash" ? entry.created_at : null,
      paid_cash_entry_id: entry.payment_method === "cash" ? entry.id : null,
      employees: {
        name: employee?.name ?? employeeName ?? "Funcionário",
        role_label: employee?.role_label ?? "Equipe",
      },
    };
  });
  const dailyPayoutPending = dailyPayouts.filter((item) => item.status === "pending").reduce((sum, item) => sum + item.amount, 0);
  const dailyPayoutPaid = dailyPayouts.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.amount, 0);
  const activeSessionByEmployeeId = new Map(activeEmployeeSessions.map((session) => [session.employee_id, session]));

  return {
    tenant: context.tenant,
    services,
    selectedService: options?.selectedServiceId ? services.find((item) => item.id === options.selectedServiceId) ?? null : null,
    customers,
    customersWithHistory,
    customerWorkspace,
    queue,
    queueActive: queue.filter((item) => item.status === "waiting" || item.status === "washing" || item.status === "finishing"),
    queueWaiting: queue.filter((item) => item.status === "waiting"),
    queueReady: queue.filter((item) => item.status === "ready"),
    employees: employees.map((employee) => ({
      ...employee,
      current_session_logged_in_at: activeSessionByEmployeeId.get(employee.id)?.logged_in_at ?? null,
    })),
    employeeHistory: selectedEmployeeHistory,
    appointments,
    monthAppointments,
    appointmentCalendar: {
      year: appointmentCalendarYear,
      month: appointmentCalendarMonth,
      key: `${appointmentCalendarYear}-${String(appointmentCalendarMonth).padStart(2, "0")}`,
      scheduledCount: monthAppointments.filter((item) => item.status === "scheduled").length,
    },
    settings,
    operationBoxes,
    vehicleCatalog,
    cash: {
      session: cashSession,
      entries: cashEntries,
      dailyPayouts,
      totals: {
        ...cashTotals,
        gross: cashTotals.income,
        net: cashTotals.income - cashTotals.expenses,
        currentBalance,
        operationalBalance,
        openingBalance,
        dailyPayoutPending,
        dailyPayoutPaid,
      },
      monthEntries: monthlyCashEntries,
    },
  };
}
