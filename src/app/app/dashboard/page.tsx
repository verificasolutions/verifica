import type { ReactNode } from "react";
import Link from "next/link";
import { CashExpenseForm } from "@/components/cash-expense-form";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { CustomerRegistrationForm } from "@/components/customer-registration-form";
import { EmployeeAddressFields } from "@/components/employee-address-fields";
import { CpfInput } from "@/components/cpf-input";
import { DeliveryChoiceSubmitButton } from "@/components/delivery-choice-submit-button";
import { FlashNotice } from "@/components/flash-notice";
import { InventorySection } from "@/components/inventory-section";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { AutoScrollStrip } from "@/components/auto-scroll-strip";
import { CurrencyInput, DocumentInput, DurationInput, PhoneInput } from "@/components/masked-inputs";
import { NewAttendanceFormClient } from "@/components/new-attendance-form";
import { RealtimeRefreshBridge } from "@/components/realtime-refresh-bridge";
import { RotatingCardViewport } from "@/components/rotating-card-viewport";
import { ServiceQuoteForm } from "@/components/service-quote-form";
import { TenantMessageSettings } from "@/components/tenant-message-settings";
import { TenantGrowthSection } from "@/components/tenant-growth-section";
import { TenantSidebar } from "@/components/tenant-sidebar";
import { VehicleIdentityFields } from "@/components/vehicle-identity-fields";
import { getSaoPauloCalendarDate } from "@/backend/shared/date-range";
import { formatOperationBoxDurationLabel, formatOperationBoxDurationValue, operationBoxTimeUnitOptions } from "@/backend/shared/operation-box-duration";
import { listSelectableDestinationBoxes, resolveNextBoxForFlow } from "@/backend/shared/operation-box-flow";
import { resolveAttendancePrimaryServiceName, resolveAttendanceServiceDisplayName } from "@/backend/shared/attendance-service-summary";
import { formatVehicleDisplayLabel, getVehicleTypeOptions, resolveServicePriceByVehicleType } from "@/backend/shared/vehicle-catalog";
import { getOperationsDashboardUseCase } from "@/backend/use-cases/tenant/get-operations-dashboard";
import { getOwnerDashboardUseCase } from "@/backend/use-cases/tenant/get-owner-dashboard";
import { getReportsUseCase } from "@/backend/use-cases/tenant/get-reports";
import { getInventoryWorkspaceUseCase } from "@/backend/use-cases/tenant/get-inventory-workspace";
import { getTenantSupportUseCase } from "@/backend/use-cases/tenant/get-tenant-support";
import { getTenantGrowthWorkspaceUseCase } from "@/backend/use-cases/tenant/get-tenant-growth-workspace";
import { getSocialStudioUseCase } from "@/backend/use-cases/tenant/get-social-studio";
import {
  approveServiceQuoteAction,
  cancelAppointmentAction,
  confirmAppointmentAction,
  closeCashSessionAction,
  createAppointmentAction,
  createAttendanceAction,
  createCashEntryAction,
  createCashExpenseAction,
  createCustomerAction,
  createEmployeeAction,
  createOperationBoxAction,
  createServiceQuoteAction,
  createServiceAction,
  createSupportTicketAction,
  disconnectInstagramAction,
  endShiftAction,
  generateSocialAssetAction,
  markDailyPayoutPaidAction,
  moveAttendanceToNextBoxAction,
  openCashSessionAction,
  publishSocialAssetToInstagramAction,
  registerAttendanceDeliveryAction,
  rescheduleAppointmentAction,
  saveEmployeeAction,
  saveOperationBoxesAction,
  saveTenantSettingsAction,
  setEmployeeStateAction,
  startInstagramConnectAction,
  toggleAttendanceServiceItemAction,
  toggleEmployeePresenceAction,
  updateServiceAction,
  updateSocialAssetStatusAction,
} from "./actions";

export const maxDuration = 300;

type TenantSection = "dashboard" | "caixa" | "inteligencia" | "clientes" | "estoque" | "crescendo" | "suporte" | "adm";
type DashboardDrawer = "agenda" | "agendar" | "agendamentos" | "resumo" | "fila" | "prontos" | "novo" | "etapa";
type CashDrawer = "entries" | "expenses" | "monthly";
type CashPeriod = "day" | "week" | "fortnight" | "month" | "year";
type AdmPanel = "reports" | "services" | "employees" | "settings" | "whatsapp" | "social";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function formatDate(value: string | null) {
  if (!value) return "Sem lavagem";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function formatDateInput(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTimeInput(value: string) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatStatus(status: string) {
  const map: Record<string, string> = {
    waiting: "Aguardando",
    washing: "Em lavagem",
    finishing: "Finalização",
    ready: "Pronto",
    delivered: "Entregue",
    canceled: "Cancelado",
    scheduled: "Agendado",
    confirmed: "Confirmado",
    completed: "Concluído",
  };

  return map[status] ?? status;
}

function formatSupportStatus(status: string) {
  const map: Record<string, string> = {
    open: "Aberto",
    in_progress: "Em andamento",
    resolved: "Resolvido",
  };

  return map[status] ?? status;
}

function formatPaymentMethod(paymentMethod: string | null) {
  const map: Record<string, string> = {
    cash: "Dinheiro",
    pix: "Pix",
    card: "Cartão",
    pending: "Pendente",
  };

  if (!paymentMethod) return "Sem método";
  return map[paymentMethod] ?? paymentMethod;
}

function formatCashChannel(entry: { payment_method: string | null; card_kind?: string | null }) {
  if (entry.payment_method === "card") {
    if (entry.card_kind === "credit") return "Cartão de crédito";
    if (entry.card_kind === "debit") return "Cartão de débito";
  }

  return formatPaymentMethod(entry.payment_method);
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function getCurrentMonthKey() {
  const now = getSaoPauloCalendarDate();
  return `${now.year}-${String(now.month).padStart(2, "0")}`;
}

function normalizeAppointmentMonth(value: string | null | undefined) {
  return /^\d{4}-\d{2}$/.test(value ?? "") ? String(value) : getCurrentMonthKey();
}

function shiftAppointmentMonth(value: string, amount: number) {
  const [yearPart, monthPart] = value.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatAppointmentMonthLabel(value: string) {
  const [yearPart, monthPart] = value.split("-");
  const monthNames = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  const monthIndex = Math.max(1, Math.min(12, Number(monthPart))) - 1;
  return `${monthNames[monthIndex]} de ${yearPart}`;
}

function formatDurationInput(value: number | null | undefined) {
  const minutes = Number(value ?? 0);

  if (!Number.isFinite(minutes) || minutes <= 0) return "0";
  if (minutes < 60) return String(minutes);

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}:${String(remainder).padStart(2, "0")}`;
}

function formatPaymentStatus(paymentMethod: string | null) {
  return paymentMethod === "pending" ? "Em aberto" : "Pago";
}

function serviceFormMinutesValue(service: NonNullable<Awaited<ReturnType<typeof getOperationsDashboardUseCase>>["selectedService"]>, tier: "passeio" | "medio" | "grande" | "bem_grande") {
  if (service.base_service_id) {
    if (tier === "medio") return Number(service.addon_minutes_medio ?? 0);
    if (tier === "grande") return Number(service.addon_minutes_grande ?? 0);
    if (tier === "bem_grande") return Number(service.addon_minutes_bem_grande ?? 0);
    return Number(service.addon_minutes_passeio ?? service.addon_minutes ?? 0);
  }

  if (tier === "medio") return Number(service.minutes_medio ?? service.average_minutes ?? 0);
  if (tier === "grande") return Number(service.minutes_grande ?? service.average_minutes ?? 0);
  if (tier === "bem_grande") return Number(service.minutes_bem_grande ?? service.average_minutes ?? 0);
  return Number(service.minutes_passeio ?? service.average_minutes ?? 0);
}

function serviceFormPriceValue(
  service: NonNullable<Awaited<ReturnType<typeof getOperationsDashboardUseCase>>["selectedService"]>,
  tier: "passeio" | "medio" | "grande" | "bem_grande",
  table: "particular" | "app" = "particular",
) {
  if (service.base_service_id) {
    if (table === "app") {
      if (tier === "medio") return Number(service.addon_price_app_medio ?? 0);
      if (tier === "grande") return Number(service.addon_price_app_grande ?? 0);
      if (tier === "bem_grande") return Number(service.addon_price_app_bem_grande ?? 0);
      return Number(service.addon_price_app_passeio ?? 0);
    }
    if (tier === "medio") return Number(service.addon_price_medio ?? 0);
    if (tier === "grande") return Number(service.addon_price_grande ?? 0);
    if (tier === "bem_grande") return Number(service.addon_price_bem_grande ?? 0);
    return Number(service.addon_price_passeio ?? 0);
  }

  if (table === "app") {
    if (tier === "medio") return Number(service.price_app_medio ?? service.price_medio ?? service.price ?? 0);
    if (tier === "grande") return Number(service.price_app_grande ?? service.price_grande ?? service.price ?? 0);
    if (tier === "bem_grande") return Number(service.price_app_bem_grande ?? service.price_bem_grande ?? service.price ?? 0);
    return Number(service.price_app_passeio ?? service.price_passeio ?? service.price ?? 0);
  }

  if (tier === "medio") return Number(service.price_medio ?? service.price ?? 0);
  if (tier === "grande") return Number(service.price_grande ?? service.price ?? 0);
  if (tier === "bem_grande") return Number(service.price_bem_grande ?? service.price ?? 0);
  return Number(service.price_passeio ?? service.price ?? 0);
}

function serviceTimeLabel(service: {
  minutes_passeio?: number | null;
  average_minutes?: number | null;
  time_unit?: "minutes" | "hours_minutes" | "days" | "weeks" | "months" | null;
}) {
  return formatOperationBoxDurationLabel(Number(service.minutes_passeio ?? service.average_minutes ?? 0), service.time_unit ?? "minutes");
}

function supportStatusTone(status: string) {
  if (status === "resolved") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
  if (status === "in_progress") return "border-sky-400/20 bg-sky-400/10 text-sky-100";
  return "border-amber-300/20 bg-amber-300/10 text-amber-100";
}

function formatCashEntryDescription(description: string) {
  if (description.startsWith("DIARIA:")) {
    const [, , name] = description.split(":");
    return `Diária ${name ?? "Funcionário"}`;
  }

  const [category, item, counterparty, note] = description.split(" • ");
  const knownCategories = new Set([
    "Serviço",
    "Adicional",
    "Extra",
    "Outra entrada",
    "Insumo",
    "Fornecedor",
    "Alimentação",
    "Transporte",
    "Outra saída",
  ]);

  if (knownCategories.has(category)) {
    return [category, item, counterparty, note].filter(Boolean).join(" • ");
  }

  return description;
}

function cashEntryCategoryTone(description: string, kind: "income" | "expense") {
  if (kind === "income") return "border-emerald-400/18 bg-emerald-400/10 text-emerald-100";
  if (description.includes("Fornecedor")) return "border-fuchsia-400/18 bg-fuchsia-400/10 text-fuchsia-100";
  if (description.includes("Insumo")) return "border-amber-300/18 bg-amber-300/10 text-amber-100";
  if (description.includes("Alimentação")) return "border-orange-300/18 bg-orange-300/10 text-orange-100";
  return "border-rose-400/18 bg-rose-400/10 text-rose-100";
}

function statusTone(status: string) {
  if (status === "waiting") {
    return "border-amber-300/20 bg-amber-300/10 text-amber-100";
  }

  if (status === "washing" || status === "finishing") {
    return "border-sky-300/20 bg-sky-300/10 text-sky-100";
  }

  if (status === "ready" || status === "delivered") {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
  }

  return "border-white/10 bg-white/6 text-white/72";
}

function queueCardTone(status: string, paymentMethod: string | null) {
  if (status === "washing" || status === "finishing") {
    return "border-sky-400 bg-[linear-gradient(135deg,rgba(56,189,248,0.14),rgba(15,23,42,0.9))] shadow-[0_0_0_1px_rgba(56,189,248,0.2)]";
  }

  if (status === "ready" || status === "delivered") {
    return "border-emerald-400 bg-[linear-gradient(135deg,rgba(52,211,153,0.14),rgba(15,23,42,0.9))] shadow-[0_0_0_1px_rgba(52,211,153,0.2)]";
  }

  if (status === "waiting" || paymentMethod === "pending") {
    return "border-amber-400 bg-[linear-gradient(135deg,rgba(250,204,21,0.14),rgba(15,23,42,0.9))] shadow-[0_0_0_1px_rgba(250,204,21,0.2)]";
  }

  return "border-white/10 bg-black/15";
}

function hrefFor(
  section: TenantSection,
  options?: {
    drawer?: DashboardDrawer | null;
    panel?: AdmPanel | null;
    cashDrawer?: CashDrawer | null;
    cashPeriod?: CashPeriod | null;
    customer?: string | null;
    customerForm?: string | null;
    quoteForm?: string | null;
    clientSearch?: string | null;
    employeeId?: string | null;
    employeeView?: "details" | "history" | null;
    service?: string | null;
    attendanceId?: string | null;
    deliveryAttendanceId?: string | null;
    cashIdentifierType?: "plate" | "whatsapp" | "customer_name" | null;
    cashIdentifierValue?: string | null;
    cashAmount?: string | null;
    cashDescription?: string | null;
    cashDelivery?: boolean;
    stageView?: string | null;
    appointmentsMonth?: string | null;
  },
) {
  const params = new URLSearchParams({ section });

  if (options?.drawer) params.set("drawer", options.drawer);
  if (options?.panel) params.set("panel", options.panel);
  if (options?.cashDrawer) params.set("cashDrawer", options.cashDrawer);
  if (options?.cashPeriod) params.set("cashPeriod", options.cashPeriod);
  if (options?.customer) params.set("customer", options.customer);
  if (options?.customerForm) params.set("customerForm", options.customerForm);
  if (options?.quoteForm) params.set("quoteForm", options.quoteForm);
  if (options?.clientSearch) params.set("clientSearch", options.clientSearch);
  if (options?.employeeId) params.set("employeeId", options.employeeId);
  if (options?.employeeView) params.set("employeeView", options.employeeView);
  if (options?.service) params.set("service", options.service);
  if (options?.attendanceId) params.set("attendanceId", options.attendanceId);
  if (options?.deliveryAttendanceId) params.set("deliveryAttendanceId", options.deliveryAttendanceId);
  if (options?.cashIdentifierType) params.set("cashIdentifierType", options.cashIdentifierType);
  if (options?.cashIdentifierValue) params.set("cashIdentifierValue", options.cashIdentifierValue);
  if (options?.cashAmount) params.set("cashAmount", options.cashAmount);
  if (options?.cashDescription) params.set("cashDescription", options.cashDescription);
  if (options?.cashDelivery) params.set("cashDelivery", "1");
  if (options?.stageView) params.set("stageView", options.stageView);
  if (options?.appointmentsMonth) params.set("appointmentsMonth", options.appointmentsMonth);

  return `/app/dashboard?${params.toString()}`;
}

function cashHrefForAttendance(
  attendance: Awaited<ReturnType<typeof getOperationsDashboardUseCase>>["queue"][number],
  options?: {
    markDelivery?: boolean;
    identifierType?: "plate" | "whatsapp" | "customer_name";
    identifierValue?: string;
    description?: string;
  },
) {
  return hrefFor("caixa", {
    service: resolveAttendanceServiceDisplayName(attendance),
    attendanceId: attendance.id,
    cashIdentifierType: options?.identifierType ?? "plate",
    cashIdentifierValue: options?.identifierValue ?? attendance.vehicles?.plate ?? "",
    cashAmount: String(attendance.final_price),
    cashDescription: options?.description ?? `${attendance.customers?.name ?? "Cliente"} • ${attendance.vehicles?.plate ?? "Sem placa"} • ${resolveAttendanceServiceDisplayName(attendance)}`,
    cashDelivery: options?.markDelivery ?? false,
  });
}

function attendanceActionsHref(attendanceId: string) {
  return hrefFor("dashboard", { attendanceId });
}

function getNextOperationBox(
  operationBoxes: Awaited<ReturnType<typeof getOperationsDashboardUseCase>>["operationBoxes"],
  attendance: Awaited<ReturnType<typeof getOperationsDashboardUseCase>>["queue"][number],
  queue: Awaited<ReturnType<typeof getOperationsDashboardUseCase>>["queue"],
) {
  return resolveNextBoxForFlow({
    boxes: operationBoxes,
    queue,
    currentBoxId: attendance.current_box_id,
    serviceName: resolveAttendancePrimaryServiceName(attendance),
  });
}

function getSelectableOperationBoxes(
  operationBoxes: Awaited<ReturnType<typeof getOperationsDashboardUseCase>>["operationBoxes"],
  attendance: Awaited<ReturnType<typeof getOperationsDashboardUseCase>>["queue"][number],
) {
  return listSelectableDestinationBoxes({
    boxes: operationBoxes,
    currentBoxId: attendance.current_box_id,
  });
}

function TopCard({
  href,
  title,
  value,
  note,
  tone = "default",
}: {
  href: string;
  title: string;
  value: string | number;
  note: string;
  tone?: "default" | "accent";
}) {
  return (
    <Link
      href={href}
      className={`rounded-[24px] border p-4 shadow-[0_12px_36px_rgba(0,0,0,0.24)] transition active:scale-[0.99] ${
        tone === "accent"
          ? "border-[var(--accent)] bg-[linear-gradient(135deg,rgba(0,245,212,0.18),rgba(56,189,248,0.08))]"
          : "border-white/10 bg-white/6"
      }`}
    >
      <p className="text-sm text-white/58">{title}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-white/46">{note}</p>
    </Link>
  );
}

function AppointmentsSummaryCard({
  monthKey,
  count,
}: {
  monthKey: string;
  count: number;
}) {
  return (
    <div className="rounded-[24px] border border-[var(--accent)] bg-[linear-gradient(135deg,rgba(0,245,212,0.18),rgba(56,189,248,0.08))] p-4 shadow-[0_12px_36px_rgba(0,0,0,0.24)]">
      <p className="text-sm text-white/58">Agendamentos</p>
      <p className="mt-3 text-2xl font-semibold text-white">{count}</p>
      <p className="mt-1 text-xs text-white/46">Agendados no mês</p>
      <div className="mt-4 grid gap-2">
        <Link
          href={hrefFor("dashboard", { drawer: "agendar", appointmentsMonth: monthKey })}
          className="flex min-h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/12 px-3 text-sm font-semibold text-white"
        >
          Agendar
        </Link>
        <Link
          href={hrefFor("dashboard", { drawer: "agendamentos", appointmentsMonth: monthKey })}
          className="flex min-h-10 items-center justify-center rounded-2xl border border-white/10 bg-black/18 px-3 text-sm font-semibold text-white/84"
        >
          Ver agendamentos
        </Link>
      </div>
    </div>
  );
}

function AutomotiveAgendaMenuCard({ monthKey }: { monthKey: string }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-white/58">Escolha se você quer abrir a agenda mensal ou criar um novo agendamento.</p>
      <div className="grid gap-3">
        <Link
          href={hrefFor("dashboard", { drawer: "agendamentos", appointmentsMonth: monthKey })}
          className="flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/6 px-4 text-sm font-semibold text-white/84"
        >
          Ver agendamentos
        </Link>
        <Link
          href={hrefFor("dashboard", { drawer: "agendar", appointmentsMonth: monthKey })}
          className="flex min-h-12 items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950"
        >
          Agendar
        </Link>
      </div>
    </div>
  );
}

function DailySummaryDrawer({
  dashboard,
  operations,
}: {
  dashboard: Awaited<ReturnType<typeof getOwnerDashboardUseCase>>;
  operations: Awaited<ReturnType<typeof getOperationsDashboardUseCase>>;
}) {
  const concludedItems = operations.queueReady ?? [];
  const servicesByTypeMap = new Map<string, number>();
  for (const item of concludedItems) {
    const serviceName = resolveAttendanceServiceDisplayName(item);
    servicesByTypeMap.set(serviceName, (servicesByTypeMap.get(serviceName) ?? 0) + 1);
  }
  const servicesByType = Array.from(servicesByTypeMap.entries()).map(([name, count]) => ({ name, count }));
  const employeesPresent = operations.employees.filter((employee) => employee.current_session_logged_in_at || employee.is_present).length;

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
        <p className="text-base font-semibold text-white">Resumo do dia</p>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-black/16 px-4 py-3">
            <span className="text-sm font-medium text-white/84">Total de serviços executados</span>
            <span className="text-sm font-semibold text-white">{concludedItems.length}</span>
          </div>
          <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-black/16 px-4 py-3">
            <span className="text-sm font-medium text-white/84">Agendamentos atendidos</span>
            <span className="text-sm font-semibold text-white">{dashboard.stats.appointmentsCompletedToday ?? 0}</span>
          </div>
          <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-black/16 px-4 py-3">
            <span className="text-sm font-medium text-white/84">Agendamentos cancelados</span>
            <span className="text-sm font-semibold text-white">{dashboard.stats.appointmentsCanceledToday ?? 0}</span>
          </div>
          <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-black/16 px-4 py-3">
            <span className="text-sm font-medium text-white/84">Funcionários presentes</span>
            <span className="text-sm font-semibold text-white">{employeesPresent}</span>
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
        <p className="text-base font-semibold text-white">Serviços executados no dia</p>
        <div className="mt-4 space-y-3">
          {servicesByType.length === 0 ? (
            <EmptyState text="Nenhum serviço concluído hoje ainda." />
          ) : (
            servicesByType.map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded-[18px] border border-white/10 bg-black/16 px-4 py-3">
                <span className="text-sm font-medium text-white/84">{item.name}</span>
                <span className="text-sm font-semibold text-white">{item.count} executados</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function vehicleAccentClass(color: string | null | undefined) {
  const normalized = normalizeText(color);

  if (normalized.includes("preto")) return "border-zinc-500 bg-[linear-gradient(135deg,rgba(39,39,42,0.92),rgba(9,9,11,0.98))]";
  if (normalized.includes("branco")) return "border-slate-300 bg-[linear-gradient(135deg,rgba(248,250,252,0.22),rgba(15,23,42,0.92))]";
  if (normalized.includes("prata") || normalized.includes("cinza")) return "border-slate-400 bg-[linear-gradient(135deg,rgba(148,163,184,0.2),rgba(15,23,42,0.94))]";
  if (normalized.includes("vermel")) return "border-rose-500 bg-[linear-gradient(135deg,rgba(244,63,94,0.22),rgba(15,23,42,0.94))]";
  if (normalized.includes("azul")) return "border-sky-500 bg-[linear-gradient(135deg,rgba(14,165,233,0.22),rgba(15,23,42,0.94))]";
  if (normalized.includes("verde")) return "border-emerald-500 bg-[linear-gradient(135deg,rgba(16,185,129,0.2),rgba(15,23,42,0.94))]";
  if (normalized.includes("amare")) return "border-amber-400 bg-[linear-gradient(135deg,rgba(250,204,21,0.22),rgba(15,23,42,0.94))]";

  return "border-white/12 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(15,23,42,0.94))]";
}

function mercosulPlate(value: string | null | undefined) {
  const plate = (value ?? "SEMPLACA").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (plate.length <= 3) return plate;
  return `${plate.slice(0, 3)}-${plate.slice(3, 7)}`;
}

function formatPhoneDisplay(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D+/g, "");
  if (!digits) return "Contato cadastrado";
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

function elapsedMinutes(startedAt: string | null | undefined, createdAt: string) {
  if (!startedAt) return 0;
  const base = new Date(startedAt).getTime();
  return Math.max(0, Math.round((Date.now() - base) / 60000));
}

function slaProgress(attendance: {
  estimated_minutes?: number | null;
  extra_minutes?: number | null;
  current_box_entered_at?: string | null;
  started_at?: string | null;
  created_at: string;
}, boxSlaMinutes?: number | null) {
  const serviceTarget = Number(attendance.estimated_minutes ?? 0) + Number(attendance.extra_minutes ?? 0);
  const boxTarget = Number(boxSlaMinutes ?? 0);
  const target = boxTarget > 0 ? boxTarget : serviceTarget > 0 ? serviceTarget : 0;
  const startedAt = boxTarget > 0 ? (attendance.current_box_entered_at ?? attendance.started_at ?? attendance.created_at) : attendance.started_at;
  const elapsed = elapsedMinutes(startedAt, attendance.created_at);
  const ratio = target > 0 ? Math.min(1, elapsed / target) : 0;
  const remaining = Math.max(0, target - elapsed);
  const started = target > 0 && Boolean(startedAt);
  return {
    started,
    target,
    elapsed,
    remaining,
    fillPercent: target > 0 ? Math.max(0, 100 - ratio * 100) : 100,
    overdue: target > 0 && started && elapsed >= target,
  };
}

function buildOperationGridModel(operations: Awaited<ReturnType<typeof getOperationsDashboardUseCase>>) {
  const boxes = [...(operations.operationBoxes ?? [])]
    .filter((box) => box.is_active && box.kind !== "entry")
    .sort((a, b) => a.sort_order - b.sort_order);
  const activeOperationItems = operations.queue.filter((item) =>
    item.status === "waiting" || item.status === "washing" || item.status === "finishing" || item.status === "ready",
  );

  const byBoxId = new Map<string, typeof operations.queue>();
  const unassignedFallback = activeOperationItems.filter((item) => !item.current_box_id);
  const fallback = {
    wash: unassignedFallback.filter((item) => item.status === "washing"),
    dry: unassignedFallback.filter((item) => item.status === "finishing"),
    finish: unassignedFallback.filter((item) => item.status === "finishing"),
    ready: unassignedFallback.filter((item) => item.status === "ready"),
  };

  for (const item of activeOperationItems) {
    if (!item.current_box_id) continue;
    const bucket = byBoxId.get(item.current_box_id) ?? [];
    bucket.push(item);
    byBoxId.set(item.current_box_id, bucket);
  }

  const usedFallbackIds = new Set<string>();

  const gridBoxes = boxes.map((box) => {
    let items = byBoxId.get(box.id) ?? [];
    if (items.length === 0) {
      const fallbackItems = fallback[box.kind as "wash" | "dry" | "finish" | "ready"] ?? [];
      const nextFallbackItems = fallbackItems.filter((item) => !usedFallbackIds.has(item.id));
      if (nextFallbackItems.length > 0) {
        nextFallbackItems.forEach((item) => usedFallbackIds.add(item.id));
        items = nextFallbackItems;
      }
    }

    return {
      ...box,
      items,
      primary: items[0] ?? null,
      overflow: Math.max(0, items.length - 1),
    };
  });

  const beltItems = [...operations.queueWaiting].sort((a, b) => {
    const aPos = a.queue_position ?? Number.MAX_SAFE_INTEGER;
    const bPos = b.queue_position ?? Number.MAX_SAFE_INTEGER;
    if (aPos !== bPos) return aPos - bPos;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  return { beltItems, gridBoxes };
}

function getStageDrawerData(
  operations: Awaited<ReturnType<typeof getOperationsDashboardUseCase>>,
  stageView: string | null | undefined,
) {
  const yard = buildOperationGridModel(operations);
  const operationalProfile = operations.tenant.operational_profile ?? "automotive";

  if (stageView === "entry") {
    return {
      title: "Entrada",
      subtitle: "Atendimentos na entrada",
      items: yard.beltItems,
      stage: "entry" as const,
      operationalProfile,
      boxSlaMinutes: null as number | null,
    };
  }

  const box = yard.gridBoxes.find((item) => item.id === stageView);
  if (!box) return null;

  return {
    title: box.name,
    subtitle: `Atendimentos em ${box.name}`,
    items: box.items,
    stage: box.kind as "entry" | "wash" | "dry" | "finish" | "ready",
    operationalProfile,
    boxSlaMinutes: box.sla_minutes,
  };
}

function StageIcon({
  kind,
  operationalProfile = "automotive",
}: {
  kind: "entry" | "wash" | "dry" | "finish" | "ready";
  operationalProfile?: "automotive" | "generic";
}) {
  if (kind === "wash") {
    if (operationalProfile === "generic") {
      return (
        <svg viewBox="0 0 32 32" className="h-9 w-9 text-cyan-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M7 10h10l2.5 2.5" />
          <path d="M19.5 10l5.5 5.5-5.5 5.5" />
          <path d="M7 22h8" />
          <path d="M7 17h12" />
          <circle cx="10" cy="10" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="7" cy="17" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="7" cy="22" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    }

    return (
      <svg viewBox="0 0 32 32" className="h-9 w-9 text-cyan-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M8 9h10l4 4" />
        <path d="M20 9l4 4-4 4" />
        <path d="M9 15l-2 3" />
        <path d="M14 17l-2 3" />
        <path d="M19 19l-2 3" />
        <path d="M24 15l-2 3" />
        <circle cx="9" cy="24" r="1.2" />
        <circle cx="16" cy="24" r="1.2" />
        <circle cx="23" cy="24" r="1.2" />
      </svg>
    );
  }

  if (kind === "dry" || kind === "finish") {
    if (operationalProfile === "generic") {
      return (
        <svg viewBox="0 0 32 32" className="h-9 w-9 text-sky-200" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="7" y="6.5" width="18" height="19" rx="4" />
          <path d="M11 12.5h10" />
          <path d="M11 17h10" />
          <path d="M11 21.5h6" />
          <path d="M20.5 20.5l2 2 3.5-4" />
        </svg>
      );
    }

    return (
      <svg viewBox="0 0 32 32" className="h-9 w-9 text-sky-200" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 12h15c2.5 0 4-1.3 4-3s-1.5-3-4-3c-2 0-3.1.8-4 2" />
        <path d="M5 18h19c2.5 0 4 1.3 4 3s-1.5 3-4 3c-2 0-3.1-.8-4-2" />
        <path d="M5 24h11c2.2 0 3.5-1.1 3.5-2.5S18.2 19 16 19" />
      </svg>
    );
  }

  if (kind === "ready") {
    return (
      <svg viewBox="0 0 32 32" className="h-9 w-9 text-emerald-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="10" cy="16" r="4.5" />
        <path d="M14.5 16h11" />
        <path d="M22 12.5l3.5 3.5-3.5 3.5" />
        <path d="M8.6 16l1.2 1.2 2.3-2.5" />
      </svg>
    );
  }

  return null;
}

function PlateFace({ plate }: { plate: string | null | undefined }) {
  return (
    <div className="mx-auto h-[56px] w-[176px] overflow-hidden rounded-[16px] border border-slate-300/80 bg-white shadow-[inset_0_-3px_0_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-between bg-[#2054c7] px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-white">
        <span>Brasil</span>
        <span>Mercosul</span>
      </div>
      <div className="px-3 py-1.5 text-center font-mono text-[15px] font-black tracking-[0.32em] text-slate-900">
        {mercosulPlate(plate)}
      </div>
    </div>
  );
}

function YardVehicleCard({
  attendance,
  compact = false,
  stage = "entry",
  boxSlaMinutes = null,
  confirmHref,
  tvMode = false,
  operationalProfile = "automotive",
}: {
  attendance: Awaited<ReturnType<typeof getOperationsDashboardUseCase>>["queue"][number];
  compact?: boolean;
  stage?: "entry" | "wash" | "dry" | "finish" | "ready";
  boxSlaMinutes?: number | null;
  confirmHref?: string;
  tvMode?: boolean;
  operationalProfile?: "automotive" | "generic";
}) {
  const isAutomotive = operationalProfile === "automotive";
  const overdue = slaProgress(attendance, boxSlaMinutes).overdue;
  const accent = vehicleAccentClass(attendance.vehicles?.color);
  const alertClass =
    overdue && stage !== "ready"
      ? "border-rose-500 shadow-[0_0_0_1px_rgba(244,63,94,0.42),0_0_28px_rgba(244,63,94,0.26)]"
      : "";
  const pulseClass = overdue && stage !== "ready" ? "animate-pulse" : "";
  const interactiveHref = tvMode ? undefined : confirmHref;
  const cardHeightClass = isAutomotive ? "h-[168px]" : "h-[128px]";
  const cardGridClass = isAutomotive ? "grid-rows-[56px_48px_22px]" : "grid-rows-[64px_20px]";
  const contentMinHeightClass = isAutomotive ? "min-h-[48px]" : "min-h-[64px]";

  const card = (
    <div className={`relative ${cardHeightClass} overflow-hidden rounded-[22px] border p-3 shadow-[0_14px_34px_rgba(0,0,0,0.24)] ${accent} ${alertClass} ${pulseClass} ${interactiveHref ? "cursor-pointer transition hover:border-amber-300/40 hover:shadow-[0_18px_40px_rgba(251,191,36,0.18)]" : ""}`}>
      {overdue && stage !== "ready" ? (
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(244,63,94,0.16),transparent_46%,rgba(244,63,94,0.1))]" />
      ) : null}
      <div className={`mx-auto grid h-full w-full ${compact ? "max-w-[220px]" : "max-w-[240px]"} ${cardGridClass} gap-2`}>
        {isAutomotive ? <PlateFace plate={attendance.vehicles?.plate} /> : null}
        <div className={`flex items-start ${contentMinHeightClass}`}>
          <div className="w-full">
            <p className={`${compact ? "text-base" : "text-lg"} line-clamp-1 font-semibold leading-[1.1] text-white`}>
              {isAutomotive ? formatVehicleDisplayLabel(attendance.vehicles ?? {}) : attendance.customers?.name ?? "Atendimento"}
            </p>
            <p className="mt-1 line-clamp-1 min-h-[18px] text-sm leading-[18px] text-white/64">
              {isAutomotive ? `${attendance.vehicles?.color ?? "Sem cor"} • ${attendance.customers?.name ?? "Cliente"}` : formatPhoneDisplay(attendance.customers?.whatsapp)}
            </p>
          </div>
        </div>
        <div className="line-clamp-1 min-h-[20px] text-sm leading-[20px] text-white/72">{resolveAttendanceServiceDisplayName(attendance)}</div>
      </div>
    </div>
  );

  if (interactiveHref) {
    return (
      <Link href={interactiveHref} className="block w-full text-left">
        {card}
      </Link>
    );
  }

  return card;
}

function OperationGridSection({
  dashboard,
  operations,
}: {
  dashboard: Awaited<ReturnType<typeof getOwnerDashboardUseCase>>;
  operations: Awaited<ReturnType<typeof getOperationsDashboardUseCase>>;
}) {
  const yard = buildOperationGridModel(operations);
  const operationalProfile = operations.tenant.operational_profile ?? "automotive";
  const rotationCycleMs = 15000;
  const operationColumns = [
    <div key="entry" className="flex h-[560px] w-[280px] shrink-0 flex-col rounded-[26px] border border-amber-300/24 bg-[linear-gradient(180deg,rgba(250,204,21,0.12),rgba(8,11,18,0.95))] p-4">
      <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-300/25 bg-[repeating-linear-gradient(135deg,rgba(250,204,21,0.18),rgba(250,204,21,0.18)_12px,rgba(8,11,18,0.9)_12px,rgba(8,11,18,0.9)_24px)] px-4 py-3">
        <Link href={hrefFor("dashboard", { drawer: "etapa", stageView: "entry" })} className="inline-flex text-xs uppercase tracking-[0.28em] text-amber-100/84 transition hover:text-white">
          Entrada
        </Link>
        <span className="rounded-full border border-amber-200/20 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-amber-50/86">
          {yard.beltItems.length} na fila
        </span>
      </div>
      <div className="min-h-0 flex-1 pt-2">
        {yard.beltItems.length === 0 ? (
          <EmptyState text="Nenhum atendimento aguardando entrada." />
        ) : (
          <RotatingCardViewport className="h-full overflow-hidden" itemsPerPage={2} intervalMs={rotationCycleMs} initialDelayMs={6000}>
            {yard.beltItems.map((attendance, index) => (
              <div key={attendance.id} className="relative rounded-[22px] border border-white/10 bg-black/25 p-3 pt-8">
                <div className="absolute left-3 right-3 top-3 flex items-center justify-between text-xs uppercase tracking-[0.24em] text-white/44">
                  <span>Posição {index + 1}</span>
                  <span>{formatPaymentStatus(attendance.payment_method)}</span>
                </div>
                <YardVehicleCard
                  attendance={attendance}
                  compact
                  stage="entry"
                  operationalProfile={operationalProfile}
                  confirmHref={attendanceActionsHref(attendance.id)}
                  boxSlaMinutes={null}
                />
              </div>
            ))}
          </RotatingCardViewport>
        )}
      </div>
    </div>,
    ...yard.gridBoxes.map((box, boxIndex) => (
      <div key={box.id} className="flex h-[560px] w-[280px] shrink-0 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-white/6 p-4">
        <div className="mb-2 flex h-[60px] items-start justify-between gap-3">
          <div className="flex min-h-[60px] flex-col justify-start">
            <p className="text-xs uppercase tracking-[0.28em] text-white/42">{box.code}</p>
            <h3 className="mt-1 min-h-[34px] text-lg font-semibold leading-[1.05] text-white">
              <Link href={hrefFor("dashboard", { drawer: "etapa", stageView: box.id })} className="transition hover:text-[var(--accent)]">
                {box.name}
              </Link>
            </h3>
          </div>
          <div className="flex items-center gap-3 self-start">
            <div className="rounded-2xl border border-white/10 bg-black/16 p-2">
              <StageIcon kind={box.kind as "entry" | "wash" | "dry" | "finish" | "ready"} operationalProfile={operationalProfile} />
            </div>
            {box.kind === "ready" ? (
              <div className="flex min-w-[72px] flex-col items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs uppercase tracking-[0.22em] text-emerald-100">
                <span className="text-sm font-semibold leading-none">{box.items.length}</span>
                <span className="mt-1 leading-none">{box.items.length === 1 ? "pronto" : "prontos"}</span>
              </div>
            ) : (
              <div className="whitespace-nowrap rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs uppercase tracking-[0.22em] text-white/62">
                {formatOperationBoxDurationLabel(box.sla_minutes, box.sla_unit)}
              </div>
            )}
          </div>
        </div>

        {box.items.length > 0 ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <RotatingCardViewport
              className="min-h-0 flex-1 overflow-hidden"
              itemsPerPage={2}
              intervalMs={rotationCycleMs}
              initialDelayMs={6000 * (boxIndex + 2)}
            >
              {box.items.map((attendance, index) => (
                <div key={attendance.id} className="relative rounded-[22px] border border-white/10 bg-black/25 p-3 pt-8">
                  <div className="absolute left-3 right-3 top-3 flex items-center justify-between text-xs uppercase tracking-[0.24em] text-white/44">
                    <span>Posição {attendance.queue_position ?? index + 1}</span>
                    <span>{formatPaymentStatus(attendance.payment_method)}</span>
                  </div>
                  <YardVehicleCard
                    attendance={attendance}
                    stage={box.kind as "entry" | "wash" | "dry" | "finish" | "ready"}
                    operationalProfile={operationalProfile}
                    confirmHref={attendanceActionsHref(attendance.id)}
                    boxSlaMinutes={box.sla_minutes}
                  />
                </div>
              ))}
            </RotatingCardViewport>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-[24px] border border-dashed border-white/12 bg-black/15 px-6 text-center text-sm text-white/42">
            Etapa livre para receber o próximo atendimento
          </div>
        )}
      </div>
    )),
  ];
  const rotationColumnsCount = Math.max(1, operationColumns.length);
  const rotationPhaseMs = Math.max(1000, Math.floor(rotationCycleMs / rotationColumnsCount));

  return (
    <SectionShell
      eyebrow="Operação visual"
      title="Fluxo de trabalho"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link href={hrefFor("dashboard", { drawer: "resumo" })} className="rounded-2xl border border-white/10 bg-white/6 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/82">
            Operação
          </Link>
          <Link href={hrefFor("dashboard", { drawer: "agenda", appointmentsMonth: operations.appointmentCalendar.key })} className="rounded-2xl border border-white/10 bg-white/6 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/82">
            Agendamentos
          </Link>
          <Link href={hrefFor("dashboard", { drawer: "novo" })} className="rounded-2xl border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-950">
            Novo atendimento
          </Link>
          {operations.settings?.tv_mode_enabled ? (
            <Link href="/app/dashboard?tv=1" className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-2 text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
              Abrir modo TV
            </Link>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/64">
              Modo TV disponível
            </div>
          )}
        </div>
      }
    >
      <AutoScrollStrip className="w-full pb-3" intervalMs={rotationCycleMs}>
        {operationColumns}
      </AutoScrollStrip>
    </SectionShell>
  );
}

function YardTvModePage({
  tenantName,
  dashboard,
  operations,
}: {
  tenantName: string;
  dashboard: Awaited<ReturnType<typeof getOwnerDashboardUseCase>>;
  operations: Awaited<ReturnType<typeof getOperationsDashboardUseCase>>;
}) {
  const yard = buildOperationGridModel(operations);
  const operationalProfile = operations.tenant.operational_profile ?? "automotive";
  const rotationCycleMs = 30000;
  const tvColumns = [
    {
      id: "entry",
      code: "ENTRY",
      kind: "entry" as const,
      name: "Entrada",
      sla_minutes: null,
      sla_unit: "minutes" as const,
      items: yard.beltItems,
      entryStyle: true,
    },
    ...yard.gridBoxes.map((box) => ({
      id: box.id,
      code: box.code,
      kind: box.kind as "entry" | "wash" | "dry" | "finish" | "ready",
      name: box.name,
      sla_minutes: box.sla_minutes,
      sla_unit: box.sla_unit,
      items: box.items,
      entryStyle: false,
    })),
  ];
  const rotationColumnsCount = Math.max(1, tvColumns.length);
  const rotationPhaseMs = Math.max(1000, Math.floor(rotationCycleMs / rotationColumnsCount));

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(0,245,212,0.14),transparent_28%),linear-gradient(180deg,#06080d,#0d1117_42%,#07090f)] px-6 py-6 text-white">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-[32px] border border-white/10 bg-black/25 p-6 shadow-[0_28px_80px_rgba(0,0,0,0.34)] xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.34em] text-[var(--accent)]">Modo TV da operação</p>
            <h1 className="mt-3 text-4xl font-semibold text-white xl:text-5xl">{tenantName}</h1>
            <p className="mt-3 max-w-3xl text-base text-white/60 xl:text-lg">
              Painel vivo da operação. A entrada mostra a ordem do fluxo e as etapas destacam prioridade, prazo e identificação do atendimento.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-[24px] border border-white/10 bg-white/6 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-white/42">Na fila</p>
              <p className="mt-2 text-3xl font-semibold text-white">{dashboard.stats.waiting}</p>
            </div>
            <div className="rounded-[24px] border border-sky-400/20 bg-sky-400/10 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-sky-100/70">Lavando</p>
              <p className="mt-2 text-3xl font-semibold text-sky-50">{dashboard.stats.washing}</p>
            </div>
            <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-400/10 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-emerald-100/72">Prontos</p>
              <p className="mt-2 text-3xl font-semibold text-emerald-50">{dashboard.stats.ready}</p>
            </div>
            <Link
              href="/app/dashboard?section=dashboard"
              className="flex min-h-[108px] items-center justify-center rounded-[24px] border border-white/10 bg-white/6 px-5 py-4 text-center text-sm font-semibold text-white/84"
            >
              Sair do modo TV
            </Link>
          </div>
        </header>

        <section
          className="grid gap-5"
          style={{ gridTemplateColumns: `repeat(${tvColumns.length}, minmax(0, 1fr))` }}
        >
          {tvColumns.map((column, columnIndex) => (
            <div
              key={column.id}
              className={`flex h-[620px] flex-col overflow-hidden rounded-[32px] p-5 shadow-[0_24px_64px_rgba(0,0,0,0.3)] ${
                column.entryStyle
                  ? "border border-amber-300/24 bg-[linear-gradient(180deg,rgba(250,204,21,0.14),rgba(7,9,15,0.96))]"
                  : "border border-white/10 bg-white/6"
              }`}
            >
              {column.entryStyle ? (
                <div className="rounded-[22px] border border-amber-300/25 bg-[repeating-linear-gradient(135deg,rgba(250,204,21,0.24),rgba(250,204,21,0.24)_16px,rgba(7,9,15,0.92)_16px,rgba(7,9,15,0.92)_32px)] px-4 py-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.34em] text-amber-50">{column.name}</p>
                </div>
              ) : (
                <div className="mb-3 flex h-[74px] items-start justify-between gap-4">
                  <div className="flex min-h-[74px] flex-col justify-start">
                    <p className="text-sm uppercase tracking-[0.34em] text-white/42">{column.code}</p>
                    <h2 className="mt-2 min-h-[42px] text-3xl font-semibold leading-[1.02] text-white">{column.name}</h2>
                  </div>
                  <div className="flex items-center gap-3 self-start">
                    <div className="rounded-[20px] border border-white/10 bg-black/16 p-2">
                      <StageIcon kind={column.kind} operationalProfile={operationalProfile} />
                    </div>
                    <div className="whitespace-nowrap rounded-[20px] border border-white/10 bg-black/20 px-4 py-3 text-sm uppercase tracking-[0.22em] text-white/66">
                      {formatOperationBoxDurationLabel(column.sla_minutes, column.sla_unit)}
                    </div>
                  </div>
                </div>
              )}

              <div className={`min-h-0 flex-1 ${column.entryStyle ? "mt-4" : ""}`}>
                {column.items.length === 0 ? (
                  <div className="flex min-h-[240px] items-center justify-center rounded-[28px] border border-dashed border-white/12 bg-black/20 px-8 text-center text-lg text-white/42">
                    {column.entryStyle ? "Nenhum atendimento aguardando entrada agora." : "Etapa livre para receber o próximo atendimento"}
                  </div>
                ) : (
                  <RotatingCardViewport
                    className="h-full overflow-hidden"
                    itemsPerPage={2}
                    intervalMs={rotationCycleMs}
                    initialDelayMs={rotationPhaseMs * (columnIndex + 1)}
                  >
                    {column.items.map((attendance, index) => (
                      <div key={attendance.id} className="relative rounded-[24px] border border-white/10 bg-black/25 p-4 pt-12">
                        <div className="absolute left-4 right-4 top-4 flex items-center justify-between text-xs uppercase tracking-[0.28em] text-white/46">
                          <span>Posição {attendance.queue_position ?? index + 1}</span>
                        </div>
                        <YardVehicleCard
                          attendance={attendance}
                          stage={column.kind}
                          boxSlaMinutes={column.entryStyle ? null : column.sla_minutes}
                          operationalProfile={operationalProfile}
                          tvMode
                        />
                      </div>
                    ))}
                  </RotatingCardViewport>
                )}
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

function SectionShell({
  eyebrow,
  title,
  description,
  children,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-[color:var(--surface-border)] bg-[color:var(--surface-panel)] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.24)] backdrop-blur-xl lg:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--text-soft)]">{eyebrow}</p>
          <h2 className="mt-2 text-xl font-semibold text-[color:var(--text-primary)] lg:text-2xl">{title}</h2>
          {description ? <p className="mt-2 max-w-3xl text-sm text-[color:var(--text-muted)]">{description}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function DrawerShell({
  title,
  subtitle,
  closeHref,
  children,
}: {
  title: string;
  subtitle: string;
  closeHref: string;
  children: ReactNode;
}) {
  return (
    <>
      <Link href={closeHref} className="fixed inset-0 z-40 bg-[color:var(--overlay-strong)]" />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-[460px] overflow-y-auto border-l border-[color:var(--surface-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--background)_98%,#000000_2%),color-mix(in_srgb,var(--surface-strong)_96%,#ffffff_4%))] p-5 shadow-[-18px_0_56px_rgba(0,0,0,0.4)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--text-soft)]">{subtitle}</p>
            <h2 className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">{title}</h2>
          </div>
          <Link href={closeHref} className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 py-2 text-sm text-[color:var(--text-secondary)]">
            Fechar
          </Link>
        </div>
        <div className="mt-5">{children}</div>
      </aside>
    </>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] p-4 text-sm text-[color:var(--text-muted)]">
      {text}
    </div>
  );
}

function NewAttendanceForm({
  operations,
  redirectTo,
}: {
  operations: Awaited<ReturnType<typeof getOperationsDashboardUseCase>>;
  redirectTo: string;
}) {
  const vehicleTypeOptions = getVehicleTypeOptions(operations.settings?.vehicle_type_tier_overrides ?? {});
  return (
    <NewAttendanceFormClient
      formAction={createAttendanceAction}
      services={operations.services.map((service) => ({
        id: service.id,
        name: service.name,
        price: Number(service.price),
        pricePasseio: Number(service.price_passeio ?? service.price),
        priceMedio: Number(service.price_medio ?? service.price),
        priceGrande: Number(service.price_grande ?? service.price),
        priceBemGrande: Number(service.price_bem_grande ?? service.price),
      }))}
      customers={operations.customers.map((customer) => ({
        id: customer.id,
        name: customer.name,
        trade_name: customer.trade_name ?? null,
        whatsapp: customer.whatsapp ?? null,
      }))}
      redirectTo={redirectTo}
      brandOptions={operations.vehicleCatalog.brands}
      modelOptions={operations.vehicleCatalog.models}
      colorOptions={operations.vehicleCatalog.colors}
      vehicleTypeOptions={vehicleTypeOptions.map((option) => ({ code: option.code, label: option.label, tier: option.tier }))}
      operationalProfile={operations.tenant.operational_profile ?? "automotive"}
    />
  );
}

function CenterDrawerShell({
  title,
  subtitle,
  closeHref,
  children,
}: {
  title: string;
  subtitle: string;
  closeHref: string;
  children: ReactNode;
}) {
  return (
    <>
      <Link href={closeHref} className="fixed inset-0 z-40 bg-[color:var(--overlay-strong)]" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative max-h-[92vh] w-full max-w-[1120px] overflow-y-auto rounded-[32px] border border-[color:var(--surface-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--background)_98%,#000000_2%),color-mix(in_srgb,var(--surface-strong)_96%,#ffffff_4%))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.48)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--text-soft)]">{subtitle}</p>
              <h2 className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">{title}</h2>
            </div>
            <Link href={closeHref} className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 py-2 text-sm text-[color:var(--text-secondary)]">
              Fechar
            </Link>
          </div>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </>
  );
}

function InfoMetric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "accent" }) {
  return (
    <div
      className={`rounded-[22px] border p-4 ${
        tone === "accent"
          ? "border-[var(--accent)] bg-[linear-gradient(135deg,rgba(0,245,212,0.16),rgba(56,189,248,0.08))]"
          : "border-[color:var(--surface-border)] bg-[color:var(--surface-soft)]"
      }`}
    >
      <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--text-soft)]">{label}</p>
      <p className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">{value}</p>
    </div>
  );
}

function AdmTab({
  href,
  title,
  active,
  tone = "default",
}: {
  href: string;
  title: string;
  active: boolean;
  tone?: "default" | "accent";
}) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-[52px] items-center justify-center rounded-[18px] border px-5 text-sm font-semibold transition ${
        active
          ? "border-[var(--accent)] bg-[linear-gradient(135deg,rgba(0,245,212,0.18),rgba(56,189,248,0.08))] text-[color:var(--text-primary)] shadow-[0_10px_28px_rgba(0,245,212,0.14)]"
          : tone === "accent"
            ? "border-[color:var(--surface-border)] bg-[linear-gradient(180deg,rgba(0,245,212,0.08),rgba(255,255,255,0.04))] text-[color:var(--text-secondary)] hover:border-[var(--accent)]/45"
            : "border-[color:var(--surface-border)] bg-[color:var(--surface-panel)] text-[color:var(--text-secondary)] hover:border-[color:var(--card-border)] hover:text-[color:var(--text-primary)]"
      }`}
    >
      {title}
    </Link>
  );
}

function DashboardDrawerContent({
  drawer,
  dashboard,
  operations,
  error,
  stageView,
  appointmentsMonth,
}: {
  drawer: DashboardDrawer | null;
  dashboard: Awaited<ReturnType<typeof getOwnerDashboardUseCase>>;
  operations: Awaited<ReturnType<typeof getOperationsDashboardUseCase>>;
  error?: string;
  stageView?: string | null;
  appointmentsMonth?: string | null;
}) {
  if (!drawer) return null;
  const isAutomotiveTenant = (operations.tenant.operational_profile ?? "automotive") === "automotive";
  const vehicleTypeOptions = getVehicleTypeOptions(operations.settings?.vehicle_type_tier_overrides ?? {});
  const monthKey = normalizeAppointmentMonth(appointmentsMonth ?? operations.appointmentCalendar.key);

  if (drawer === "agenda") {
    return <AutomotiveAgendaMenuCard monthKey={monthKey} />;
  }

  if (drawer === "agendar") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-white/58">Preencha e agende. Ao salvar, a lista volta atualizada no dashboard.</p>
        {error ? <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
        <form action={createAppointmentAction} className="space-y-3">
          <input type="hidden" name="redirect_to" value={hrefFor("dashboard", { drawer: "agendar", appointmentsMonth: monthKey })} />
          <input name="customer_name" placeholder="Cliente" className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
          <PhoneInput name="whatsapp" placeholder="WhatsApp" className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
          {isAutomotiveTenant ? (
            <VehicleIdentityFields
              platePlaceholder="Placa"
              brandOptions={operations.vehicleCatalog.brands}
              modelOptions={operations.vehicleCatalog.models}
              colorOptions={operations.vehicleCatalog.colors}
              vehicleTypeOptions={vehicleTypeOptions.map((option) => ({ code: option.code, label: option.label }))}
            />
          ) : (
            <div className="space-y-3">
              <input type="hidden" name="plate" value="" />
              <input type="hidden" name="vehicle_type" value="" />
              <input type="hidden" name="vehicle_brand" value="" />
              <input type="hidden" name="vehicle_model" value="" />
              <input type="hidden" name="color" value="" />
              <input
                name="email"
                type="email"
                placeholder="E-mail"
                className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
              />
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <PhoneInput
                  name="contact_phone_2"
                  placeholder="Outro telefone de contato"
                  className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
                />
                <DocumentInput
                  name="document"
                  placeholder="CPF ou CNPJ"
                  className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
                />
              </div>
            </div>
          )}
          <select name="service_id" defaultValue="" className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none">
            <option value="">
              Serviço ainda não definido
            </option>
            {operations.services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} - {formatCurrency(Number(service.price))}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input name="date" type="date" className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
            <input name="time" type="time" className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
          </div>
          <input name="notes" placeholder="Observação" className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
          <AuthSubmitButton
            label="Agendar serviço"
            pendingLabel="Salvando agendamento..."
            className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950 transition hover:scale-[1.01] disabled:cursor-wait disabled:opacity-70"
          />
        </form>
      </div>
    );
  }

  if (drawer === "agendamentos") {
    return <AppointmentListPanel operations={operations} monthKey={monthKey} />;
  }

  if (drawer === "resumo") {
    return <DailySummaryDrawer dashboard={dashboard} operations={operations} />;
  }

  if (drawer === "novo") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-white/58">Cadastre o cliente, o carro e o serviço sem sair do pátio.</p>
        {error ? <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
        <NewAttendanceForm operations={operations} redirectTo="/app/dashboard?drawer=novo" />
      </div>
    );
  }

  if (drawer === "etapa") {
    const stageData = getStageDrawerData(operations, stageView);

    if (!stageData) {
      return <EmptyState text="Etapa não encontrada." />;
    }

    return (
      <div className="space-y-3">
        <p className="text-sm text-white/58">{stageData.subtitle}.</p>
        {stageData.items.length === 0 ? (
          <EmptyState text="Nenhum atendimento nesta etapa agora." />
        ) : (
          stageData.items.map((item, index) => (
            <div key={item.id} className="relative rounded-[22px] border border-white/10 bg-black/25 p-3 pt-8">
              <div className="absolute left-3 right-3 top-3 flex items-center justify-between text-xs uppercase tracking-[0.24em] text-white/44">
                <span>Posição {item.queue_position ?? index + 1}</span>
                <span>{formatPaymentStatus(item.payment_method)}</span>
              </div>
              <YardVehicleCard
                attendance={item}
                stage={stageData.stage}
                operationalProfile={stageData.operationalProfile}
                confirmHref={attendanceActionsHref(item.id)}
                boxSlaMinutes={stageData.boxSlaMinutes}
              />
            </div>
          ))
        )}
      </div>
    );
  }

  const items = drawer === "fila" ? operations.queueActive : operations.queueReady;
  const title = drawer === "fila" ? "Fila operacional" : "Carros prontos";

  return (
    <div className="space-y-3">
      <p className="text-sm text-white/58">{title} com visão operacional completa.</p>
      {items.length === 0 ? (
        <EmptyState text="Nenhum carro nesta lista agora." />
      ) : (
        items.map((item) => (
          <div key={item.id} className={`rounded-[22px] border-2 p-4 ${queueCardTone(item.status, item.payment_method)}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-white">{item.customers?.name ?? "Cliente"}</p>
                <p className="mt-1 text-sm text-white/60">
                  {formatVehicleDisplayLabel(item.vehicles ?? {})}
                  {item.vehicles?.color ? ` ${item.vehicles.color}` : ""}
                </p>
                <p className="text-sm text-white/60">{item.vehicles?.plate ?? "Sem placa"}</p>
                <p className="text-sm text-white/60">{item.customers?.whatsapp ?? "Sem WhatsApp"}</p>
              </div>
              <div className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/74">
                {item.status === "ready" ? "0 min" : `${item.estimated_minutes ?? 0} min`}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/70">
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">{resolveAttendanceServiceDisplayName(item)}</span>
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">{item.employees?.name ?? "Sem lavador"}</span>
              <span className={`rounded-full border px-3 py-1 ${statusTone(item.status)}`}>{formatStatus(item.status)}</span>
              {item.payment_method === "pending" ? (
                <Link
                  href={cashHrefForAttendance(item, { markDelivery: item.status === "ready" })}
                  className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-amber-100 transition hover:border-amber-200/40 hover:bg-amber-300/14"
                >
                  {item.status === "ready" ? "Cobrar e retirar" : formatPaymentStatus(item.payment_method)}
                </Link>
              ) : item.status === "ready" ? (
                <form action={registerAttendanceDeliveryAction}>
                  <input type="hidden" name="redirect_to" value="/app/dashboard" />
                  <input type="hidden" name="attendance_id" value={item.id} />
                  <ConfirmSubmitButton
                    label="Registrar retirada"
                    pendingLabel="Registrando..."
                    confirmMessage="Confirmar retirada do veículo?"
                    className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-emerald-100 transition hover:border-emerald-300/40 hover:bg-emerald-400/14"
                  />
                </form>
              ) : (
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-emerald-100">
                  {formatPaymentStatus(item.payment_method)}
                </span>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function AppointmentListPanel({
  operations,
  monthKey,
  embedded = false,
}: {
  operations: Awaited<ReturnType<typeof getOperationsDashboardUseCase>>;
  monthKey: string;
  embedded?: boolean;
}) {
  const isAutomotiveTenant = operations.tenant.operational_profile !== "generic";
  const previousMonth = shiftAppointmentMonth(monthKey, -1);
  const nextMonth = shiftAppointmentMonth(monthKey, 1);
  const currentMonth = getCurrentMonthKey();
  const redirectTo = embedded ? hrefFor("dashboard", { appointmentsMonth: monthKey }) : hrefFor("dashboard", { drawer: "agendamentos", appointmentsMonth: monthKey });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-[22px] border border-white/10 bg-black/15 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-white/40">Calendário</p>
          <p className="mt-2 text-xl font-semibold text-white">{formatAppointmentMonthLabel(monthKey)}</p>
          <p className="mt-1 text-sm text-white/56">O sistema mostra o mês inteiro e permite navegar para meses passados e futuros.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={hrefFor("dashboard", { drawer: embedded ? null : "agendamentos", appointmentsMonth: previousMonth })} className="rounded-2xl border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/82">
            Mês anterior
          </Link>
          <Link href={hrefFor("dashboard", { drawer: embedded ? null : "agendamentos", appointmentsMonth: currentMonth })} className="rounded-2xl border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/82">
            Mês atual
          </Link>
          <Link href={hrefFor("dashboard", { drawer: embedded ? null : "agendamentos", appointmentsMonth: nextMonth })} className="rounded-2xl border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/82">
            Próximo mês
          </Link>
        </div>
      </div>

      {operations.monthAppointments.length === 0 ? (
        <EmptyState text="Nenhum agendamento neste mês." />
      ) : (
        operations.monthAppointments.map((appointment) => (
          <div key={appointment.id} className="rounded-[22px] border border-white/10 bg-black/15 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-base font-semibold text-white">{appointment.customers?.name ?? "Cliente"}</p>
                <p className="mt-1 text-sm text-white/60">
                  {isAutomotiveTenant ? `${formatVehicleDisplayLabel(appointment.vehicles ?? {})} • ${appointment.services?.name ?? "Sem serviço"}` : appointment.services?.name ?? "Sem serviço"}
                </p>
                {isAutomotiveTenant ? <p className="text-sm text-white/60">{appointment.vehicles?.plate ?? "Sem placa"}</p> : null}
                {appointment.notes ? <p className="mt-2 text-sm text-white/52">{appointment.notes}</p> : null}
              </div>
              <div className="text-left lg:text-right">
                <p className="text-sm font-semibold text-white">{formatDateTime(appointment.scheduled_for)}</p>
                <p className="mt-1 text-sm text-white/60">{formatStatus(appointment.status)}</p>
                <p className="mt-1 text-sm text-white/60">
                  {formatCurrency(
                    resolveServicePriceByVehicleType(
                      {
                        id: appointment.id,
                        tenant_id: "",
                        name: appointment.services?.name ?? "",
                        base_service_id: null,
                        time_unit: "minutes",
                        price: Number(appointment.services?.price ?? 0),
                        price_passeio: Number(appointment.services?.price_passeio ?? appointment.services?.price ?? 0),
                        price_medio: Number(appointment.services?.price_medio ?? appointment.services?.price ?? 0),
                        price_grande: Number(appointment.services?.price_grande ?? appointment.services?.price ?? 0),
                        price_bem_grande: Number(appointment.services?.price_bem_grande ?? appointment.services?.price ?? 0),
                        price_app_passeio: Number(appointment.services?.price_passeio ?? appointment.services?.price ?? 0),
                        price_app_medio: Number(appointment.services?.price_medio ?? appointment.services?.price ?? 0),
                        price_app_grande: Number(appointment.services?.price_grande ?? appointment.services?.price ?? 0),
                        price_app_bem_grande: Number(appointment.services?.price_bem_grande ?? appointment.services?.price ?? 0),
                        minutes_passeio: 0,
                        minutes_medio: 0,
                        minutes_grande: 0,
                        minutes_bem_grande: 0,
                        addon_minutes: 0,
                        addon_minutes_passeio: 0,
                        addon_minutes_medio: 0,
                        addon_minutes_grande: 0,
                        addon_minutes_bem_grande: 0,
                        addon_price_passeio: 0,
                        addon_price_medio: 0,
                        addon_price_grande: 0,
                        addon_price_bem_grande: 0,
                        addon_price_app_passeio: 0,
                        addon_price_app_medio: 0,
                        addon_price_app_grande: 0,
                        addon_price_app_bem_grande: 0,
                        average_minutes: 0,
                        short_description: null,
                        kind: "main",
                        is_active: true,
                        base_service: null,
                      },
                      appointment.vehicles?.vehicle_type ?? null,
                      operations.settings?.vehicle_type_tier_overrides ?? {},
                    ),
                  )}
                </p>
              </div>
            </div>

            {appointment.status === "scheduled" ? (
              <>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <form action={confirmAppointmentAction}>
                    <input type="hidden" name="appointment_id" value={appointment.id} />
                    <input type="hidden" name="redirect_to" value={redirectTo} />
                    <button className="min-h-11 w-full rounded-2xl border border-emerald-400/30 bg-emerald-400/12 px-3 py-2 text-sm font-medium text-emerald-100">
                      Confirmar
                    </button>
                  </form>
                  <form action={cancelAppointmentAction}>
                    <input type="hidden" name="appointment_id" value={appointment.id} />
                    <input type="hidden" name="redirect_to" value={redirectTo} />
                    <button className="min-h-11 w-full rounded-2xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm font-medium text-rose-100">
                      Cancelar
                    </button>
                  </form>
                  <form action={rescheduleAppointmentAction} className="contents">
                    <input type="hidden" name="appointment_id" value={appointment.id} />
                    <input type="hidden" name="redirect_to" value={redirectTo} />
                    <button className="min-h-11 w-full rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white/82">
                      Reagendar
                    </button>
                    <input
                      type="date"
                      name="date"
                      defaultValue={formatDateInput(appointment.scheduled_for)}
                      className="col-span-2 h-11 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
                    />
                    <input
                      type="time"
                      name="time"
                      defaultValue={formatTimeInput(appointment.scheduled_for)}
                      className="h-11 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
                    />
                  </form>
                </div>
              </>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}

function AppointmentsSection({ operations }: { operations: Awaited<ReturnType<typeof getOperationsDashboardUseCase>> }) {
  const monthKey = operations.appointmentCalendar.key;

  return (
    <SectionShell
      eyebrow="Agendados"
      title="Agendamentos"
      description="Os agendamentos aparecem por mês inteiro, com navegação entre meses, confirmação rápida e reagendamento."
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href={hrefFor("dashboard", { drawer: "agendar", appointmentsMonth: monthKey })} className="rounded-2xl border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/82">
            Agendar
          </Link>
          <Link href={hrefFor("dashboard", { drawer: "agendamentos", appointmentsMonth: monthKey })} className="rounded-2xl border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/82">
            Ver agendamentos
          </Link>
        </div>
      }
    >
      <AppointmentListPanel operations={operations} monthKey={monthKey} embedded />
    </SectionShell>
  );
}

function CashDrawerContent({
  drawer,
  operations,
}: {
  drawer: CashDrawer | null;
  operations: Awaited<ReturnType<typeof getOperationsDashboardUseCase>>;
}) {
  if (!drawer) return null;

  const dailyEntries = operations.cash.entries;
  const monthlyEntries = operations.cash.monthEntries ?? [];
  const incomes = dailyEntries.filter((entry) => entry.kind === "income");
  const expenses = dailyEntries.filter((entry) => entry.kind === "expense");
  const channelGroups = [
    { label: "Dinheiro", value: incomes.filter((entry) => entry.payment_method === "cash") },
    { label: "Pix", value: incomes.filter((entry) => entry.payment_method === "pix") },
    { label: "Cartão de débito", value: incomes.filter((entry) => entry.payment_method === "card" && entry.card_kind === "debit") },
    { label: "Cartão de crédito", value: incomes.filter((entry) => entry.payment_method === "card" && entry.card_kind === "credit") },
    { label: "Cartão sem tipo", value: incomes.filter((entry) => entry.payment_method === "card" && !entry.card_kind) },
  ].filter((group) => group.value.length > 0);

  if (drawer === "entries") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-white/58">Registre um recebimento ou consulte os recebimentos do período selecionado.</p>
        <form action={createCashEntryAction} className="space-y-3 rounded-[22px] border border-emerald-400/14 bg-emerald-400/6 p-4">
          <input type="hidden" name="redirect_to" value="/app/dashboard?section=caixa" />
          <input type="hidden" name="kind" value="income" />
          <div className="grid gap-3 sm:grid-cols-2">
            <select name="entry_category" defaultValue="service" className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-3 text-sm text-white outline-none">
              <option value="service">Serviço</option>
              <option value="addon">Adicional</option>
              <option value="extra">Extra</option>
              <option value="other_income">Outra entrada</option>
            </select>
            <select name="payment_method" defaultValue="cash" className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-3 text-sm text-white outline-none">
              <option value="cash">Dinheiro</option>
              <option value="pix">Pix</option>
              <option value="card">Cartão</option>
              <option value="pending">Pendente</option>
            </select>
            <CurrencyInput name="amount" placeholder="R$ 0,00" className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-3 text-sm text-white outline-none" />
            <input name="item_name" placeholder="Descrição do recebimento" className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-3 text-sm text-white outline-none" />
          </div>
          <button className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-emerald-300 px-4 text-sm font-semibold text-slate-950">Lançar recebimento</button>
        </form>
        <div className="grid gap-3 sm:grid-cols-2">
          {channelGroups.map((group) => (
            <div key={group.label} className="rounded-[20px] border border-emerald-400/14 bg-emerald-400/6 p-4">
              <p className="text-sm font-semibold text-emerald-100">{group.label}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(group.value.reduce((sum, entry) => sum + entry.amount, 0))}</p>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {incomes.length === 0 ? (
            <EmptyState text="Nenhuma entrada realizada nesta sessão." />
          ) : (
            incomes.map((entry) => (
              <div key={entry.id} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{formatCashEntryDescription(entry.description)}</p>
                    <p className="mt-1 text-xs text-white/56">{formatCashChannel(entry)} • {formatTime(entry.created_at)}</p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-300">+{formatCurrency(entry.amount)}</p>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="rounded-[20px] border border-emerald-400/14 bg-emerald-400/6 px-4 py-3 text-sm font-semibold text-white">
          Total geral das entradas: {formatCurrency(incomes.reduce((sum, entry) => sum + entry.amount, 0))}
        </div>
      </div>
    );
  }

  if (drawer === "expenses") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-white/58">Registre uma saída ou consulte as saídas do período selecionado.</p>
        <div className="rounded-[22px] border border-rose-400/14 bg-rose-400/6 p-4">
          <CashExpenseForm
            formAction={createCashExpenseAction}
            dailyPayouts={operations.cash.dailyPayouts
              .filter((payout) => payout.status !== "paid")
              .map((payout) => ({
                employeeId: payout.employee_id,
                name: payout.employees?.name ?? "Funcionário",
                roleLabel: payout.employees?.role_label ?? "Equipe",
                amount: payout.amount,
              }))}
          />
        </div>
        <div className="space-y-3">
          {expenses.length === 0 ? (
            <EmptyState text="Nenhuma saída registrada nesta sessão." />
          ) : (
            expenses.map((entry) => (
              <div key={entry.id} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{formatCashEntryDescription(entry.description)}</p>
                    <p className="mt-1 text-xs text-white/56">
                      {entry.description.startsWith("DIARIA:") ? "Diária" : "Despesa"} • {entry.settlement_status === "scheduled" ? "Agendada" : "Realizada"} • {formatTime(entry.created_at)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-rose-300">-{formatCurrency(entry.amount)}</p>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="rounded-[20px] border border-rose-400/14 bg-rose-400/6 px-4 py-3 text-sm font-semibold text-white">
          Total geral das saídas: {formatCurrency(expenses.reduce((sum, entry) => sum + entry.amount, 0))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/58">Movimento mensal com lançamentos realizados e agendados para pagar ou receber.</p>
      <div className="grid gap-3 sm:grid-cols-4">
        <InfoMetric label="Entradas do mês" value={formatCurrency(monthlyEntries.filter((entry) => entry.kind === "income").reduce((sum, entry) => sum + entry.amount, 0))} />
        <InfoMetric label="Saídas do mês" value={formatCurrency(monthlyEntries.filter((entry) => entry.kind === "expense").reduce((sum, entry) => sum + entry.amount, 0))} />
        <InfoMetric label="Agendadas" value={formatCurrency(monthlyEntries.filter((entry) => entry.settlement_status === "scheduled").reduce((sum, entry) => sum + entry.amount, 0))} />
        <InfoMetric label="Liquidadas" value={formatCurrency(monthlyEntries.filter((entry) => entry.settlement_status === "settled").reduce((sum, entry) => sum + entry.amount, 0))} tone="accent" />
      </div>
      <div className="space-y-3">
        {monthlyEntries.length === 0 ? (
          <EmptyState text="Nenhum lançamento encontrado no mês atual." />
        ) : (
          monthlyEntries.map((entry) => (
            <div key={entry.id} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${cashEntryCategoryTone(entry.description, entry.kind)}`}>
                      {entry.kind === "income" ? "Entrada" : "Saída"}
                    </span>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${entry.settlement_status === "scheduled" ? "border-amber-300/20 bg-amber-300/10 text-amber-100" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"}`}>
                      {entry.settlement_status === "scheduled" ? "Agendada" : "Liquidada"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white">{formatCashEntryDescription(entry.description)}</p>
                  <p className="mt-1 text-xs text-white/56">
                    {formatCashChannel(entry)} • data {formatShortDate(entry.effective_date ?? entry.created_at)}
                  </p>
                </div>
                <p className={`text-sm font-semibold ${entry.kind === "income" ? "text-emerald-300" : "text-rose-300"}`}>
                  {entry.kind === "income" ? "+" : "-"}
                  {formatCurrency(entry.amount)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CashInsightBars({
  title,
  items,
  tone,
}: {
  title: string;
  items: Array<{ category: string; amount: number }>;
  tone: "income" | "expense";
}) {
  const maximum = Math.max(...items.map((item) => item.amount), 1);

  return (
    <div className="rounded-[28px] border border-white/10 bg-black/15 p-6">
      <p className="text-lg font-semibold text-white">{title}</p>
      <div className="mt-5 space-y-4">
        {items.length === 0 ? <EmptyState text="Sem movimentações classificadas neste período." /> : null}
        {items.map((item) => (
          <div key={item.category}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="text-white/72">{item.category}</span>
              <span className="font-semibold text-white">{formatCurrency(item.amount)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/8">
              <div
                className={`h-full rounded-full ${tone === "income" ? "bg-emerald-300" : "bg-rose-300"}`}
                style={{ width: `${Math.max((item.amount / maximum) * 100, 4)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    message?: string;
    section?: string;
    drawer?: string;
    panel?: string;
    cashDrawer?: string;
    cashPeriod?: string;
    customer?: string;
    customerForm?: string;
    quoteForm?: string;
    clientSearch?: string;
    employeeId?: string;
    employeeView?: string;
    service?: string;
    attendanceId?: string;
    deliveryAttendanceId?: string;
    cashIdentifierType?: string;
    cashIdentifierValue?: string;
    cashAmount?: string;
    cashDescription?: string;
    cashDelivery?: string;
    shelfId?: string;
    inventoryItemId?: string;
    inventoryMode?: string;
    inventoryBarcode?: string;
    inventoryQty?: string;
    stageView?: string;
    appointmentsMonth?: string;
    tv?: string;
  }>;
}) {
  const params = await searchParams;
  const currentSection = (["dashboard", "caixa", "inteligencia", "clientes", "estoque", "crescendo", "suporte", "adm"].includes(params.section ?? "") ? params.section : "dashboard") as TenantSection;
  const drawer = (["agenda", "agendar", "agendamentos", "resumo", "fila", "prontos", "novo", "etapa"].includes(params.drawer ?? "") ? params.drawer : null) as DashboardDrawer | null;
  const cashDrawer = (["entries", "expenses", "monthly"].includes(params.cashDrawer ?? "") ? params.cashDrawer : null) as CashDrawer | null;
  const cashPeriod = (["day", "week", "fortnight", "month", "year"].includes(params.cashPeriod ?? "") ? params.cashPeriod : "day") as CashPeriod;
  const admPanel = (["reports", "services", "employees", "settings", "whatsapp", "social"].includes(params.panel ?? "")
    ? params.panel
    : "reports") as AdmPanel;
  const tvMode = params.tv === "1";
  const clientSearch = (params.clientSearch ?? "").trim();
  const selectedEmployeeId = currentSection === "adm" && admPanel === "employees" ? (params.employeeId ?? "").trim() : "";
  const employeeView = currentSection === "adm" && admPanel === "employees" ? ((params.employeeView ?? "details").trim() || "details") : "details";
  const isCreatingEmployee = currentSection === "adm" && admPanel === "employees" && selectedEmployeeId === "new";
  const showCustomerForm = params.customerForm === "1";
  const showQuoteForm = params.quoteForm === "1";
  const cashIdentifierType = (["plate", "whatsapp", "customer_name"].includes(params.cashIdentifierType ?? "")
    ? params.cashIdentifierType
    : "plate") as "plate" | "whatsapp" | "customer_name";
  const cashIdentifierValue = (params.cashIdentifierValue ?? "").trim();
  const cashAmount = (params.cashAmount ?? "").trim();
  const cashDescription = (params.cashDescription ?? "").trim();
  const cashService = currentSection === "caixa" ? (params.service ?? "").trim() : "";
  const cashAttendanceId = currentSection === "caixa" ? (params.attendanceId ?? "").trim() : "";
  const selectedAttendanceId = currentSection === "dashboard" ? (params.attendanceId ?? "").trim() : "";
  const cashDelivery = currentSection === "caixa" && params.cashDelivery === "1";
  const deliveryAttendanceId = currentSection === "dashboard" ? (params.deliveryAttendanceId ?? "").trim() : "";
  const selectedShelfId = currentSection === "estoque" ? (params.shelfId ?? "").trim() : "";
  const selectedInventoryItemId = currentSection === "estoque" ? (params.inventoryItemId ?? "").trim() : "";
  const inventoryMode = currentSection === "estoque" ? (params.inventoryMode ?? "").trim() : "";
  const inventoryBarcode = currentSection === "estoque" ? (params.inventoryBarcode ?? "").trim() : "";
  const inventoryQty = currentSection === "estoque" ? (params.inventoryQty ?? "").trim() : "";
  const stageView = currentSection === "dashboard" ? (params.stageView ?? "").trim() : "";
  const appointmentsMonth = currentSection === "dashboard" ? normalizeAppointmentMonth(params.appointmentsMonth ?? "") : getCurrentMonthKey();
  const boardOnly = currentSection === "dashboard" && !drawer && !tvMode;

  const [dashboard, operations, reports, support, socialStudio, inventoryWorkspace, tenantGrowthWorkspace] = await Promise.all([
    getOwnerDashboardUseCase(),
    getOperationsDashboardUseCase({
      customerSearch: currentSection === "clientes" ? clientSearch : null,
      selectedCustomerId: currentSection === "clientes" ? params.customer ?? null : null,
      selectedServiceId: currentSection === "adm" && admPanel === "services" ? params.service ?? null : null,
      selectedEmployeeId: currentSection === "adm" && admPanel === "employees" ? selectedEmployeeId || null : null,
      appointmentMonth: appointmentsMonth,
      cashPeriod,
      mode: boardOnly ? "board" : "full",
    }),
    currentSection === "adm" && admPanel === "reports" ? getReportsUseCase() : Promise.resolve(null),
    currentSection === "suporte" ? getTenantSupportUseCase() : Promise.resolve(null),
    currentSection === "adm" && admPanel === "social" ? getSocialStudioUseCase() : Promise.resolve(null),
    currentSection === "estoque"
      ? getInventoryWorkspaceUseCase({
          selectedShelfId: selectedShelfId || null,
          selectedItemId: selectedInventoryItemId || null,
          pendingBarcode: inventoryMode === "new" ? inventoryBarcode : null,
          pendingQuantity: inventoryMode === "new" ? inventoryQty : null,
        })
      : Promise.resolve(null),
    currentSection === "crescendo" ? getTenantGrowthWorkspaceUseCase() : Promise.resolve(null),
  ]);

  const editingService = operations.selectedService;
  const selectedEmployee =
    currentSection === "adm" && admPanel === "employees" && selectedEmployeeId
      ? operations.employees.find((employee) => employee.id === selectedEmployeeId) ?? null
      : null;
  const selectedDeliveryAttendance =
    currentSection === "dashboard" && deliveryAttendanceId
      ? operations.queue.find((item) => item.id === deliveryAttendanceId && item.status === "ready" && item.payment_method !== "pending") ?? null
      : null;
  const selectedActionAttendance =
    currentSection === "dashboard" && selectedAttendanceId
      ? operations.queue.find((item) => item.id === selectedAttendanceId && (item.status === "waiting" || item.status === "washing" || item.status === "finishing" || item.status === "ready")) ?? null
      : null;
  const operationFlowLocked = operations.settings?.operation_flow_locked ?? true;
  const nextActionBox = selectedActionAttendance ? getNextOperationBox(operations.operationBoxes, selectedActionAttendance, operations.queue) : null;
  const selectableActionBoxes = selectedActionAttendance ? getSelectableOperationBoxes(operations.operationBoxes, selectedActionAttendance) : [];
  const selectedCashAttendance =
    currentSection === "caixa" && cashAttendanceId ? operations.queue.find((item) => item.id === cashAttendanceId) ?? null : null;
  const selectedStageDrawer = currentSection === "dashboard" && drawer === "etapa" ? getStageDrawerData(operations, stageView) : null;
  const isAutomotiveTenant = operations.tenant.operational_profile !== "generic";
  const vehicleTypeOptions = getVehicleTypeOptions(operations.settings?.vehicle_type_tier_overrides ?? {});
  const effectiveCashIdentifierType = selectedCashAttendance ? (isAutomotiveTenant ? "plate" : "customer_name") : cashIdentifierType;
  const effectiveCashIdentifierValue = selectedCashAttendance
    ? isAutomotiveTenant
      ? selectedCashAttendance.vehicles?.plate ?? ""
      : selectedCashAttendance.customers?.name ?? ""
    : cashIdentifierValue;
  const effectiveCashAmount = selectedCashAttendance ? String(selectedCashAttendance.final_price) : cashAmount;
  const effectiveCashService = selectedCashAttendance ? resolveAttendanceServiceDisplayName(selectedCashAttendance) : cashService;
  const effectiveCashDescription = selectedCashAttendance
    ? isAutomotiveTenant
      ? `${selectedCashAttendance.customers?.name ?? "Cliente"} • ${selectedCashAttendance.vehicles?.plate ?? "Sem placa"} • ${resolveAttendanceServiceDisplayName(selectedCashAttendance)}`
      : `${selectedCashAttendance.customers?.name ?? "Cliente"} • ${resolveAttendanceServiceDisplayName(selectedCashAttendance)}`
    : cashDescription;
  const shouldShowDeliveryBanner = currentSection === "caixa" && cashDelivery;
  const cashSubmitLabel = shouldShowDeliveryBanner ? "Finalizar recebimento" : "Registrar recebimento";

  if (tvMode && operations.settings?.tv_mode_enabled && operations.settings?.operations_mode === "boxes") {
    return (
      <>
        <RealtimeRefreshBridge tenantId={dashboard.tenant.id} scope="tenant" />
        <YardTvModePage tenantName={dashboard.tenant.name} dashboard={dashboard} operations={operations} />
      </>
    );
  }

  return (
    <>
      <RealtimeRefreshBridge tenantId={dashboard.tenant.id} scope="tenant" />
      <TenantSidebar
        actorName={dashboard.actor.firstName}
        cashStatus={dashboard.stats.cashStatus}
        currentSection={currentSection}
        tenantName={dashboard.tenant.name}
      />

      <main className="mx-auto flex min-h-screen w-full max-w-[1280px] flex-col gap-4 px-4 py-5 pb-24 text-[color:var(--text-primary)] lg:px-8">
        <FlashNotice error={params.error} message={params.message} variant="overlay" />

        {currentSection === "dashboard" ? (
          <>
            {selectedActionAttendance ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--overlay-strong)] p-4 backdrop-blur-sm">
                <div className="w-full max-w-[620px] rounded-[32px] border border-[color:var(--surface-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--background)_98%,#000000_2%),color-mix(in_srgb,var(--surface-strong)_96%,#ffffff_4%))] p-6 shadow-[0_22px_80px_rgba(0,0,0,0.46)]">
                  <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--text-soft)]">Ações do atendimento</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">
                    {isAutomotiveTenant ? formatVehicleDisplayLabel(selectedActionAttendance.vehicles ?? {}) : selectedActionAttendance.customers?.name ?? "Atendimento"}
                  </h2>
                  <p className="mt-3 text-sm text-[color:var(--text-muted)]">
                    {selectedActionAttendance.customers?.name ?? "Cliente"} • {resolveAttendanceServiceDisplayName(selectedActionAttendance)}
                  </p>
                  <div className="mt-5 rounded-[24px] border border-white/10 bg-black/15 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/45">Serviços deste atendimento</p>
                    <div className="mt-3 space-y-2">
                      {(selectedActionAttendance.service_items ?? []).map((serviceItem) => (
                        <form key={serviceItem.id} action={toggleAttendanceServiceItemAction} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <input type="hidden" name="redirect_to" value={`/app/dashboard?attendanceId=${encodeURIComponent(selectedActionAttendance.id)}`} />
                          <input type="hidden" name="attendance_id" value={selectedActionAttendance.id} />
                          <input type="hidden" name="item_id" value={serviceItem.id} />
                          <input type="hidden" name="next_status" value={serviceItem.status === "completed" ? "pending" : "completed"} />
                          <button
                            className={`flex size-6 items-center justify-center rounded-full border text-xs font-semibold ${
                              serviceItem.status === "completed"
                                ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-100"
                                : "border-white/15 bg-black/20 text-white/50"
                            }`}
                          >
                            {serviceItem.status === "completed" ? "OK" : ""}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm ${serviceItem.status === "completed" ? "text-emerald-100" : "text-white"}`}>{serviceItem.name}</p>
                            <p className="mt-1 text-xs text-white/45">
                              {serviceItem.status === "completed"
                                ? "Concluído neste atendimento"
                                : serviceItem.estimated_minutes
                                  ? `${serviceItem.estimated_minutes} min estimados`
                                  : "Sem tempo definido"}
                            </p>
                          </div>
                        </form>
                      ))}
                    </div>
                  </div>
                  <div className="mt-6 grid gap-3">
                    <Link
                      href={cashHrefForAttendance(selectedActionAttendance, {
                        markDelivery: selectedActionAttendance.status === "ready",
                        identifierType: isAutomotiveTenant ? "plate" : "customer_name",
                        identifierValue: isAutomotiveTenant
                          ? selectedActionAttendance.vehicles?.plate ?? ""
                          : selectedActionAttendance.customers?.name ?? "",
                        description: isAutomotiveTenant
                          ? undefined
                          : `${selectedActionAttendance.customers?.name ?? "Cliente"} • ${resolveAttendanceServiceDisplayName(selectedActionAttendance)}`,
                      })}
                      className="flex min-h-12 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 text-sm font-semibold text-amber-100"
                    >
                      {selectedActionAttendance.payment_method === "pending" ? "Abrir cobrança" : "Abrir caixa"}
                    </Link>

                    {operationFlowLocked ? (
                      nextActionBox ? (
                        <form action={moveAttendanceToNextBoxAction}>
                          <input type="hidden" name="redirect_to" value="/app/dashboard" />
                          <input type="hidden" name="attendance_id" value={selectedActionAttendance.id} />
                          <input type="hidden" name="box_id" value={nextActionBox.id} />
                          <AuthSubmitButton
                            label={`Mover para ${nextActionBox.name}`}
                            pendingLabel="Movendo..."
                            className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950"
                          />
                        </form>
                      ) : null
                    ) : selectableActionBoxes.length > 0 ? (
                      <div className="rounded-[24px] border border-white/10 bg-black/15 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-white/45">Escolher destino</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {selectableActionBoxes.map((box) => (
                            <form key={box.id} action={moveAttendanceToNextBoxAction}>
                              <input type="hidden" name="redirect_to" value="/app/dashboard" />
                              <input type="hidden" name="attendance_id" value={selectedActionAttendance.id} />
                              <input type="hidden" name="box_id" value={box.id} />
                              <AuthSubmitButton
                                label={box.name}
                                pendingLabel="Movendo..."
                                className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white"
                              />
                            </form>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {selectedActionAttendance.status === "ready" && selectedActionAttendance.payment_method !== "pending" ? (
                      <form action={registerAttendanceDeliveryAction}>
                        <input type="hidden" name="redirect_to" value="/app/dashboard" />
                        <input type="hidden" name="attendance_id" value={selectedActionAttendance.id} />
                        <ConfirmSubmitButton
                          label="Registrar retirada"
                          pendingLabel="Registrando..."
                          confirmMessage="Confirmar retirada do serviço?"
                          className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-transparent bg-emerald-400 px-4 text-sm font-semibold text-slate-950"
                        />
                      </form>
                    ) : null}
                  </div>
                  <div className="mt-6">
                    <Link
                      href={hrefFor("dashboard")}
                      className="flex min-h-12 items-center justify-center rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 text-sm font-medium text-[color:var(--text-secondary)]"
                    >
                      Fechar
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}

            {selectedDeliveryAttendance ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--overlay-strong)] p-4 backdrop-blur-sm">
                <div className="w-full max-w-[560px] rounded-[32px] border border-[color:var(--surface-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--background)_98%,#000000_2%),color-mix(in_srgb,var(--surface-strong)_96%,#ffffff_4%))] p-6 shadow-[0_22px_80px_rgba(0,0,0,0.46)]">
                  <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--text-soft)]">Retirada</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">{selectedDeliveryAttendance.vehicles?.plate ?? "Veículo"}</h2>
                  <p className="mt-3 text-sm text-[color:var(--text-muted)]">
                    {selectedDeliveryAttendance.customers?.name ?? "Cliente"} • {resolveAttendanceServiceDisplayName(selectedDeliveryAttendance)}
                  </p>
                  <p className="mt-4 text-sm text-[color:var(--text-secondary)]">Confirmando a retirada, o carro sai do card de retirada agora.</p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <Link
                      href={hrefFor("dashboard")}
                      className="flex min-h-12 items-center justify-center rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 text-sm font-medium text-[color:var(--text-secondary)]"
                    >
                      Cancelar
                    </Link>
                    <form action={registerAttendanceDeliveryAction}>
                      <input type="hidden" name="redirect_to" value="/app/dashboard" />
                      <input type="hidden" name="attendance_id" value={selectedDeliveryAttendance.id} />
                      <ConfirmSubmitButton
                        label="Confirmar retirada"
                        pendingLabel="Confirmando..."
                        className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-transparent bg-emerald-400 px-4 text-sm font-semibold text-slate-950"
                      />
                    </form>
                  </div>
                </div>
              </div>
            ) : null}

            {operations.settings?.operations_mode === "boxes" ? (
              <>
                <OperationGridSection dashboard={dashboard} operations={operations} />
              </>
            ) : (
              <>
                {isAutomotiveTenant ? null : (
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <TopCard href={hrefFor("dashboard")} title="Operação" value={dashboard.stats.totalToday} note={`${dashboard.stats.finishing} em finalização`} />
                    <AppointmentsSummaryCard monthKey={operations.appointmentCalendar.key} count={operations.appointmentCalendar.scheduledCount} />
                    <TopCard href={hrefFor("dashboard", { drawer: "fila" })} title="Na fila" value={dashboard.stats.waiting} note={`${dashboard.stats.washing} em lavagem`} />
                    <TopCard href={hrefFor("dashboard", { drawer: "prontos" })} title="Prontos" value={dashboard.stats.ready} note={`Caixa ${dashboard.stats.cashStatus.toLowerCase()}`} />
                  </div>
                )}
                <AppointmentsSection operations={operations} />
                <SectionShell
                  eyebrow="Novo atendimento"
                  title="Cadastrar carro em menos de 30 segundos"
                  description="O serviço é escolhido neste atendimento. Se a placa já existir, o sistema reaproveita o carro cadastrado."
                >
                  <NewAttendanceForm operations={operations} redirectTo="/app/dashboard?drawer=novo" />
                </SectionShell>
              </>
            )}
          </>
        ) : null}

        {currentSection === "caixa" ? (
          <SectionShell
            eyebrow="Caixa"
            title="Fluxo de caixa do dia"
            description="Lance recebimentos e despesas com leitura rápida, histórico limpo e fechamento automático."
          >
            <div className="space-y-4">
              {!operations.cash.session ? (
                <div className="rounded-[28px] border border-white/10 bg-black/15 p-6">
                  <div className="max-w-xl">
                    <p className="text-lg font-semibold text-white">Abrir caixa</p>
                    <p className="mt-2 text-sm text-white/56">Defina o saldo inicial para liberar lançamentos e começar a operação financeira do dia.</p>
                  </div>
                  <form action={openCashSessionAction} className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
                    <input type="hidden" name="redirect_to" value="/app/dashboard?section=caixa" />
                    <div>
                      <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-white/42">Saldo inicial</label>
                      <CurrencyInput
                        name="opening_balance"
                        placeholder="R$ 0,00"
                        className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-base text-white outline-none"
                      />
                    </div>
                    <button className="mt-[22px] flex min-h-14 items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-6 text-sm font-semibold text-slate-950">
                      Abrir caixa
                    </button>
                  </form>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div className="hidden space-y-4">
                      <div className="rounded-[28px] border border-emerald-400/12 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(10,15,23,0.72))] p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-lg font-semibold text-white">Recebimentos</p>
                            <p className="mt-2 text-sm text-white/56">Serviços, adicionais e extras entram aqui. Se a placa estiver pronta para retirada, o pagamento também baixa o atendimento.</p>
                          </div>
                          <div className="rounded-full border border-emerald-300/16 bg-emerald-300/10 px-3 py-1 text-xs font-medium text-emerald-100">
                            Entrada
                          </div>
                        </div>

                        {shouldShowDeliveryBanner ? (
                          <div className="mt-5 rounded-[22px] border border-amber-300/18 bg-amber-300/10 p-4">
                            <p className="text-sm font-semibold text-white">
                              Este carro está no card de retirada.
                            </p>
                            <p className="mt-2 text-sm text-white/68">
                              Ao concluir o recebimento, o sistema pergunta se o carro já está saindo. Se você responder não, o pagamento é registrado e o carro continua em retirada no dashboard.
                            </p>
                          </div>
                        ) : null}

                        <form action={createCashEntryAction} className="mt-5 space-y-4">
                          <input type="hidden" name="redirect_to" value="/app/dashboard?section=caixa" />
                          <input type="hidden" name="kind" value="income" />
                          {cashAttendanceId ? <input type="hidden" name="attendance_id" value={cashAttendanceId} /> : null}

                          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_0.9fr_0.9fr]">
                            <div>
                              <label className="mb-2 flex min-h-[2.75rem] items-end text-xs font-medium uppercase leading-[1.15rem] tracking-[0.18em] text-white/42">Tipo de entrada</label>
                              <select name="entry_category" defaultValue="service" className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none">
                                <option value="service">Serviço</option>
                                <option value="addon">Adicional</option>
                                <option value="extra">Extra</option>
                                <option value="other_income">Outra entrada</option>
                              </select>
                            </div>
                            <div>
                              <label className="mb-2 flex min-h-[2.75rem] items-end text-xs font-medium uppercase leading-[1.15rem] tracking-[0.18em] text-white/42">Forma de pagamento</label>
                              <select name="payment_method" defaultValue="cash" className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none">
                                <option value="cash">Dinheiro</option>
                                <option value="pix">Pix</option>
                                <option value="card">Cartão</option>
                                <option value="pending">Pendente</option>
                              </select>
                            </div>
                            <div>
                              <label className="mb-2 flex min-h-[2.75rem] items-end text-xs font-medium uppercase leading-[1.15rem] tracking-[0.18em] text-white/42">Tipo do cartão</label>
                              <select name="card_kind" defaultValue="debit" className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none">
                                <option value="debit">Débito</option>
                                <option value="credit">Crédito</option>
                              </select>
                            </div>
                            <div>
                              <label className="mb-2 flex min-h-[2.75rem] items-end text-xs font-medium uppercase leading-[1.15rem] tracking-[0.18em] text-white/42">Valor</label>
                                <CurrencyInput
                                  name="amount"
                                  placeholder="R$ 0,00"
                                  defaultValue={effectiveCashAmount}
                                  className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-base font-semibold text-white outline-none"
                                />
                            </div>
                          </div>

                          <div className="grid gap-4 lg:grid-cols-[0.82fr_1.18fr]">
                            <div>
                              <label className="mb-2 flex min-h-[2.75rem] items-end text-xs font-medium uppercase leading-[1.15rem] tracking-[0.18em] text-white/42">Localizar por</label>
                                <select name="identifier_type" defaultValue={effectiveCashIdentifierType} className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none">
                                <option value="plate">Placa</option>
                                <option value="whatsapp">WhatsApp</option>
                                <option value="customer_name">Nome do cliente</option>
                              </select>
                            </div>
                            <div>
                              <label className="mb-2 flex min-h-[2.75rem] items-end text-xs font-medium uppercase leading-[1.15rem] tracking-[0.18em] text-white/42">Placa, WhatsApp ou nome</label>
                                <input
                                  name="identifier_value"
                                  defaultValue={effectiveCashIdentifierValue}
                                  placeholder="Ex.: ABC1D23, 11999999999 ou João"
                                  className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
                                />
                            </div>
                          </div>

                          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                            <div>
                              <label className="mb-2 flex min-h-[2.75rem] items-end text-xs font-medium uppercase leading-[1.15rem] tracking-[0.18em] text-white/42">Serviço ou adicional</label>
                              <input
                                name="item_name"
                                defaultValue={effectiveCashService}
                                placeholder="Lavagem completa, cheirinho, vitrificação..."
                                className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
                              />
                            </div>
                            <div>
                              <label className="mb-2 flex min-h-[2.75rem] items-end text-xs font-medium uppercase leading-[1.15rem] tracking-[0.18em] text-white/42">Observação</label>
                              <input
                                name="description"
                                defaultValue={effectiveCashDescription}
                                placeholder="Detalhe opcional do lançamento"
                                className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="mb-2 flex min-h-[2.75rem] items-end text-xs font-medium uppercase leading-[1.15rem] tracking-[0.18em] text-white/42">Data do recebimento</label>
                            <input
                              type="date"
                              name="effective_date"
                              className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
                            />
                          </div>

                          {shouldShowDeliveryBanner ? (
                            <DeliveryChoiceSubmitButton
                              label={cashSubmitLabel}
                              pendingLabel="Registrando..."
                              confirmMessage="Pagamento confirmado. O carro já está saindo do pátio?"
                              className="flex min-h-14 w-full items-center justify-center rounded-2xl border border-transparent bg-emerald-400 px-4 text-sm font-semibold text-slate-950"
                            />
                          ) : (
                            <ConfirmSubmitButton
                              label={cashSubmitLabel}
                              pendingLabel="Registrando..."
                              className="flex min-h-14 w-full items-center justify-center rounded-2xl border border-transparent bg-emerald-400 px-4 text-sm font-semibold text-slate-950"
                            />
                          )}
                        </form>
                      </div>

                      <div className="rounded-[28px] border border-rose-400/12 bg-[linear-gradient(180deg,rgba(244,63,94,0.08),rgba(10,15,23,0.72))] p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-lg font-semibold text-white">Saídas operacionais</p>
                            <p className="mt-2 text-sm text-white/56">Registre gastos do dia como insumos, fornecedores, alimentação, transporte e qualquer despesa do caixa.</p>
                          </div>
                          <div className="rounded-full border border-rose-300/16 bg-rose-300/10 px-3 py-1 text-xs font-medium text-rose-100">
                            Saída
                          </div>
                        </div>

                        <CashExpenseForm
                          formAction={createCashExpenseAction}
                          dailyPayouts={operations.cash.dailyPayouts
                            .filter((payout) => payout.status !== "paid")
                            .map((payout) => ({
                              employeeId: payout.employee_id,
                              name: payout.employees?.name ?? "Funcionário",
                              roleLabel: payout.employees?.role_label ?? "Equipe",
                              amount: payout.amount,
                            }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-[28px] border border-white/10 bg-black/15 p-6">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="text-lg font-semibold text-white">Resumo financeiro</p>
                            <p className="mt-2 text-sm text-white/56">Visão do caixa no período selecionado. O dia é exibido por padrão.</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
                            {([
                              ["day", "Hoje"],
                              ["week", "Semana"],
                              ["fortnight", "15 dias"],
                              ["month", "Mês"],
                              ["year", "Ano"],
                            ] as Array<[CashPeriod, string]>).map(([value, label]) => (
                              <Link
                                key={value}
                                href={hrefFor("caixa", { cashPeriod: value })}
                                className={`rounded-xl px-3 py-2 text-xs font-medium ${cashPeriod === value ? "bg-[var(--accent)] text-slate-950" : "text-white/62 hover:bg-white/8 hover:text-white"}`}
                              >
                                {label}
                              </Link>
                            ))}
                          </div>
                        </div>

                        <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">Status</p>
                            <p className="mt-1 text-sm font-semibold text-emerald-200">{dashboard.stats.cashStatus}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">Abertura</p>
                            <p className="mt-1 text-sm font-semibold text-white">{operations.cash.session ? formatTime(operations.cash.session.opened_at) : "Caixa fechado"}</p>
                          </div>
                        </div>

                        <div className="mt-5 space-y-3">
                          {[
                            ["Saldo inicial", formatCurrency(operations.cash.totals.openingBalance)],
                            ["Entradas totais", formatCurrency(operations.cash.totals.gross)],
                            ["Saídas totais", formatCurrency(operations.cash.totals.expenses)],
                            ["Saldo operacional", formatCurrency(operations.cash.totals.operationalBalance)],
                          ].map(([label, value]) => (
                            <div key={label} className="flex items-center justify-between gap-4 rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
                              <span className="text-sm text-white/62">{label}</span>
                              <span className="text-sm font-semibold text-white">{value}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <Link href={hrefFor("caixa", { cashDrawer: "entries", cashPeriod })} className="rounded-[18px] border border-emerald-400/16 bg-emerald-400/8 px-4 py-3 text-center text-sm font-medium text-emerald-100">
                            Recebimentos
                          </Link>
                          <Link href={hrefFor("caixa", { cashDrawer: "expenses", cashPeriod })} className="rounded-[18px] border border-rose-400/16 bg-rose-400/8 px-4 py-3 text-center text-sm font-medium text-rose-100">
                            Saídas
                          </Link>
                        </div>
                        <div className="mt-5 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-2">
                          <form action={closeCashSessionAction}>
                            <input type="hidden" name="redirect_to" value="/app/dashboard?section=caixa" />
                            <button className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white/82">
                              Fechar caixa do dia
                            </button>
                          </form>
                          <form action={endShiftAction}>
                            <input type="hidden" name="redirect_to" value="/login" />
                            <button className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 text-sm font-medium text-rose-100">
                              Encerrar expediente
                            </button>
                          </form>
                        </div>
                      </div>

                      <div className="rounded-[28px] border border-white/10 bg-black/15 p-6">
                        <p className="text-lg font-semibold text-white">Diárias da equipe</p>
                        <p className="mt-2 text-sm text-white/56">Presença marcada gera pendência. Quando pagar, marque como pago.</p>
                        <div className="mt-5 space-y-3">
                          {operations.cash.dailyPayouts.length === 0 ? (
                            <EmptyState text="Nenhuma diária gerada hoje." />
                          ) : (
                            operations.cash.dailyPayouts.map((payout) => (
                              <div key={payout.id} className="flex items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-white/5 p-4">
                                <div>
                                  <p className="text-sm font-semibold text-white">{payout.employees?.name ?? "Funcionário"}</p>
                                  <p className="mt-1 text-xs text-white/56">
                                    {payout.employees?.role_label ?? "Equipe"} • {formatCurrency(payout.amount)}
                                  </p>
                                </div>
                                {payout.status === "paid" ? (
                                  <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-100">
                                    Pago
                                  </div>
                                ) : (
                                  <form action={markDailyPayoutPaidAction}>
                                    <input type="hidden" name="redirect_to" value="/app/dashboard?section=caixa" />
                                    <input type="hidden" name="employee_id" value={payout.employee_id} />
                                    <button className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-medium text-amber-100">
                                      Marcar como pago
                                    </button>
                                  </form>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                    </div>
                  </div>

                  <div className="hidden rounded-[28px] border border-white/10 bg-black/15 p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-white">Sessão atual do caixa</p>
                        <p className="mt-2 text-sm text-white/56">Histórico do que já foi realizado na sessão aberta. Itens futuros ficam na visão mensal.</p>
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/74">
                        {operations.cash.entries.length} lançamento(s)
                      </div>
                    </div>

                    <div className="mt-5 space-y-3">
                      {operations.cash.entries.length === 0 ? (
                        <EmptyState text="Nenhuma movimentação registrada hoje." />
                      ) : (
                        operations.cash.entries.map((entry) => (
                          <div key={entry.id} className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${cashEntryCategoryTone(entry.description, entry.kind)}`}>
                                    {entry.kind === "income" ? "Entrada" : "Saída"}
                                  </span>
                                  <p className="text-sm font-semibold text-white">{formatCashEntryDescription(entry.description)}</p>
                                </div>
                                <p className="mt-2 text-xs text-white/56">
                                  {formatPaymentMethod(entry.payment_method)} • {formatTime(entry.created_at)}
                                </p>
                              </div>
                              <p className={`shrink-0 text-base font-semibold ${entry.kind === "income" ? "text-emerald-300" : "text-rose-300"}`}>
                                {entry.kind === "income" ? "+" : "-"}
                                {formatCurrency(entry.amount)}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            {operations.cash.insights ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <CashInsightBars title="De onde veio o dinheiro?" items={operations.cash.insights.incomeByCategory} tone="income" />
                <CashInsightBars title="Para onde foi o dinheiro?" items={operations.cash.insights.expenseByCategory} tone="expense" />
              </div>
            ) : null}
          </SectionShell>
        ) : null}

        {currentSection === "estoque" && inventoryWorkspace ? <InventorySection inventory={inventoryWorkspace} /> : null}

        {currentSection === "inteligencia" ? (
          <SectionShell eyebrow="Inteligência" title="Visão financeira" description="Transforme os lançamentos em decisões práticas para o negócio.">
            <div className="grid gap-4 lg:grid-cols-2">
              <CashInsightBars title="Receita por origem" items={operations.cash.insights?.incomeByCategory ?? []} tone="income" />
              <CashInsightBars title="Custos por categoria" items={operations.cash.insights?.expenseByCategory ?? []} tone="expense" />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <InfoMetric label="Receita no período" value={formatCurrency(operations.cash.totals.income)} tone="accent" />
              <InfoMetric label="Custos no período" value={formatCurrency(operations.cash.totals.expenses)} />
              <InfoMetric label="Saldo operacional" value={formatCurrency(operations.cash.totals.operationalBalance)} tone="accent" />
            </div>
          </SectionShell>
        ) : null}

        {currentSection === "crescendo" && tenantGrowthWorkspace ? <TenantGrowthSection workspace={tenantGrowthWorkspace} /> : null}

        {currentSection === "clientes" ? (
          <SectionShell
            eyebrow="Clientes"
            title="Relacionamento e histórico"
            description="Busque por nome, telefone ou placa. Cadastre clientes completos e acompanhe o histórico de lavagens pagas e pendentes."
            actions={
              <Link
                href={hrefFor("clientes", {
                  customer: params.customer ?? undefined,
                  clientSearch,
                  customerForm: showCustomerForm ? undefined : "1",
                })}
                className="rounded-2xl border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-950"
              >
                Cadastrar cliente
              </Link>
            }
          >
            <div className="grid gap-4 xl:grid-cols-[0.92fr_1.18fr]">
              <div className="rounded-[24px] border border-white/10 bg-black/15 p-5">
                <form method="get" className="flex flex-col gap-3 sm:flex-row">
                  <input type="hidden" name="section" value="clientes" />
                  {params.customer ? <input type="hidden" name="customer" value={params.customer} /> : null}
                  <input
                    type="text"
                    name="clientSearch"
                    defaultValue={clientSearch}
                    placeholder="Buscar por nome, telefone ou placa"
                    className="h-12 flex-1 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
                  />
                  <button className="rounded-2xl border border-white/10 bg-white/6 px-4 text-sm text-white/82">Buscar</button>
                </form>

                <div className="mt-4 space-y-3">
                  {operations.customersWithHistory.length === 0 ? (
                    <EmptyState text="Nenhum cliente encontrado com esse filtro." />
                  ) : (
                    operations.customersWithHistory.map((customer) => {
                      const isActive = operations.customerWorkspace?.customer.id === customer.id;
                      return (
                        <Link
                          key={customer.id}
                          href={hrefFor("clientes", {
                            customer: customer.id,
                            clientSearch,
                          })}
                          className={`block rounded-[22px] border p-4 ${
                            isActive
                              ? "border-[var(--accent)] bg-[linear-gradient(135deg,rgba(0,245,212,0.16),rgba(56,189,248,0.08))]"
                              : "border-white/10 bg-white/5"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-base font-semibold text-white">{customer.name}</p>
                              {isAutomotiveTenant ? (
                                <p className="mt-1 text-sm text-white/60">
                                  {customer.lastVehicle?.model ?? "Sem veículo"}
                                  {customer.lastVehicle?.color ? ` ${customer.lastVehicle.color}` : ""} • {customer.lastVehicle?.plate ?? "Sem placa"}
                                </p>
                              ) : null}
                              <p className="text-sm text-white/60">{customer.whatsapp ?? "Sem WhatsApp"}</p>
                            </div>
                            <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/74">Ver histórico</span>
                          </div>
                          <p className="mt-3 text-xs text-white/46">Última lavagem: {formatDate(customer.lastAttendanceAt)}</p>
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-black/15 p-5">
                {!operations.customerWorkspace ? (
                  <EmptyState text="Selecione um cliente para abrir o histórico detalhado." />
                ) : (
                  <div className="space-y-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-sm text-white/58">Cliente selecionado</p>
                        <h3 className="mt-1 text-2xl font-semibold text-white">{operations.customerWorkspace.customer.name}</h3>
                        <p className="mt-2 text-sm text-white/60">{operations.customerWorkspace.customer.trade_name ?? operations.customerWorkspace.customer.legal_name ?? "Cadastro simples"}</p>
                        <p className="text-sm text-white/60">{operations.customerWorkspace.customer.whatsapp ?? operations.customerWorkspace.customer.contact_phone_1 ?? "Sem contato principal"}</p>
                        <p className="text-sm text-white/60">{operations.customerWorkspace.customer.email ?? "Sem e-mail"}</p>
                        <p className="text-sm text-white/60">
                          Última lavagem: {formatDate(operations.customerWorkspace.lastAttendanceAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <Link
                          href="/app/dashboard#novo-atendimento"
                          className="rounded-2xl border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/82"
                        >
                          Novo atendimento
                        </Link>
                        <Link
                          href={hrefFor("clientes", {
                            customer: operations.customerWorkspace!.customer.id,
                            clientSearch,
                            quoteForm: "1",
                          })}
                          className="rounded-2xl border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-950"
                        >
                          Orçamento
                        </Link>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <InfoMetric label="Atendimentos" value={String(operations.customerWorkspace.attendances.length)} />
                      <InfoMetric label="Agendamentos" value={String(operations.customerWorkspace.appointments.length)} />
                      <InfoMetric
                        label={isAutomotiveTenant ? "Último carro" : "Contato principal"}
                        value={
                          isAutomotiveTenant
                            ? operations.customerWorkspace.lastVehicle?.plate ?? "Sem placa"
                            : operations.customerWorkspace.customer.whatsapp ??
                              operations.customerWorkspace.customer.contact_phone_1 ??
                              "Sem contato"
                        }
                        tone="accent"
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <InfoMetric
                        label="Pendentes"
                        value={String(operations.customerWorkspace.attendances.filter((attendance) => attendance.payment_method === "pending").length)}
                      />
                      <InfoMetric
                        label="Pagas"
                        value={String(operations.customerWorkspace.attendances.filter((attendance) => attendance.payment_method !== "pending").length)}
                      />
                      <InfoMetric
                        label="Documento"
                        value={operations.customerWorkspace.customer.document ?? "Não informado"}
                      />
                    </div>

                    {(operations.customerWorkspace.customer.street || operations.customerWorkspace.customer.city || operations.customerWorkspace.customer.state) ? (
                      <div className="rounded-[20px] border border-white/10 bg-white/5 p-4 text-sm text-white/68">
                        <p className="text-xs uppercase tracking-[0.18em] text-white/42">Endereço</p>
                        <p className="mt-2">
                          {[
                            operations.customerWorkspace.customer.street,
                            operations.customerWorkspace.customer.street_number,
                            operations.customerWorkspace.customer.complement,
                            operations.customerWorkspace.customer.neighborhood,
                            operations.customerWorkspace.customer.city,
                            operations.customerWorkspace.customer.state,
                            operations.customerWorkspace.customer.postal_code,
                          ]
                            .filter(Boolean)
                            .join(" • ")}
                        </p>
                      </div>
                    ) : null}

                    {isAutomotiveTenant ? (
                      <div>
                        <p className="text-base font-semibold text-white">Veículos vinculados</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {operations.customerWorkspace.vehicles.length === 0 ? (
                            <EmptyState text="Nenhum veículo cadastrado para este cliente ainda." />
                          ) : (
                            operations.customerWorkspace.vehicles.map((vehicle) => (
                              <div key={vehicle.id} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                                <p className="text-sm font-semibold text-white">{vehicle.model}</p>
                                <p className="mt-1 text-xs text-white/56">
                                  {vehicle.plate}
                                  {vehicle.brand ? ` • ${vehicle.brand}` : ""}
                                  {vehicle.color ? ` • ${vehicle.color}` : ""}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ) : null}

                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-base font-semibold text-white">Orçamentos</p>
                        <Link
                          href={hrefFor("clientes", {
                            customer: operations.customerWorkspace!.customer.id,
                            clientSearch,
                            quoteForm: "1",
                          })}
                          className="rounded-2xl border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/82"
                        >
                          Novo orçamento
                        </Link>
                      </div>
                      <div className="mt-3 space-y-3">
                        {operations.customerWorkspace.quotes.length === 0 ? (
                          <EmptyState text="Nenhum orçamento cadastrado para este cliente." />
                        ) : (
                          operations.customerWorkspace.quotes.map((quote) => (
                            <div key={quote.id} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                  <p className="text-sm font-semibold text-white">{quote.services?.name ?? "Sem serviço"}</p>
                                  <p className="mt-1 text-xs text-white/56">{quote.request_description}</p>
                                  {isAutomotiveTenant && quote.vehicles ? (
                                    <p className="mt-1 text-xs text-white/48">
                                      {quote.vehicles.model} • {quote.vehicles.plate}
                                    </p>
                                  ) : null}
                                  <p className="mt-2 text-xs text-white/48">
                                    Mão de obra {formatCurrency(quote.labor_amount)} • Peças {formatCurrency(quote.parts_amount)}
                                  </p>
                                </div>
                                <div className="flex flex-col items-start gap-2 lg:items-end">
                                  <span
                                    className={`rounded-full border px-3 py-1 text-xs ${
                                      quote.status === "approved"
                                        ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                                        : quote.status === "rejected"
                                          ? "border-rose-400/20 bg-rose-400/10 text-rose-100"
                                          : "border-amber-300/20 bg-amber-300/10 text-amber-100"
                                    }`}
                                  >
                                    {quote.status === "approved" ? "Aprovado" : quote.status === "rejected" ? "Rejeitado" : "Aberto"}
                                  </span>
                                  <p className="text-sm font-semibold text-white">{formatCurrency(quote.labor_amount + quote.parts_amount)}</p>
                                </div>
                              </div>
                              {quote.notes ? <p className="mt-3 text-xs text-white/48">{quote.notes}</p> : null}
                              {quote.status === "draft" ? (
                                <form action={approveServiceQuoteAction} className="mt-4">
                                  <input
                                    type="hidden"
                                    name="redirect_to"
                                    value={hrefFor("clientes", {
                                      customer: operations.customerWorkspace!.customer.id,
                                      clientSearch,
                                    })}
                                  />
                                  <input type="hidden" name="quote_id" value={quote.id} />
                                  <button className="flex min-h-12 items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950">
                                    Aprovado
                                  </button>
                                </form>
                              ) : null}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <div>
                        <p className="text-base font-semibold text-white">Lavagens a pagar</p>
                        <div className="mt-3 space-y-3">
                          {operations.customerWorkspace.attendances.filter((attendance) => attendance.payment_method === "pending").length === 0 ? (
                            <EmptyState text="Nenhuma lavagem pendente para este cliente." />
                          ) : (
                            operations.customerWorkspace.attendances.filter((attendance) => attendance.payment_method === "pending").map((attendance) => (
                              <div key={attendance.id} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-white">{attendance.serviceName ?? "Sem serviço"}</p>
                                    {isAutomotiveTenant ? (
                                      <p className="mt-1 text-xs text-white/56">
                                        {attendance.vehicle?.model ?? "Veículo"} • {attendance.vehicle?.plate ?? "Sem placa"}
                                      </p>
                                    ) : null}
                                  </div>
                                  <p className="text-sm font-semibold text-white">{formatCurrency(attendance.final_price)}</p>
                                </div>
                                <p className="mt-2 text-xs text-white/56">
                                  {formatStatus(attendance.status)} • {formatPaymentMethod(attendance.payment_method)} • {formatDateTime(attendance.created_at)}
                                </p>
                                {attendance.billing_mode === "fleet" && attendance.billing_due_date ? (
                                  <p className="mt-2 text-xs text-amber-100/80">Frota • cobrança em {attendance.billing_due_date}</p>
                                ) : null}
                                {attendance.media.length > 0 ? (
                                  <div className="mt-3 grid grid-cols-2 gap-2">
                                    {attendance.media.map((media) => (
                                      <div key={media.id} className="overflow-hidden rounded-[18px] border border-white/10 bg-black/20">
                                        {media.signed_url ? (
                                          <img src={media.signed_url} alt={`Foto ${media.kind}`} className="h-28 w-full object-cover" />
                                        ) : (
                                          <div className="flex h-28 items-center justify-center text-xs text-white/44">Sem preview</div>
                                        )}
                                        <div className="px-3 py-2 text-xs text-white/62">
                                          <p className="font-medium text-white/78">{media.kind === "ready" ? "Foto final" : "Foto da etapa"}</p>
                                          {media.caption ? <p className="mt-1">{media.caption}</p> : null}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="text-base font-semibold text-white">Lavagens já pagas</p>
                        <div className="mt-3 space-y-3">
                          {operations.customerWorkspace.attendances.filter((attendance) => attendance.payment_method !== "pending").length === 0 ? (
                            <EmptyState text="Nenhuma lavagem paga para este cliente." />
                          ) : (
                            operations.customerWorkspace.attendances.filter((attendance) => attendance.payment_method !== "pending").map((attendance) => (
                              <div key={attendance.id} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-white">{attendance.serviceName ?? "Sem serviço"}</p>
                                    {isAutomotiveTenant ? (
                                      <p className="mt-1 text-xs text-white/56">
                                        {attendance.vehicle?.model ?? "Veículo"} • {attendance.vehicle?.plate ?? "Sem placa"}
                                      </p>
                                    ) : null}
                                  </div>
                                  <p className="text-sm font-semibold text-white">{formatCurrency(attendance.final_price)}</p>
                                </div>
                                <p className="mt-2 text-xs text-white/56">
                                  {formatStatus(attendance.status)} • {formatPaymentMethod(attendance.payment_method)} • {formatDateTime(attendance.created_at)}
                                </p>
                                {attendance.billing_mode === "fleet" && attendance.billing_due_date ? (
                                  <p className="mt-2 text-xs text-amber-100/80">Frota • cobrança em {attendance.billing_due_date}</p>
                                ) : null}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-base font-semibold text-white">Agendamentos</p>
                      <div className="mt-3 space-y-3">
                        {operations.customerWorkspace.appointments.length === 0 ? (
                          <EmptyState text="Nenhum agendamento para este cliente." />
                        ) : (
                          operations.customerWorkspace.appointments.map((appointment) => (
                            <div key={appointment.id} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-white">{appointment.serviceName ?? "Sem serviço"}</p>
                                  {isAutomotiveTenant ? (
                                    <p className="mt-1 text-xs text-white/56">
                                      {appointment.vehicle?.model ?? "Veículo"} • {appointment.vehicle?.plate ?? "Sem placa"}
                                    </p>
                                  ) : null}
                                </div>
                                <p className="text-sm font-semibold text-white">{formatCurrency(appointment.servicePrice)}</p>
                              </div>
                              <p className="mt-2 text-xs text-white/56">
                                {formatStatus(appointment.status)} • {formatDateTime(appointment.scheduled_for)}
                              </p>
                              {appointment.notes ? <p className="mt-2 text-xs text-white/48">{appointment.notes}</p> : null}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </SectionShell>
        ) : null}

        {currentSection === "suporte" ? (
          <SectionShell
            eyebrow="Suporte"
            title="Fale com o suporte da plataforma"
            description="Abra um ticket sem sair do tenant. O administrativo recebe aqui e acompanha o andamento até a resolução."
          >
            <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
              <div className="rounded-[24px] border border-white/10 bg-black/15 p-5">
                <p className="text-base font-semibold text-white">Novo ticket</p>
                <p className="mt-2 text-sm text-white/56">Descreva o problema ou ajuste necessário. O suporte administrativo recebe no painel master.</p>
                <form action={createSupportTicketAction} className="mt-4 space-y-3">
                  <input type="hidden" name="redirect_to" value="/app/dashboard?section=suporte" />
                  <input
                    name="subject"
                    placeholder="Assunto"
                    className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
                  />
                  <textarea
                    name="description"
                    placeholder="Descreva com o máximo de clareza o que precisa ser resolvido."
                    rows={6}
                    className="w-full rounded-[22px] border border-white/10 bg-[#0f141b] px-4 py-3 text-sm text-white outline-none"
                  />
                  <button className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950">
                    Enviar ticket
                  </button>
                </form>
              </div>

              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <InfoMetric label="Abertos" value={String(support?.counts.open ?? 0)} tone="accent" />
                  <InfoMetric label="Em andamento" value={String(support?.counts.inProgress ?? 0)} />
                  <InfoMetric label="Resolvidos" value={String(support?.counts.resolved ?? 0)} />
                </div>

                <div className="rounded-[24px] border border-white/10 bg-black/15 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-white">Histórico de tickets</p>
                      <p className="mt-1 text-sm text-white/56">Acompanhe o que já foi aberto por este tenant.</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/74">
                      {support?.tickets.length ?? 0} ticket(s)
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {!support || support.tickets.length === 0 ? (
                      <EmptyState text="Nenhum ticket aberto por este tenant até agora." />
                    ) : (
                      support.tickets.map((ticket) => (
                        <div key={ticket.id} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">{ticket.subject}</p>
                              <p className="mt-1 text-xs text-white/56">{formatDateTime(ticket.created_at)}</p>
                            </div>
                            <span className={`rounded-full border px-3 py-1 text-xs ${supportStatusTone(ticket.status)}`}>
                              {formatSupportStatus(ticket.status)}
                            </span>
                          </div>
                          {ticket.description ? <p className="mt-3 text-sm text-white/62">{ticket.description}</p> : null}
                          {ticket.admin_reply ? (
                            <div className="mt-3 rounded-[16px] border border-sky-400/20 bg-sky-400/10 p-3">
                              <p className="text-xs uppercase tracking-[0.18em] text-sky-100/70">Resposta do suporte</p>
                              <p className="mt-2 text-sm text-white/82">{ticket.admin_reply}</p>
                              {ticket.admin_reply_at ? <p className="mt-2 text-xs text-white/50">{formatDateTime(ticket.admin_reply_at)}</p> : null}
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </SectionShell>
        ) : null}

        {currentSection === "adm" ? (
          <>
            <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(0,245,212,0.14),_transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] p-5 shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-white/42">Administração</p>
                  <h2 className="mt-2 text-3xl font-semibold text-white lg:text-4xl">Administração</h2>
                </div>

                <div className="-mx-1 overflow-x-auto px-1 pb-1">
                  <div className="flex min-w-max flex-wrap gap-3">
                    <AdmTab href="/app/landing" title="Landing" active={false} tone="accent" />
                    <AdmTab href={hrefFor("adm", { panel: "reports" })} title="Relatórios" active={admPanel === "reports"} />
                    <AdmTab href={hrefFor("adm", { panel: "services" })} title="Serviços" active={admPanel === "services"} />
                    <AdmTab href={hrefFor("adm", { panel: "employees" })} title="Equipe" active={admPanel === "employees"} />
                    <AdmTab href={hrefFor("adm", { panel: "social" })} title="Redes" active={admPanel === "social"} />
                    <AdmTab href={hrefFor("adm", { panel: "settings" })} title="Configurações" active={admPanel === "settings"} />
                  </div>
                </div>
              </div>
            </section>

            {admPanel === "reports" ? (
              <SectionShell eyebrow="Relatórios" title="Resumo operacional" description="Visão rápida dos números principais sem sair da área administrativa do tenant.">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {reports ? (
                    <>
                      <InfoMetric label="Hoje" value={`${reports.today.washes} lavagens`} tone="accent" />
                      <InfoMetric label="Faturamento" value={reports.today.revenue} />
                      <InfoMetric label="Ticket médio" value={reports.today.ticket} />
                      <InfoMetric label="Mais vendido" value={reports.today.topService} />
                      <InfoMetric label="Semana" value={reports.weekRevenue} />
                      <InfoMetric label="Mês" value={reports.monthRevenue} />
                    </>
                  ) : null}
                </div>
              </SectionShell>
            ) : null}

            {admPanel === "services" ? (
              <SectionShell
                eyebrow="Serviços"
                title={isAutomotiveTenant ? "Cadastro lógico de serviços" : "Catálogo de serviços"}
                description={
                  isAutomotiveTenant
                    ? "Cadastre o serviço base ou complemente um serviço já existente. O sistema soma tempo e valores automaticamente quando houver complemento."
                    : "Cadastre serviços do tenant com tempo padrão, valor e complemento opcional sobre um serviço já existente."
                }
              >
                <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,300px)]">
                  <div className="min-w-0 rounded-[24px] border border-white/10 bg-black/15 p-5">
                    <p className="text-base font-semibold text-white">Novo serviço</p>
                    <form action={editingService ? updateServiceAction : createServiceAction} className="mt-4 space-y-3">
                      <input type="hidden" name="redirect_to" value="/app/dashboard?section=adm&panel=services" />
                      {editingService ? <input type="hidden" name="service_id" value={editingService.id} /> : null}
                      <input name="name" defaultValue={editingService?.name ?? ""} placeholder="Nome do serviço" className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                      <input
                        name="short_description"
                        defaultValue={editingService?.short_description ?? ""}
                        placeholder="Descrição curta"
                        className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
                      />
                      <select name="base_service_id" defaultValue={editingService?.base_service_id ?? ""} className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none">
                        <option value="">{isAutomotiveTenant ? "Complemento de serviço: nenhum" : "Serviço base para complementar: nenhum"}</option>
                        {operations.services
                          .filter((service) => service.id !== editingService?.id)
                          .map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.name}
                          </option>
                          ))}
                      </select>
                      {isAutomotiveTenant ? (
                        <div className="min-w-0 space-y-3 rounded-[22px] border border-white/10 bg-black/12 p-4">
                          <div className="grid grid-cols-[64px_repeat(3,minmax(0,1fr))] gap-2 text-xs uppercase tracking-[0.12em] text-white/42">
                            <span>Porte</span>
                            <span>Tempo</span>
                            <span>Particular</span>
                            <span>App</span>
                          </div>
                          <div className="grid grid-cols-[64px_repeat(3,minmax(0,1fr))] gap-2 lg:grid-cols-[64px_112px_128px_128px] [&>input]:h-10 [&>input]:min-w-0 [&>input]:rounded-xl [&>input]:px-2 [&>input]:text-xs">
                            <span className="flex items-center text-sm text-white/72">Pequeno</span>
                            <DurationInput name="minutes_passeio" defaultValue={editingService ? formatDurationInput(serviceFormMinutesValue(editingService, "passeio")) : undefined} placeholder="45 ou 1:20" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                            <CurrencyInput name="price_passeio" defaultValue={editingService ? formatCurrency(serviceFormPriceValue(editingService, "passeio")) : undefined} placeholder="R$ 0,00" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                            <CurrencyInput name="price_app_passeio" defaultValue={editingService ? formatCurrency(serviceFormPriceValue(editingService, "passeio", "app")) : undefined} placeholder="R$ 0,00" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                          </div>
                          <div className="grid grid-cols-[64px_repeat(3,minmax(0,1fr))] gap-2 lg:grid-cols-[64px_112px_128px_128px] [&>input]:h-10 [&>input]:min-w-0 [&>input]:rounded-xl [&>input]:px-2 [&>input]:text-xs">
                            <span className="flex items-center text-sm text-white/72">Médio</span>
                            <DurationInput name="minutes_medio" defaultValue={editingService ? formatDurationInput(serviceFormMinutesValue(editingService, "medio")) : undefined} placeholder="45 ou 1:20" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                            <CurrencyInput name="price_medio" defaultValue={editingService ? formatCurrency(serviceFormPriceValue(editingService, "medio")) : undefined} placeholder="R$ 0,00" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                            <CurrencyInput name="price_app_medio" defaultValue={editingService ? formatCurrency(serviceFormPriceValue(editingService, "medio", "app")) : undefined} placeholder="R$ 0,00" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                          </div>
                          <div className="grid grid-cols-[64px_repeat(3,minmax(0,1fr))] gap-2 lg:grid-cols-[64px_112px_128px_128px] [&>input]:h-10 [&>input]:min-w-0 [&>input]:rounded-xl [&>input]:px-2 [&>input]:text-xs">
                            <span className="flex items-center text-sm text-white/72">Grande</span>
                            <DurationInput name="minutes_grande" defaultValue={editingService ? formatDurationInput(serviceFormMinutesValue(editingService, "grande")) : undefined} placeholder="45 ou 1:20" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                            <CurrencyInput name="price_grande" defaultValue={editingService ? formatCurrency(serviceFormPriceValue(editingService, "grande")) : undefined} placeholder="R$ 0,00" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                            <CurrencyInput name="price_app_grande" defaultValue={editingService ? formatCurrency(serviceFormPriceValue(editingService, "grande", "app")) : undefined} placeholder="R$ 0,00" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                          </div>
                          <div className="grid grid-cols-[64px_repeat(3,minmax(0,1fr))] gap-2 lg:grid-cols-[64px_112px_128px_128px] [&>input]:h-10 [&>input]:min-w-0 [&>input]:rounded-xl [&>input]:px-2 [&>input]:text-xs">
                            <span className="flex items-center text-sm text-white/72">X Grande</span>
                            <DurationInput name="minutes_bem_grande" defaultValue={editingService ? formatDurationInput(serviceFormMinutesValue(editingService, "bem_grande")) : undefined} placeholder="45 ou 1:20" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                            <CurrencyInput name="price_bem_grande" defaultValue={editingService ? formatCurrency(serviceFormPriceValue(editingService, "bem_grande")) : undefined} placeholder="R$ 0,00" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                            <CurrencyInput name="price_app_bem_grande" defaultValue={editingService ? formatCurrency(serviceFormPriceValue(editingService, "bem_grande", "app")) : undefined} placeholder="R$ 0,00" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 rounded-[22px] border border-white/10 bg-black/12 p-4">
                            <div className="grid gap-3 text-xs uppercase tracking-[0.2em] text-white/42 md:grid-cols-2">
                              <span>Tempo padrão</span>
                              <span>Particular</span>
                              <span>App</span>
                            </div>
                          <div className="grid gap-3 md:grid-cols-3">
                            <DurationInput
                              name="minutes_default"
                              defaultValue={editingService ? formatDurationInput(serviceFormMinutesValue(editingService, "passeio")) : undefined}
                              placeholder="45 ou 1:20"
                              className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
                            />
                            <CurrencyInput
                              name="price_default"
                              defaultValue={editingService ? formatCurrency(serviceFormPriceValue(editingService, "passeio")) : undefined}
                              placeholder="R$ 0,00"
                              className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
                            />
                            <CurrencyInput
                              name="price_app_default"
                              defaultValue={editingService ? formatCurrency(serviceFormPriceValue(editingService, "passeio", "app")) : undefined}
                              placeholder="R$ 0,00"
                              className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
                            />
                            <select
                              name="time_unit"
                              defaultValue={editingService?.time_unit ?? "minutes"}
                              className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none md:col-span-3"
                            >
                              <option value="minutes">Minutos</option>
                              <option value="hours_minutes">Horas e minutos</option>
                              <option value="days">Dias</option>
                              <option value="weeks">Semanas</option>
                              <option value="months">Meses</option>
                            </select>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
                            {editingService?.base_service_id
                              ? "Neste serviço complementar, informe apenas o tempo e o valor adicionais que serão somados ao serviço base."
                              : "Neste tenant genérico o serviço usa um único tempo padrão e dois valores: Particular e App. O sistema entende minutos, horas e minutos, dias, semanas e meses."}
                          </div>
                        </div>
                      )}
                      <button className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950">
                        {editingService ? "Salvar serviço" : "Criar serviço"}
                      </button>
                    </form>
                  </div>

                  <div className="min-w-0 overflow-hidden rounded-[24px] border border-white/10 bg-black/15 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-white">Serviços ativos</p>
                        <p className="mt-1 text-sm text-white/56">{isAutomotiveTenant ? "Catálogo atual do lava-rápido." : "Catálogo atual de serviços do tenant."}</p>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/74">
                        {operations.services.length} ativos
                      </span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {operations.services.length === 0 ? (
                        <EmptyState text="Nenhum serviço ativo cadastrado." />
                      ) : (
                        operations.services.map((service) => (
                          <Link
                            key={service.id}
                            href={hrefFor("adm", { panel: "services", service: service.id })}
                            className={`block rounded-[20px] border p-4 ${editingService?.id === service.id ? "border-[var(--accent)] bg-[linear-gradient(135deg,rgba(0,245,212,0.16),rgba(56,189,248,0.08))]" : "border-white/10 bg-white/5"}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-white">{service.name}</p>
                                <p className="mt-1 text-xs text-white/56">{service.short_description ?? "Sem descrição curta"}</p>
                                {service.base_service?.name ? (
                                  <p className="mt-1 text-xs text-[var(--accent)]">{isAutomotiveTenant ? "Complementa" : "Serviço base"}: {service.base_service.name}</p>
                                ) : null}
                              </div>
                              <p className="text-sm font-semibold text-white">{formatCurrency(Number(service.price_passeio ?? service.price))}</p>
                            </div>
                            {isAutomotiveTenant ? (
                              <>
                                <p className="mt-2 text-xs text-white/56">
                                  Pequeno {service.minutes_passeio} min / Particular {formatCurrency(Number(service.price_passeio ?? service.price))} / App {formatCurrency(Number(service.price_app_passeio ?? service.price_passeio ?? service.price))}
                                </p>
                                <p className="mt-1 text-xs text-white/56">
                                  Médio {service.minutes_medio} min / {formatCurrency(Number(service.price_medio ?? service.price))} • Grande {service.minutes_grande} min / {formatCurrency(Number(service.price_grande ?? service.price))}
                                </p>
                                <p className="mt-1 text-xs text-white/48">
                                  App: Médio {formatCurrency(Number(service.price_app_medio ?? service.price_medio ?? service.price))} • Grande {formatCurrency(Number(service.price_app_grande ?? service.price_grande ?? service.price))} • X Grande {formatCurrency(Number(service.price_app_bem_grande ?? service.price_bem_grande ?? service.price))}
                                  {service.base_service_id ? " • composto" : ""}
                                </p>
                              </>
                            ) : (
                              <p className="mt-2 text-xs text-white/56">
                                {serviceTimeLabel(service)} / Particular {formatCurrency(Number(service.price_passeio ?? service.price))} / App {formatCurrency(Number(service.price_app_passeio ?? service.price_passeio ?? service.price))}
                                {service.base_service_id ? " • complementar" : " • principal"}
                              </p>
                            )}
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </SectionShell>
            ) : null}

            {admPanel === "employees" ? (
              <SectionShell eyebrow="Funcionários" title="Equipe e presença" description="Cadastre a equipe, defina acesso ao sistema e acompanhe presença em tempo real.">
                <div className="grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
                  <div className="hidden xl:block" />

                  <div className="rounded-[24px] border border-white/10 bg-black/15 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-white">Equipe cadastrada</p>
                        <p className="mt-1 text-sm text-white/56">Lista atual com presença e forma de pagamento.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/74">
                          {operations.employees.filter((employee) => employee.is_present).length} presentes
                        </span>
                        <Link
                          href={hrefFor("adm", { panel: "employees", employeeId: "new" })}
                          className="rounded-full border border-[var(--accent)] bg-[var(--accent)]/15 px-4 py-2 text-xs font-medium text-[var(--accent)]"
                        >
                          Novo funcionário
                        </Link>
                      </div>
                    </div>
                    <div className="mt-4 space-y-3">
                      {operations.employees.length === 0 ? (
                        <EmptyState text="Nenhum funcionário cadastrado." />
                      ) : (
                        operations.employees.map((employee) => (
                          <div
                            key={employee.id}
                            className="rounded-[20px] border border-white/10 bg-white/5 p-4 transition hover:border-[var(--accent)] hover:bg-white/[0.08]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-white">{employee.name}</p>
                                <p className="mt-1 text-xs text-white/56">
                                  {employee.role_label} • {employee.can_access_system ? "Acesso liberado" : "Sem acesso"}
                                </p>
                                <p className="mt-1 text-xs text-white/56">
                                  {employee.payment_type === "daily" ? "Diária" : employee.payment_type === "commission" ? "Comissão" : "Fixo"} •{" "}
                                  {formatCurrency(Number(employee.payment_value))}
                                </p>
                                <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-white/36">Clique para ver e editar</p>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <span
                                  className={`rounded-full border px-3 py-1 text-xs ${
                                    employee.current_session_logged_in_at || employee.is_present
                                      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                                      : "border-white/10 bg-white/6 text-white/70"
                                  }`}
                                >
                                  {employee.current_session_logged_in_at ? "Logado" : employee.is_present ? "Presente" : "Ausente"}
                                </span>
                                <Link
                                  href={hrefFor("adm", { panel: "employees", employeeId: employee.id })}
                                  className="rounded-full border border-[var(--accent)] bg-[var(--accent)]/15 px-3 py-1 text-xs font-medium text-[var(--accent)]"
                                >
                                  Ver dados
                                </Link>
                              </div>
                            </div>
                            {employee.can_access_system ? (
                              <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/72">
                                {employee.current_session_logged_in_at
                                  ? `Logado desde ${formatDateTime(employee.current_session_logged_in_at)}`
                                  : employee.is_present
                                    ? "Presente hoje, fora do sistema no momento."
                                    : "Sem login ativo no momento."}
                              </div>
                            ) : (
                              <form action={toggleEmployeePresenceAction} className="mt-3">
                                <input type="hidden" name="redirect_to" value="/app/dashboard?section=adm&panel=employees" />
                                <input type="hidden" name="employee_id" value={employee.id} />
                                <input type="hidden" name="is_present" value={employee.is_present ? "false" : "true"} />
                                <button className="flex min-h-11 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white/82">
                                  {employee.is_present ? "Marcar ausência" : "Marcar presença"}
                                </button>
                              </form>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </SectionShell>
            ) : null}

            {admPanel === "settings" ? (
              <SectionShell eyebrow="Configurações operacionais" title="Mensagens e permissões" description="Ajuste tempos padrão, mensagens automáticas e o que o operador pode ver ou editar.">
                <div className="mb-4 grid gap-4 xl:grid-cols-[1fr_0.9fr]">
                  <div className="rounded-[24px] border border-white/10 bg-black/15 p-5">
                    <p className="text-base font-semibold text-white">Conexão técnica e status</p>
                    <div className="mt-4 space-y-3 text-sm text-white/60">
                      <p>As mensagens de entrada, execução, finalização, serviço concluído e lembrete são configuradas pelo próprio tenant na área de mensagens automáticas.</p>
                      <p>A conexão da Evolution, instância e chave ficam protegidas no administrativo da plataforma e não aparecem nesta tela.</p>
                      <p>Se o WhatsApp estiver desligado ou sem conexão, o suporte ajusta isso sem expor credenciais operacionais.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <InfoMetric label="Status" value={operations.settings?.evolution_enabled ? "Ativa" : "Desligada"} tone="accent" />
                      <InfoMetric label="Instância" value={operations.settings?.evolution_instance ?? "Gerenciada pelo suporte"} />
                    </div>

                    <div className="rounded-[24px] border border-white/10 bg-black/15 p-5 text-sm text-white/56">
                      A gestão técnica do provedor fica isolada por tenant e é feita no administrativo da plataforma.
                    </div>
                  </div>
                </div>

                <form action={saveTenantSettingsAction} className="grid gap-4 xl:grid-cols-2">
                  <input type="hidden" name="redirect_to" value="/app/dashboard?section=adm&panel=settings" />
                  <div className="rounded-[24px] border border-white/10 bg-black/15 p-5">
                    <p className="text-base font-semibold text-white">Operação</p>
                    <div className="mt-4 space-y-3">
                      <select
                        name="operations_mode"
                        defaultValue={operations.settings?.operations_mode ?? "classic"}
                        className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
                      >
                        <option value="classic">Modo clássico</option>
                        <option value="boxes">Grid de boxes</option>
                      </select>
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/42">Tempo padrão dos serviços</span>
                        <input
                          name="default_service_minutes"
                          defaultValue={operations.settings?.default_service_minutes ?? ""}
                          placeholder="Sem tempo padrão"
                          className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
                        />
                      </label>
                      <input type="hidden" name="operator_can_edit_status" value="false" />
                      <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                        <input
                          type="checkbox"
                          name="operator_can_edit_status"
                          value="true"
                          defaultChecked={operations.settings?.operator_can_edit_status ?? false}
                          className="size-4"
                        />
                        Operador pode corrigir status
                      </label>
                      <input type="hidden" name="operator_can_view_all_cars" value="false" />
                      <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                        <input
                          type="checkbox"
                          name="operator_can_view_all_cars"
                          value="true"
                          defaultChecked={operations.settings?.operator_can_view_all_cars ?? false}
                          className="size-4"
                        />
                        Operador pode ver todos os serviços
                      </label>
                      <input type="hidden" name="operator_can_view_customer_phone" value="false" />
                      <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                        <input
                          type="checkbox"
                          name="operator_can_view_customer_phone"
                          value="true"
                          defaultChecked={operations.settings?.operator_can_view_customer_phone ?? false}
                          className="size-4"
                        />
                        Operador pode ver telefone do cliente
                      </label>
                      <input type="hidden" name="operator_inventory_enabled" value="false" />
                      <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                        <input
                          type="checkbox"
                          name="operator_inventory_enabled"
                          value="true"
                          defaultChecked={operations.settings?.operator_inventory_enabled ?? false}
                          className="size-4"
                        />
                        Operador pode acessar e movimentar o estoque
                      </label>
                      <input type="hidden" name="tv_mode_enabled" value="false" />
                      <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                        <input
                          type="checkbox"
                          name="tv_mode_enabled"
                          value="true"
                          defaultChecked={operations.settings?.tv_mode_enabled ?? false}
                          className="size-4"
                        />
                        Habilitar leitura para TV da operação
                      </label>
                      <input type="hidden" name="operation_flow_locked" value="false" />
                      <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                        <input
                          type="checkbox"
                          name="operation_flow_locked"
                          value="true"
                          defaultChecked={operations.settings?.operation_flow_locked ?? true}
                          className="size-4"
                        />
                        Travar fluxo e seguir a ordem dos boxes
                      </label>
                      <input type="hidden" name="require_ready_photo" value="false" />
                      <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                        <input
                          type="checkbox"
                          name="require_ready_photo"
                          value="true"
                          defaultChecked={operations.settings?.require_ready_photo ?? false}
                          className="size-4"
                        />
                        Exigir foto no serviço concluído
                      </label>
                      <input type="hidden" name="allow_step_photos" value="false" />
                      <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                        <input
                          type="checkbox"
                          name="allow_step_photos"
                          value="true"
                          defaultChecked={operations.settings?.allow_step_photos ?? true}
                          className="size-4"
                        />
                        Permitir fotos por etapa do serviço
                      </label>
                      <button className="mt-2 flex min-h-12 w-full items-center justify-center rounded-2xl border border-cyan-300/45 bg-[linear-gradient(135deg,var(--accent),#7dd3fc)] px-4 text-sm font-semibold text-slate-950 shadow-[0_16px_40px_rgba(34,211,238,0.22)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_52px_rgba(34,211,238,0.32)]">
                        Salvar operação
                      </button>
                    </div>
                  </div>

                  <div className="xl:col-span-2 rounded-[24px] border border-white/10 bg-black/15 p-5">
                    <p className="text-base font-semibold text-white">Classificação dos veículos</p>
                    <p className="mt-2 text-sm text-white/56">Defina em qual porte cada tipo entra no cálculo de preço. Esta configuração é exclusiva deste tenant.</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {vehicleTypeOptions.map((option) => (
                        <label key={option.code} className="grid gap-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/42">{option.label}</span>
                          <select
                            name={`vehicle_tier_${option.code}`}
                            defaultValue={operations.settings?.vehicle_type_tier_overrides?.[option.code] ?? option.tier}
                            className="h-11 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-3 text-sm text-white outline-none"
                          >
                            <option value="passeio">Pequeno</option>
                            <option value="medio">Médio</option>
                            <option value="grande">Grande</option>
                            <option value="bem_grande">X Grande</option>
                          </select>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-black/15 p-5">
                    <p className="text-base font-semibold text-white">Mensagens automáticas</p>
                    <div className="mt-2 text-sm text-white/56">
                      {operations.settings?.customer_messages_enabled
                        ? "Escolha em quais etapas o sistema dispara mensagem para o cliente."
                        : "O Admin Master ainda precisa liberar o uso das mensagens automáticas para este tenant."}
                    </div>
                  </div>

                  <TenantMessageSettings
                    isUnlocked={operations.settings?.customer_messages_enabled ?? false}
                    queueEntryEnabled={operations.settings?.queue_entry_message_enabled ?? true}
                    queueEntryMessage={operations.settings?.queue_entry_message ?? ""}
                    washStartEnabled={operations.settings?.wash_start_message_enabled ?? false}
                    washStartMessage={operations.settings?.wash_start_message ?? ""}
                    finishingEnabled={operations.settings?.finishing_message_enabled ?? false}
                    finishingMessage={operations.settings?.finishing_message ?? ""}
                    readyEnabled={operations.settings?.ready_message_enabled ?? true}
                    readyMessage={operations.settings?.ready_message ?? ""}
                    returnReminderMessage={operations.settings?.return_reminder_message ?? ""}
                    returnReminderEnabled={operations.settings?.return_reminder_enabled ?? false}
                    returnReminderDays={operations.settings?.return_reminder_days ?? 30}
                    returnReminderTime={operations.settings?.return_reminder_time ?? "09:00"}
                  />

                  <div className="xl:col-span-2">
                    <button className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950">
                      Salvar configurações
                    </button>
                  </div>
                </form>

                <div className="mt-4 grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
                  <div className="rounded-[24px] border border-white/10 bg-black/15 p-5">
                    <p className="text-base font-semibold text-white">Novo posto operacional</p>
                    <form action={createOperationBoxAction} className="mt-4 space-y-3">
                      <input type="hidden" name="redirect_to" value="/app/dashboard?section=adm&panel=settings#boxes-cadastrados" />
                      <div className="grid gap-2">
                        <p className="text-xs uppercase tracking-[0.16em] text-white/42">Nome do posto</p>
                        <input name="name" placeholder="Ex.: Elevador 1, Elevador 2, Mesa de conferencia" className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                          <p className="text-xs uppercase tracking-[0.16em] text-white/42">Etapa do processo</p>
                          <select name="kind" defaultValue="wash" className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none">
                            <option value="entry">Entrada</option>
                            <option value="wash">Execução</option>
                            <option value="dry">Conferência</option>
                            <option value="finish">Finalização</option>
                            <option value="ready">Concluído</option>
                          </select>
                        </div>
                        <div className="grid gap-2">
                          <p className="text-xs uppercase tracking-[0.16em] text-white/42">Posição na esteira</p>
                          <select name="sort_order" defaultValue={String(operations.operationBoxes.length + 1)} className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none">
                            {Array.from({ length: operations.operationBoxes.length + 1 }, (_, index) => index + 1).map((position) => (
                              <option key={position} value={position}>
                                {position}o lugar
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                          <p className="text-xs uppercase tracking-[0.16em] text-white/42">Tempo</p>
                          <input name="sla_value" placeholder="Tempo" className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                        </div>
                        <div className="grid gap-2">
                          <p className="text-xs uppercase tracking-[0.16em] text-white/42">Prazo</p>
                          <select name="sla_unit" defaultValue="none" className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none">
                            {operationBoxTimeUnitOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/52">
                        Cada posto pertence a uma etapa do processo. Se dois postos fizerem a mesma funcao, use a mesma etapa. Exemplo: Elevador 1 e Elevador 2 ficam em Execucao. A ordem define em que momento essa etapa aparece no fluxo.
                      </div>
                      <button className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950">
                        Criar posto
                      </button>
                    </form>
                  </div>

                  <div id="boxes-cadastrados" className="rounded-[24px] border border-white/10 bg-black/15 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-white">Boxes cadastrados</p>
                        <p className="mt-1 text-sm text-white/56">Ajuste nome do posto, etapa do processo, prazo e posicao no fluxo.</p>
                        <p className="mt-1 text-xs text-white/42">Postos com a mesma etapa funcionam em paralelo. Exemplo: Elevador 1 e Elevador 2 podem ser ambos da etapa Execucao.</p>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/74">
                        {operations.operationBoxes.length} boxes
                      </span>
                    </div>
                    <form action={saveOperationBoxesAction} className="mt-4 space-y-3">
                      <input type="hidden" name="redirect_to" value="/app/dashboard?section=adm&panel=settings#boxes-cadastrados" />
                      {operations.operationBoxes.map((box) => (
                        <div key={box.id} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                          <input type="hidden" name={`box_id__${box.id}`} value={box.id} />
                          <input type="hidden" name={`code__${box.id}`} value={box.code} />
                          <input type="hidden" name={`color_token__${box.id}`} value={box.color_token ?? ""} />
                          <div className="grid gap-3 lg:grid-cols-2">
                            <div className="grid gap-2">
                              <p className="text-[11px] uppercase tracking-[0.16em] text-white/42">Nome do posto</p>
                              <input name={`name__${box.id}`} defaultValue={box.name} className="h-11 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                            </div>
                            <div className="grid gap-2">
                              <p className="text-[11px] uppercase tracking-[0.16em] text-white/42">Etapa do processo</p>
                              <select name={`kind__${box.id}`} defaultValue={box.kind} className="h-11 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none">
                                <option value="entry">Entrada</option>
                                <option value="wash">Execução</option>
                                <option value="dry">Conferência</option>
                                <option value="finish">Finalização</option>
                                <option value="ready">Concluído</option>
                              </select>
                            </div>
                            <div className="grid gap-2">
                              <p className="text-[11px] uppercase tracking-[0.16em] text-white/42">Tempo</p>
                              <input name={`sla_value__${box.id}`} defaultValue={formatOperationBoxDurationValue(box.sla_minutes, box.sla_unit)} placeholder="Tempo" className="h-11 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                            </div>
                            <div className="grid gap-2">
                              <p className="text-[11px] uppercase tracking-[0.16em] text-white/42">Prazo</p>
                              <select
                                name={`sla_unit__${box.id}`}
                                defaultValue={box.sla_minutes ? (box.sla_unit ?? "minutes") : "none"}
                                className="h-11 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
                              >
                                {operationBoxTimeUnitOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="mt-3 grid gap-2">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-white/42">Ordem na esteira</p>
                            <select name={`sort_order__${box.id}`} defaultValue={String(box.sort_order)} className="h-11 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none">
                              {Array.from({ length: operations.operationBoxes.length }, (_, index) => index + 1).map((position) => (
                                <option key={position} value={position}>
                                  {position}o lugar
                                </option>
                              ))}
                            </select>
                          </div>
                          <label className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white/80">
                            <input type="hidden" name={`is_active__${box.id}`} value="false" />
                            <input type="checkbox" name={`is_active__${box.id}`} value="true" defaultChecked={box.is_active} className="size-4" />
                            Posto ativo
                          </label>
                        </div>
                      ))}
                      <button className="sticky bottom-4 mt-4 flex min-h-14 w-full items-center justify-center rounded-2xl border border-cyan-300/50 bg-[linear-gradient(135deg,var(--accent),#7dd3fc)] px-5 text-base font-semibold text-slate-950 shadow-[0_18px_45px_rgba(34,211,238,0.28)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(34,211,238,0.36)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70">
                        Salvar todos os boxes
                      </button>
                    </form>
                  </div>
                </div>
              </SectionShell>
            ) : null}

            {admPanel === "social" ? (
              <SectionShell eyebrow="Redes sociais" title="Motor social do tenant" description="Transforme fotos reais dos atendimentos em posts, stories e chamadas promocionais sem sair do sistema.">
                <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                  <div className="space-y-4">
                    <div className="rounded-[24px] border border-white/10 bg-black/15 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-base font-semibold text-white">Conexão com Instagram</p>
                          <p className="mt-1 text-sm text-white/56">
                            {socialStudio?.instagramEnabled
                              ? "Conecte a conta profissional do tenant e publique peças aprovadas direto no Instagram."
                              : "O Instagram deste tenant está bloqueado no admin master."}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs ${
                            socialStudio?.instagramConnection
                              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                              : socialStudio?.instagramEnabled
                                ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
                                : "border-white/10 bg-white/6 text-white/62"
                          }`}
                        >
                          {socialStudio?.instagramConnection ? "Conectado" : socialStudio?.instagramEnabled ? "Aguardando conexão" : "Bloqueado"}
                        </span>
                      </div>

                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
                          <span className="text-sm text-white/60">Conta</span>
                          <span className="text-sm font-semibold text-white">{socialStudio?.instagramConnection?.accountName ?? "Nenhuma conta conectada"}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
                          <span className="text-sm text-white/60">Modo</span>
                          <span className="text-sm font-semibold text-white">Manual</span>
                        </div>
                        <div className="flex items-center justify-between rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
                          <span className="text-sm text-white/60">Última sincronização</span>
                          <span className="text-sm font-semibold text-white">
                            {socialStudio?.instagramConnection?.lastSyncAt ? formatDateTime(socialStudio.instagramConnection.lastSyncAt) : "Sem conexão"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {socialStudio?.instagramEnabled ? (
                          <form action={startInstagramConnectAction}>
                            <AuthSubmitButton
                              label={socialStudio?.instagramConnection ? "Reconectar Instagram" : "Conectar Instagram"}
                              pendingLabel="Abrindo conexão..."
                              className="rounded-2xl border border-transparent bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-950"
                            />
                          </form>
                        ) : null}

                        {socialStudio?.instagramConnection ? (
                          <form action={disconnectInstagramAction}>
                            <ConfirmSubmitButton
                              label="Desconectar"
                              pendingLabel="Desconectando..."
                              confirmMessage="Desconectar a conta do Instagram deste tenant?"
                              className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-sm text-rose-100"
                            />
                          </form>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-white/10 bg-black/15 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-white">Fotos prontas para virar conteúdo</p>
                        <p className="mt-1 text-sm text-white/56">Use a foto mais recente de qualquer etapa do atendimento para gerar material de marketing.</p>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/74">
                        {socialStudio?.candidates.length ?? 0} candidato(s)
                      </span>
                    </div>

                      <div className="mt-4 space-y-4">
                      {!socialStudio || socialStudio.candidates.length === 0 ? (
                        <EmptyState text="Ainda não há fotos disponíveis para gerar peças sociais." />
                      ) : (
                        socialStudio.candidates.map((candidate) => (
                          <div key={candidate.candidateId} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                            <div className="grid gap-4 lg:grid-cols-[180px_1fr]">
                              <div className="overflow-hidden rounded-[18px] border border-white/10 bg-black/20">
                                {candidate.mediaUrl ? (
                                  <img src={candidate.mediaUrl} alt={candidate.vehicleLabel} className="h-full w-full object-cover" />
                                ) : null}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-white">{candidate.vehicleLabel}</p>
                                <p className="mt-1 text-xs text-white/56">
                                  {candidate.vehicleColor ?? "Sem cor"} • {candidate.customerName} • {candidate.serviceName}
                                </p>
                                <p className="mt-2 text-xs text-white/50">
                                  {candidate.mediaKind === "ready" ? "Foto final" : "Foto de etapa"} •{" "}
                                  {candidate.attendanceStatus === "waiting"
                                    ? "Aguardando"
                                    : candidate.attendanceStatus === "washing"
                                      ? "Em execução"
                                      : candidate.attendanceStatus === "finishing"
                                        ? "Conferência"
                                        : candidate.attendanceStatus === "ready"
                                          ? "Concluído"
                                          : candidate.attendanceStatus === "delivered"
                                            ? "Entregue"
                                            : "Cancelado"}
                                </p>
                                {candidate.mediaCaption ? <p className="mt-3 text-sm text-white/62">{candidate.mediaCaption}</p> : null}
                                <div className="mt-4 flex flex-wrap gap-2">
                                  <form action={generateSocialAssetAction}>
                                    <input type="hidden" name="attendance_id" value={candidate.attendanceId} />
                                    <input type="hidden" name="media_id" value={candidate.mediaId} />
                                    <input type="hidden" name="kind" value="post" />
                                    <input type="hidden" name="redirect_to" value="/app/dashboard?section=adm&panel=social" />
                                    <button className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100">
                                      Gerar post
                                    </button>
                                  </form>
                                  <form action={generateSocialAssetAction}>
                                    <input type="hidden" name="attendance_id" value={candidate.attendanceId} />
                                    <input type="hidden" name="media_id" value={candidate.mediaId} />
                                    <input type="hidden" name="kind" value="story" />
                                    <input type="hidden" name="redirect_to" value="/app/dashboard?section=adm&panel=social" />
                                    <button className="rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-sm text-sky-100">
                                      Gerar story
                                    </button>
                                  </form>
                                  <form action={generateSocialAssetAction}>
                                    <input type="hidden" name="attendance_id" value={candidate.attendanceId} />
                                    <input type="hidden" name="media_id" value={candidate.mediaId} />
                                    <input type="hidden" name="kind" value="promo" />
                                    <input type="hidden" name="redirect_to" value="/app/dashboard?section=adm&panel=social" />
                                    <button className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-sm text-amber-100">
                                      Gerar promoção
                                    </button>
                                  </form>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-[24px] border border-white/10 bg-black/15 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-white">Peças geradas</p>
                          <p className="mt-1 text-sm text-white/56">Revise, aprove e publique somente o que já estiver pronto.</p>
                        </div>
                        <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/74">
                          {socialStudio?.assets.length ?? 0} peça(s)
                        </span>
                      </div>

                      <div className="mt-4 space-y-3">
                        {!socialStudio || socialStudio.assets.length === 0 ? (
                          <EmptyState text="Nenhuma peça gerada ainda." />
                        ) : (
                          socialStudio.assets.map((asset) => (
                            <div key={asset.id} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-white">{asset.title ?? "Peça social"}</p>
                                  <p className="mt-1 text-xs text-white/56">{asset.kind.toUpperCase()} • {formatDateTime(asset.created_at)}</p>
                                </div>
                                <span className={`rounded-full border px-3 py-1 text-xs ${asset.status === "approved" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100" : asset.status === "discarded" ? "border-rose-400/20 bg-rose-400/10 text-rose-100" : "border-amber-300/20 bg-amber-300/10 text-amber-100"}`}>
                                  {asset.status === "approved" ? "Aprovado" : asset.status === "discarded" ? "Descartado" : "Rascunho"}
                                </span>
                              </div>
                              <p className="mt-3 text-sm text-white/78">{asset.generated_text}</p>
                              {asset.cta ? <p className="mt-2 text-sm text-[var(--accent)]">{asset.cta}</p> : null}
                              {asset.hashtags.length > 0 ? <p className="mt-2 text-xs text-white/50">{asset.hashtags.join(" ")}</p> : null}

                              <div className="mt-3 flex items-center justify-between rounded-[18px] border border-white/10 bg-black/15 px-4 py-3 text-xs text-white/64">
                                <span>Instagram</span>
                                <span>
                                  {asset.latestPublication?.status === "published"
                                    ? "Publicado"
                                    : asset.latestPublication?.status === "publishing"
                                      ? "Publicando"
                                      : asset.latestPublication?.status === "failed"
                                        ? "Falhou"
                                        : "Sem publicação"}
                                </span>
                              </div>

                              {asset.latestPublication?.error_message ? (
                                <p className="mt-2 text-xs text-rose-200/88">{asset.latestPublication.error_message}</p>
                              ) : null}

                              <div className="mt-4 flex flex-wrap gap-2">
                                <form action={updateSocialAssetStatusAction}>
                                  <input type="hidden" name="asset_id" value={asset.id} />
                                  <input type="hidden" name="status" value="approved" />
                                  <input type="hidden" name="redirect_to" value="/app/dashboard?section=adm&panel=social" />
                                  <button className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100">
                                    Aprovar
                                  </button>
                                </form>
                                <form action={updateSocialAssetStatusAction}>
                                  <input type="hidden" name="asset_id" value={asset.id} />
                                  <input type="hidden" name="status" value="discarded" />
                                  <input type="hidden" name="redirect_to" value="/app/dashboard?section=adm&panel=social" />
                                  <button className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-sm text-rose-100">
                                    Descartar
                                  </button>
                                </form>
                                {socialStudio?.instagramEnabled && socialStudio?.instagramConnection && asset.status === "approved" ? (
                                  <form action={publishSocialAssetToInstagramAction}>
                                    <input type="hidden" name="asset_id" value={asset.id} />
                                    <ConfirmSubmitButton
                                      label={asset.latestPublication?.status === "published" ? "Publicar novamente" : "Publicar no Instagram"}
                                      pendingLabel="Publicando..."
                                      confirmMessage={
                                        asset.latestPublication?.status === "published"
                                          ? "Essa peça já foi publicada. Deseja publicar novamente?"
                                          : "Publicar esta peça no Instagram agora?"
                                      }
                                      className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100"
                                    />
                                    {asset.latestPublication?.status === "published" ? <input type="hidden" name="force_publish" value="true" /> : null}
                                  </form>
                                ) : null}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </SectionShell>
            ) : null}
          </>
        ) : null}
      </main>

      {currentSection === "dashboard" && drawer ? (
        <DrawerShell
          title={
            drawer === "agenda"
              ? "Agendamentos"
              : drawer === "agendar"
              ? "Agendar serviço"
              : drawer === "agendamentos"
                ? "Ver agendamentos"
                : drawer === "resumo"
                  ? "Resumo do dia"
                : drawer === "fila"
                  ? "Na fila"
                  : drawer === "novo"
                  ? "Novo atendimento"
                  : drawer === "etapa"
                    ? (selectedStageDrawer?.title ?? "Etapa")
                    : "Prontos"
          }
          subtitle={
            drawer === "agenda"
              ? "Agenda"
              : drawer === "agendar"
              ? "Agenda"
              : drawer === "agendamentos"
                ? "Calendário"
                : drawer === "resumo"
                  ? "Operação"
                : drawer === "novo"
                  ? "Cadastro"
                  : drawer === "etapa"
                  ? "Fluxo"
                  : "Operação"
          }
          closeHref={hrefFor("dashboard")}
        >
          <DashboardDrawerContent drawer={drawer} dashboard={dashboard} operations={operations} error={params.error} stageView={stageView} appointmentsMonth={appointmentsMonth} />
        </DrawerShell>
      ) : null}

      {currentSection === "caixa" && cashDrawer ? (
        <DrawerShell
          title={cashDrawer === "entries" ? "Entradas totais" : cashDrawer === "expenses" ? "Saídas totais" : "Movimento mensal"}
          subtitle="Caixa"
          closeHref={hrefFor("caixa")}
        >
          <CashDrawerContent drawer={cashDrawer} operations={operations} />
        </DrawerShell>
      ) : null}

      {currentSection === "adm" && admPanel === "employees" && (selectedEmployee || isCreatingEmployee) ? (
        <CenterDrawerShell title={selectedEmployee ? selectedEmployee.name : "Novo funcionário"} subtitle={selectedEmployee ? "Dados do funcionário" : "Cadastro completo"} closeHref={hrefFor("adm", { panel: "employees" })}>
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <form action={selectedEmployee ? saveEmployeeAction : createEmployeeAction} className="space-y-4">
              <input type="hidden" name="redirect_to" value={selectedEmployee ? hrefFor("adm", { panel: "employees", employeeId: selectedEmployee.id }) : hrefFor("adm", { panel: "employees", employeeId: "new" })} />
              <input type="hidden" name="employee_id" value={selectedEmployee?.id ?? ""} />

              <div className="grid gap-4 md:grid-cols-2">
                <input name="name" defaultValue={selectedEmployee?.name ?? ""} placeholder="Nome completo" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                <input name="role_label" defaultValue={selectedEmployee?.role_label ?? ""} placeholder="Função" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <PhoneInput name="phone" defaultValue={selectedEmployee?.phone ?? ""} placeholder="Telefone principal" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                <PhoneInput name="contact_phone" defaultValue={selectedEmployee?.contact_phone ?? ""} placeholder="Telefone de contato" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <input name="email" defaultValue={selectedEmployee?.email ?? ""} placeholder="E-mail" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none md:col-span-2" />
                <CpfInput name="cpf" defaultValue={selectedEmployee?.cpf ?? ""} placeholder="CPF" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <input name="birth_date" type="date" defaultValue={selectedEmployee?.birth_date ?? ""} className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                <input name="internal_code" defaultValue={selectedEmployee?.internal_code ?? ""} placeholder="Identificação interna" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                <div />
              </div>

              <EmployeeAddressFields
                postalCode={selectedEmployee?.postal_code ?? ""}
                street={selectedEmployee?.street ?? ""}
                streetNumber={selectedEmployee?.street_number ?? ""}
                complement={selectedEmployee?.complement ?? ""}
                neighborhood={selectedEmployee?.neighborhood ?? ""}
                city={selectedEmployee?.city ?? ""}
                state={selectedEmployee?.state ?? ""}
                inputClassName="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
              />

              <div className="grid gap-4 md:grid-cols-2">
                <select name="payment_type" defaultValue={selectedEmployee?.payment_type ?? "daily"} className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none">
                  <option value="daily">Diária</option>
                  <option value="commission">Comissão</option>
                  <option value="fixed">Fixo</option>
                </select>
                <CurrencyInput name="payment_value" defaultValue={selectedEmployee ? formatCurrency(Number(selectedEmployee.payment_value)) : ""} placeholder="Valor" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white/80">
                <input type="checkbox" name="can_access_system" value="true" defaultChecked={selectedEmployee?.can_access_system ?? false} className="size-4" />
                Liberar acesso ao sistema
              </label>

              <input name="password" placeholder={selectedEmployee ? "Nova senha opcional" : "Senha inicial"} className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />

              <div className="flex gap-3">
                <AuthSubmitButton
                  label={selectedEmployee ? "Salvar alterações" : "Criar funcionário"}
                  pendingLabel={selectedEmployee ? "Salvando..." : "Criando funcionário..."}
                  className="flex min-h-12 flex-1 items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950 disabled:opacity-70"
                />
                <Link href={hrefFor("adm", { panel: "employees" })} className="flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/6 px-5 text-sm text-white/82">
                  Fechar
                </Link>
              </div>
            </form>

            {selectedEmployee ? (
            <div className="space-y-4">
              <div className="rounded-[24px] border border-white/10 bg-black/15 p-5">
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={hrefFor("adm", { panel: "employees", employeeId: selectedEmployee.id, employeeView: "details" })}
                    className={`rounded-full px-3 py-1 text-xs ${employeeView === "details" ? "border border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]" : "border border-white/10 bg-white/6 text-white/70"}`}
                  >
                    Dados
                  </Link>
                  <Link
                    href={hrefFor("adm", { panel: "employees", employeeId: selectedEmployee.id, employeeView: "history" })}
                    className={`rounded-full px-3 py-1 text-xs ${employeeView === "history" ? "border border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]" : "border border-white/10 bg-white/6 text-white/70"}`}
                  >
                    Histórico
                  </Link>
                </div>
                <p className="text-sm uppercase tracking-[0.18em] text-white/40">Status</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={`rounded-full border px-3 py-1 text-xs ${selectedEmployee.current_session_logged_in_at || selectedEmployee.is_present ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/6 text-white/70"}`}>
                    {selectedEmployee.current_session_logged_in_at ? "Logado agora" : selectedEmployee.is_present ? "Presente hoje" : "Ausente hoje"}
                  </span>
                  <span className={`rounded-full border px-3 py-1 text-xs ${selectedEmployee.is_active ? "border-sky-400/20 bg-sky-400/10 text-sky-200" : "border-rose-400/20 bg-rose-400/10 text-rose-200"}`}>
                    {selectedEmployee.is_active ? "Ativo" : "Inativo"}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/70">
                    {selectedEmployee.can_access_system ? "Com acesso" : "Sem acesso"}
                  </span>
                </div>
                {selectedEmployee.current_session_logged_in_at ? (
                  <p className="mt-3 text-sm text-white/64">Login atual em {formatDateTime(selectedEmployee.current_session_logged_in_at)}</p>
                ) : null}
              </div>

              {employeeView === "history" ? (
                <div className="rounded-[24px] border border-white/10 bg-black/15 p-5">
                  <p className="text-sm font-semibold text-white">Histórico de trabalho</p>
                  <div className="mt-4 space-y-3">
                    {operations.employeeHistory.length === 0 ? (
                      <p className="text-sm text-white/56">Nenhum histórico encontrado ainda.</p>
                    ) : (
                      operations.employeeHistory.map((session) => (
                        <div key={session.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <p className="text-sm font-semibold text-white">{formatDate(session.logged_in_at)}</p>
                          <p className="mt-1 text-sm text-white/62">Login: {formatTime(session.logged_in_at)}</p>
                          <p className="text-sm text-white/62">Logout: {session.logged_out_at ? formatTime(session.logged_out_at) : "Ainda logado"}</p>
                          <p className="mt-2 text-sm text-white/72">
                            Lavou {session.washed_count ?? 0} • Secou/finalizou {session.dried_count ?? 0}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}

              <form action={setEmployeeStateAction} className="rounded-[24px] border border-rose-400/15 bg-rose-400/8 p-5">
                <input type="hidden" name="redirect_to" value={hrefFor("adm", { panel: "employees" })} />
                <input type="hidden" name="employee_id" value={selectedEmployee.id} />
                <input type="hidden" name="is_active" value={selectedEmployee.is_active ? "false" : "true"} />
                <p className="text-sm font-semibold text-white">Ação rápida</p>
                <p className="mt-2 text-sm text-white/60">
                  {selectedEmployee.is_active ? "Inative o funcionário para remover da equipe cadastrada e bloquear o uso no tenant." : "Reative o funcionário para voltar à equipe cadastrada."}
                </p>
                <button className={`mt-4 flex min-h-12 w-full items-center justify-center rounded-2xl px-4 text-sm font-semibold ${selectedEmployee.is_active ? "border border-rose-300/20 bg-rose-300/12 text-rose-100" : "border border-emerald-400/20 bg-emerald-400/12 text-emerald-100"}`}>
                  {selectedEmployee.is_active ? "Inativar" : "Reativar"}
                </button>
              </form>
            </div>
            ) : (
            <div className="space-y-4">
              <div className="rounded-[24px] border border-white/10 bg-black/15 p-5">
                <p className="text-sm uppercase tracking-[0.18em] text-white/40">Cadastro</p>
                <p className="mt-4 text-sm text-white/64">Preencha os dados completos do funcionário. Depois de salvar ele passa a aparecer em Equipe cadastrada.</p>
              </div>
            </div>
            )}
          </div>
        </CenterDrawerShell>
      ) : null}

      {currentSection === "clientes" && showCustomerForm ? (
        <CenterDrawerShell
          title="Novo cliente"
          subtitle="Cadastro completo"
          closeHref={hrefFor("clientes", {
            customer: params.customer ?? undefined,
            clientSearch: clientSearch || undefined,
          })}
        >
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
            <p className="text-base font-semibold text-white">Cadastro completo do cliente</p>
            <p className="mt-2 text-sm text-white/56">Cadastre o cliente, vincule veículos quando necessário e siga direto para o orçamento.</p>
            <div className="mt-5">
              <CustomerRegistrationForm
                formAction={createCustomerAction}
                isAutomotive={isAutomotiveTenant}
                redirectTo={hrefFor("clientes", { customerForm: "1" })}
                backHref={hrefFor("clientes", {
                  customer: params.customer ?? undefined,
                  clientSearch: clientSearch || undefined,
                })}
                brandOptions={operations.vehicleCatalog.brands}
                modelOptions={operations.vehicleCatalog.models}
                colorOptions={operations.vehicleCatalog.colors}
                vehicleTypeOptions={vehicleTypeOptions.map((option) => ({ code: option.code, label: option.label }))}
              />
            </div>
          </div>
        </CenterDrawerShell>
      ) : null}

      {currentSection === "clientes" && showQuoteForm && operations.customerWorkspace ? (
        <CenterDrawerShell
          title="Orçamento do cliente"
          subtitle="Proposta comercial"
          closeHref={hrefFor("clientes", {
            customer: operations.customerWorkspace!.customer.id,
            clientSearch: clientSearch || undefined,
          })}
        >
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
            <p className="text-base font-semibold text-white">Novo orçamento</p>
            <p className="mt-2 text-sm text-white/56">Registre a solicitação do cliente, valores e o serviço operacional que entrará no fluxo se ele aprovar.</p>
            <div className="mt-5">
              <ServiceQuoteForm
                formAction={createServiceQuoteAction}
                redirectTo={hrefFor("clientes", {
                  customer: operations.customerWorkspace!.customer.id,
                  clientSearch: clientSearch || undefined,
                  quoteForm: "1",
                })}
                backHref={hrefFor("clientes", {
                  customer: operations.customerWorkspace!.customer.id,
                  clientSearch: clientSearch || undefined,
                })}
                customerId={operations.customerWorkspace!.customer.id}
                customerName={operations.customerWorkspace.customer.name}
                customerContact={operations.customerWorkspace.customer.whatsapp ?? operations.customerWorkspace.customer.contact_phone_1 ?? null}
                customerEmail={operations.customerWorkspace.customer.email ?? null}
                services={operations.services.map((service) => ({
                  id: service.id,
                  name: service.name,
                  price: Number(service.price),
                }))}
                vehicles={operations.customerWorkspace.vehicles.map((vehicle) => ({
                  id: vehicle.id,
                  plate: vehicle.plate,
                  brand: vehicle.brand ?? null,
                  model: vehicle.model,
                  color: vehicle.color ?? null,
                }))}
                isAutomotive={isAutomotiveTenant}
              />
            </div>
          </div>
        </CenterDrawerShell>
      ) : null}
    </>
  );
}
