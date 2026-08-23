import Link from "next/link";
import { AdminTenantForm } from "@/components/admin-tenant-form";
import { AdminLeadHunterSection } from "@/components/admin-lead-hunter-section";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { FlashNotice } from "@/components/flash-notice";
import { CurrencyInput } from "@/components/masked-inputs";
import { getAdminDashboardUseCase } from "@/backend/use-cases/admin/get-admin-dashboard";
import { getLeadHunterDashboardUseCase } from "@/backend/use-cases/admin/get-lead-hunter-dashboard";
import {
  activateCommercialIntakeAction,
  adminSignOutAction,
  confirmCommercialPaymentAction,
  createTenantByAdminAction,
  savePlanAction,
  savePlatformSettingsAction,
  saveSubscriptionAction,
  toggleTenantStatusAction,
  updateSupportTicketAction,
} from "./actions";

type AdminSection =
  | "dashboard"
  | "tenants"
  | "comercial"
  | "financeiro"
  | "suporte"
  | "configuracoes"
  | "logs"
  | "radar";

type CommercialTab = "cadastros" | "planos" | "assinaturas";

function parseBooleanFilter(value: string | undefined) {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function formatCurrency(value: number | null) {
  if (value === null) return "Sob consulta";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

function formatDocument(value: string) {
  const digits = value.replace(/\D+/g, "");
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return value;
}

function formatPhone(value: string | null | undefined) {
  if (!value) return "-";
  const digits = value.replace(/\D+/g, "");
  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }
  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  return value;
}

function formatCommercialStatus(value: string) {
  const labels: Record<string, string> = {
    submitted: "Recebido",
    awaiting_payment: "Aguardando pagamento",
    paid: "Pago",
    active: "Ativo",
    archived: "Arquivado",
    pending: "Pendente",
    failed: "Falhou",
    refunded: "Estornado",
  };

  return labels[value] ?? value;
}

function hrefFor(section: AdminSection, drawer?: string) {
  const params = new URLSearchParams({ section });
  if (drawer) params.set("drawer", drawer);
  return `/admin?${params.toString()}`;
}

function hrefForCommercial(tab: CommercialTab, tenantId?: string) {
  const params = new URLSearchParams({ section: "comercial", tab });
  if (tenantId) params.set("tenant_id", tenantId);
  return `/admin?${params.toString()}`;
}

const sections: Array<{
  id: AdminSection;
  title: string;
  description: string;
}> = [
  { id: "dashboard", title: "Dashboard", description: "Visão geral da operação" },
  { id: "tenants", title: "Tenants", description: "Cadastro e gestão dos clientes" },
  { id: "comercial", title: "Comercial", description: "Cadastros, pagamentos e ativações" },
  { id: "financeiro", title: "Financeiro", description: "Receita, MRR e churn" },
  { id: "suporte", title: "Suporte", description: "Tickets e acompanhamento" },
  { id: "configuracoes", title: "Configurações", description: "Parâmetros globais do SaaS" },
  { id: "radar", title: "Caçar Clientes", description: "Prospecção e oportunidade comercial" },
  { id: "logs", title: "Logs", description: "Auditoria completa" },
];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    message?: string;
    section?: string;
    tab?: string;
    drawer?: string;
    tenant_id?: string;
    lead_niche?: string;
    lead_city?: string;
    lead_state?: string;
    lead_with_website?: string;
    lead_with_phone?: string;
    lead_level?: string;
    lead_status?: string;
    lead_contact_risk?: string;
    lead_contact_role?: string;
    lead_channel?: string;
  }>;
}) {
  const {
    error,
    message,
    section: rawSection,
    tab: rawTab,
    drawer,
    tenant_id: focusedTenantId,
    lead_niche,
    lead_city,
    lead_state,
    lead_with_website,
    lead_with_phone,
    lead_level,
    lead_status,
    lead_contact_risk,
    lead_contact_role,
    lead_channel,
  } = await searchParams;
  const normalizedSection = rawSection === "planos" || rawSection === "assinaturas" ? "comercial" : rawSection;
  const currentSection = (sections.some((item) => item.id === normalizedSection) ? normalizedSection : "dashboard") as AdminSection;
  const commercialTab =
    rawSection === "planos"
      ? "planos"
      : rawSection === "assinaturas"
        ? "assinaturas"
        : rawTab === "cadastros" || rawTab === "planos" || rawTab === "assinaturas"
          ? rawTab
          : "cadastros";
  const dashboard = await getAdminDashboardUseCase();
  const leadHunterDashboard =
    currentSection === "radar"
      ? await getLeadHunterDashboardUseCase({
          niche: lead_niche?.trim() || null,
          city: lead_city?.trim() || null,
          state: lead_state?.trim() || null,
          withWebsite: parseBooleanFilter(lead_with_website),
          withPhone: parseBooleanFilter(lead_with_phone),
          opportunityLevel:
            lead_level === "alta" || lead_level === "media" || lead_level === "baixa" ? lead_level : null,
          status:
            lead_status === "found" ||
            lead_status === "analyzed" ||
            lead_status === "message_generated" ||
            lead_status === "contacted" ||
            lead_status === "responded" ||
            lead_status === "demo_scheduled" ||
            lead_status === "closed_won" ||
            lead_status === "lost" ||
            lead_status === "kept" ||
            lead_status === "archived"
              ? lead_status
              : null,
          contactRiskLevel:
            lead_contact_risk === "baixo" || lead_contact_risk === "medio" || lead_contact_risk === "alto"
              ? lead_contact_risk
              : null,
          contactRoleHint:
            lead_contact_role === "provavel_empresa" || lead_contact_role === "possivel_contador" || lead_contact_role === "sem_sinal_claro"
              ? lead_contact_role
              : null,
          recommendedChannel:
            lead_channel === "whatsapp_primeiro_email_de_apoio" ||
            lead_channel === "email_primeiro" ||
            lead_channel === "abordagem_contador_parceiro" ||
            lead_channel === "baixa_prioridade"
              ? lead_channel
              : null,
        })
      : null;
  const subscriptionByTenant = new Map(dashboard.subscriptions.map((item) => [item.tenant_id, item]));
  const companyProfileByTenant = new Map(dashboard.companyProfiles.map((item) => [item.tenant_id, item]));
  const visibleSubscriptions = focusedTenantId
    ? dashboard.subscriptions.filter((item) => item.tenant_id === focusedTenantId)
    : dashboard.subscriptions;
  const activeSubscriptions = dashboard.subscriptions.filter((item) => item.status === "active").length;
  const trialSubscriptions = dashboard.subscriptions.filter((item) => item.status === "trialing").length;
  const pastDueSubscriptions = dashboard.subscriptions.filter((item) => item.status === "past_due").length;
  const commercialAwaitingPayment = dashboard.commercialIntakes.filter((item) => item.payment_status === "pending").length;
  const commercialPaid = dashboard.commercialIntakes.filter((item) => item.payment_status === "paid").length;
  const commercialActive = dashboard.commercialIntakes.filter((item) => item.status === "active").length;

  return (
    <main className="min-h-screen bg-[#0d1117] px-4 py-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6 lg:grid lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(0,245,212,0.16),_transparent_58%),rgba(22,27,34,0.96)] p-5 shadow-[0_18px_56px_rgba(0,0,0,0.32)]">
            <p className="text-xs uppercase tracking-[0.26em] text-white/45">Admin Master</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Verifica Control</h1>
            <p className="mt-2 text-sm text-white/58">{dashboard.admin.email}</p>
            <form action={adminSignOutAction} className="mt-4">
              <button className="flex min-h-11 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/6 px-4 text-sm text-white/80">
                Sair
              </button>
            </form>
          </section>

          <section className="grid gap-3">
            {sections.map((item) => {
              const active = currentSection === item.id;
              return (
                <Link
                  key={item.id}
                  href={hrefFor(item.id)}
                  className={`rounded-[24px] border p-4 transition ${
                    active
                      ? "border-[var(--accent)] bg-[linear-gradient(135deg,rgba(0,245,212,0.14),rgba(56,189,248,0.08))] shadow-[0_12px_36px_rgba(0,245,212,0.16)]"
                      : "border-white/10 bg-white/6"
                  }`}
                >
                  <p className="text-base font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-white/56">{item.description}</p>
                </Link>
              );
            })}
          </section>
        </aside>

        <section className="space-y-4">
          <FlashNotice error={error} message={message} />

          {currentSection === "dashboard" ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
              <section className="rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
                  {[
                    ["Lava-rápidos ativos", String(dashboard.stats.activeTenantCount)],
                    ["MRR", formatCurrency(dashboard.stats.mrr)],
                    ["Novos clientes", `${dashboard.stats.newTenantsThisMonth} este mês`],
                    ["Clientes em teste", String(dashboard.stats.trialCount)],
                    ["Clientes inadimplentes", String(dashboard.stats.pastDueCount)],
                    ["Atendimentos totais", String(dashboard.stats.attendancesTotal)],
                    ["Usuários ativos", String(dashboard.stats.activeUsers)],
                    ["Donos cadastrados", String(dashboard.stats.ownerCount)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-[22px] border border-white/10 bg-black/15 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-white/40">{label}</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
                <p className="text-xs uppercase tracking-[0.24em] text-white/40">Resumo financeiro</p>
                <div className="mt-4 space-y-3">
                  {[
                    ["ARR", formatCurrency(dashboard.finance.arr)],
                    ["Receita do mês", formatCurrency(dashboard.finance.monthlyRevenue)],
                    ["Receita anual", formatCurrency(dashboard.finance.annualRevenue)],
                    ["Churn", `${dashboard.finance.churn.toFixed(1)}%`],
                    ["Clientes ativos", String(dashboard.finance.activeCustomers)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between rounded-[20px] border border-white/10 bg-black/15 px-4 py-3">
                      <span className="text-sm text-white/60">{label}</span>
                      <span className="text-sm font-semibold text-white">{value}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : null}

          {currentSection === "radar" && leadHunterDashboard ? <AdminLeadHunterSection data={leadHunterDashboard} /> : null}

          {currentSection === "tenants" ? (
            <div className="grid gap-4">
              <section className="rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-white/40">Tenants</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">Base de lava-rápidos</h2>
                  </div>
                  <Link
                    href={hrefFor("tenants", "new-tenant")}
                    className="flex min-h-11 items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950"
                  >
                    Novo tenant
                  </Link>
                </div>

                <div className="mt-5 grid gap-3">
                  {dashboard.tenants.map((tenant) => {
                    const subscription = subscriptionByTenant.get(tenant.id);
                    const company = companyProfileByTenant.get(tenant.id);
                    return (
                      <div key={tenant.id} className="rounded-[22px] border border-white/10 bg-black/15 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold text-white">{company?.trade_name ?? tenant.name}</p>
                            <p className="text-sm text-white/56">{company?.legal_name ?? "Razão social não informada"}</p>
                            <p className="text-sm text-white/56">{company?.cnpj ?? "CNPJ não informado"}</p>
                            <p className="text-sm text-white/56">{subscription?.plans?.name ?? "Sem plano"} • {subscription?.status ?? (tenant.is_active ? "active" : "inactive")}</p>
                          </div>
                          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/75">
                            {tenant.is_active ? "Ativo" : "Inativo"}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-2 md:grid-cols-4">
                          <Link href={`/admin/tenants/${tenant.id}`} className="flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-white/82">
                            Ver tenant
                          </Link>
                          <Link href={`/admin/tenants/${tenant.id}/workspace#whatsapp-tenant`} className="flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-white/82">
                            WhatsApp e mensagens
                          </Link>
                          <Link href={hrefForCommercial("assinaturas", tenant.id)} className="flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-white/82">
                            Comercial
                          </Link>
                          <form action={toggleTenantStatusAction}>
                            <input type="hidden" name="tenant_id" value={tenant.id} />
                            <input type="hidden" name="next_value" value={tenant.is_active ? "false" : "true"} />
                            <button className="flex min-h-11 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-white/82">
                              {tenant.is_active ? "Suspender" : "Ativar"}
                            </button>
                          </form>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          ) : null}

          {currentSection === "comercial" ? (
            <div className="grid gap-4">
              <section className="rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-white/40">Comercial</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">Aquisição, oferta e cobrança no mesmo lugar</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-white/58">
                      Esta área agora concentra o funil comercial, a configuração dos planos e a gestão das assinaturas. Era redundante manter três telas separadas para a mesma operação.
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    {[
                      ["Cadastros", "cadastros"],
                      ["Planos", "planos"],
                      ["Assinaturas", "assinaturas"],
                    ].map(([label, value]) => {
                      const active = commercialTab === value;
                      return (
                        <Link
                          key={value}
                          href={hrefForCommercial(value as CommercialTab, focusedTenantId ?? undefined)}
                          className={`flex min-h-11 items-center justify-center rounded-2xl border px-4 text-sm transition ${
                            active
                              ? "border-[var(--accent)] bg-[var(--accent)]/12 font-semibold text-white"
                              : "border-white/10 bg-white/5 text-white/72"
                          }`}
                        >
                          {label}
                        </Link>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  {[
                    ["Cadastros recebidos", String(dashboard.commercialIntakes.length)],
                    ["Aguardando pagamento", String(commercialAwaitingPayment)],
                    ["Pagos", String(commercialPaid)],
                    ["Ativos", String(commercialActive)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-[22px] border border-white/10 bg-black/15 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-white/40">{label}</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
                    </div>
                  ))}
                </div>
              </section>

              {commercialTab === "cadastros" ? (
                <section className="rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-white/40">Funil comercial</p>
                      <h2 className="mt-2 text-2xl font-semibold text-white">Cadastros, pagamento e ativação</h2>
                    </div>
                    <p className="text-sm text-white/56">Aqui ficam os que só preencheram, os que pagaram e os clientes já ativos.</p>
                  </div>

                  <div className="mt-5 grid gap-4">
                    {dashboard.commercialIntakes.length === 0 ? (
                      <div className="rounded-[22px] border border-dashed border-white/12 bg-black/10 p-4 text-sm text-white/56">
                        Nenhum cadastro comercial ainda.
                      </div>
                    ) : (
                      dashboard.commercialIntakes.map((intake) => (
                        <article key={intake.id} className="rounded-[24px] border border-white/10 bg-black/15 p-4">
                          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                            <div className="space-y-3">
                              <div>
                                <p className="text-lg font-semibold text-white">{intake.full_name}</p>
                                <p className="text-sm text-white/56">{intake.selected_plan_name}</p>
                              </div>

                              <div className="grid gap-2 text-sm text-white/68 md:grid-cols-2">
                                <p>{intake.email}</p>
                                <p>{formatPhone(intake.whatsapp)}</p>
                                <p>{formatDocument(intake.document)}</p>
                                <p>{intake.trade_name ?? intake.legal_name ?? "-"}</p>
                                <p>{intake.city}/{intake.state}</p>
                                <p>{formatDate(intake.created_at)}</p>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/80">
                                  Cadastro: {formatCommercialStatus(intake.status)}
                                </span>
                                <span className="rounded-full border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-3 py-1 text-xs text-white/85">
                                  Pagamento: {formatCommercialStatus(intake.payment_status)}
                                </span>
                                <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">
                                  Implantação {formatCurrency(intake.implementation_fee)}
                                </span>
                                <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">
                                  Mensal {formatCurrency(intake.recurring_fee)}
                                </span>
                              </div>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2 xl:w-[360px]">
                              <form action={confirmCommercialPaymentAction}>
                                <input type="hidden" name="commercial_intake_id" value={intake.id} />
                                <button
                                  disabled={intake.payment_status === "paid"}
                                  className="flex min-h-11 w-full items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                  {intake.payment_status === "paid" ? "Pagamento confirmado" : "Confirmar pagamento"}
                                </button>
                              </form>

                              <form action={activateCommercialIntakeAction}>
                                <input type="hidden" name="commercial_intake_id" value={intake.id} />
                                <button
                                  disabled={intake.status === "active" || intake.payment_status !== "paid"}
                                  className="flex min-h-11 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white/82 disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                  {intake.status === "active" ? "Cliente ativo" : "Ativar cliente"}
                                </button>
                              </form>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <div className="rounded-[20px] border border-white/10 bg-[#0f141b] p-4">
                              <p className="text-xs uppercase tracking-[0.18em] text-white/40">Situação informada</p>
                              <p className="mt-2 text-sm leading-6 text-white/70">{intake.current_situation ?? "Não informou contexto adicional."}</p>
                            </div>
                            <div className="rounded-[20px] border border-white/10 bg-[#0f141b] p-4">
                              <p className="text-xs uppercase tracking-[0.18em] text-white/40">Contrato</p>
                              <p className="mt-2 text-sm leading-6 text-white/70">{intake.contract_title}</p>
                              <p className="mt-2 text-xs text-white/50">
                                Aceito em {formatDate(intake.contract_accepted_at)} • envio por e-mail {intake.contract_email_sent_at ? formatDate(intake.contract_email_sent_at) : "pendente"}
                              </p>
                              {intake.contract_email_error ? (
                                <p className="mt-2 text-xs text-rose-200">{intake.contract_email_error}</p>
                              ) : null}
                            </div>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </section>
              ) : null}

              {commercialTab === "planos" ? (
                <section className="rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-white/40">Oferta comercial</p>
                      <h2 className="mt-2 text-2xl font-semibold text-white">Planos da plataforma</h2>
                    </div>
                    <p className="text-sm text-white/56">Os planos ficam aqui dentro do Comercial, porque fazem parte direta da venda.</p>
                  </div>

                  <div className="mt-5 grid gap-3 xl:grid-cols-3">
                    {dashboard.plans.map((plan) => (
                      <form key={plan.id} action={savePlanAction} className="rounded-[22px] border border-white/10 bg-black/15 p-4 space-y-3">
                        <input type="hidden" name="plan_id" value={plan.id} />
                        <input type="hidden" name="is_active" value={String(plan.is_active)} />
                        <input name="name" defaultValue={plan.name} className="h-11 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-3 text-sm text-white outline-none" />
                        <input name="code" defaultValue={plan.code} className="h-11 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-3 text-sm text-white outline-none" />
                        <CurrencyInput name="price_monthly" defaultValue={plan.price_monthly} className="h-11 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-3 text-sm text-white outline-none" />
                        <input name="operator_limit" defaultValue={plan.operator_limit ?? ""} placeholder="Limite de operadores" className="h-11 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-3 text-sm text-white outline-none" />
                        <input name="appointment_limit" defaultValue={plan.appointment_limit ?? ""} placeholder="Limite de agendamentos" className="h-11 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-3 text-sm text-white outline-none" />
                        <input name="whatsapp_limit" defaultValue={plan.whatsapp_limit ?? ""} placeholder="Limite de WhatsApps" className="h-11 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-3 text-sm text-white outline-none" />
                        <input name="features" defaultValue={plan.features.join(", ")} placeholder="Recursos separados por vírgula" className="h-11 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-3 text-sm text-white outline-none" />
                        <button className="flex min-h-11 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-white/82">
                          Salvar plano
                        </button>
                      </form>
                    ))}
                  </div>
                </section>
              ) : null}

              {commercialTab === "assinaturas" ? (
                <section className="rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-white/40">Cobrança recorrente</p>
                      <h2 className="mt-2 text-2xl font-semibold text-white">Assinaturas em andamento</h2>
                    </div>
                    <p className="text-sm text-white/56">A assinatura continua existindo, mas agora dentro da operação comercial.</p>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    {[
                      ["Ativas", String(activeSubscriptions)],
                      ["Em teste", String(trialSubscriptions)],
                      ["Em atraso", String(pastDueSubscriptions)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-[22px] border border-white/10 bg-black/15 p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-white/40">{label}</p>
                        <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
                      </div>
                    ))}
                  </div>

                  {focusedTenantId ? (
                    <div className="mt-4 rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-4 py-3 text-sm text-white/82">
                      Assinatura filtrada para o tenant selecionado.
                    </div>
                  ) : null}

                  <div className="mt-5 grid gap-3">
                    {visibleSubscriptions.map((subscription) => (
                      <form key={subscription.id} action={saveSubscriptionAction} className="rounded-[22px] border border-white/10 bg-black/15 p-4">
                        <input type="hidden" name="tenant_id" value={subscription.tenant_id} />
                        <div className="grid gap-3 xl:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))]">
                          <div>
                            <p className="text-base font-semibold text-white">{subscription.tenants?.name ?? "Tenant"}</p>
                            <p className="text-sm text-white/56">Plano atual: {subscription.plans?.name ?? "Sem plano"}</p>
                          </div>
                          <select name="plan_id" defaultValue={subscription.plan_id ?? ""} className="h-11 rounded-2xl border border-white/10 bg-[#0f141b] px-3 text-sm text-white outline-none">
                            <option value="">Sem plano</option>
                            {dashboard.plans.map((plan) => (
                              <option key={plan.id} value={plan.id}>
                                {plan.name}
                              </option>
                            ))}
                          </select>
                          <select name="status" defaultValue={subscription.status} className="h-11 rounded-2xl border border-white/10 bg-[#0f141b] px-3 text-sm text-white outline-none">
                            <option value="trialing">Teste</option>
                            <option value="active">Pago</option>
                            <option value="past_due">Atrasado</option>
                            <option value="suspended">Suspenso</option>
                            <option value="canceled">Cancelado</option>
                          </select>
                          <CurrencyInput name="amount" defaultValue={subscription.amount} className="h-11 rounded-2xl border border-white/10 bg-[#0f141b] px-3 text-sm text-white outline-none" />
                          <input name="current_period_end" type="date" defaultValue={subscription.current_period_end?.slice(0, 10) ?? ""} className="h-11 rounded-2xl border border-white/10 bg-[#0f141b] px-3 text-sm text-white outline-none" />
                          <button className="flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-white/82">
                            Salvar
                          </button>
                        </div>
                        <input name="trial_ends_at" type="hidden" defaultValue={subscription.trial_ends_at?.slice(0, 10) ?? ""} />
                      </form>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}

          {currentSection === "financeiro" ? (
            <section className="rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
              <p className="text-xs uppercase tracking-[0.24em] text-white/40">Financeiro</p>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {[
                  ["MRR", formatCurrency(dashboard.finance.mrr)],
                  ["ARR", formatCurrency(dashboard.finance.arr)],
                  ["Receita do mês", formatCurrency(dashboard.finance.monthlyRevenue)],
                  ["Receita anual", formatCurrency(dashboard.finance.annualRevenue)],
                  ["Churn", `${dashboard.finance.churn.toFixed(1)}%`],
                  ["Clientes ativos", String(dashboard.finance.activeCustomers)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[22px] border border-white/10 bg-black/15 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-white/40">{label}</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {currentSection === "suporte" ? (
            <section className="rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
              <p className="text-xs uppercase tracking-[0.24em] text-white/40">Suporte</p>
              <div className="mt-5 grid gap-3">
                {dashboard.supportTickets.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-white/12 bg-black/10 p-4 text-sm text-white/56">
                    Nenhum ticket aberto ainda.
                  </div>
                ) : (
                  dashboard.supportTickets.map((ticket) => (
                    <form key={ticket.id} action={updateSupportTicketAction} className="rounded-[22px] border border-white/10 bg-black/15 p-4">
                      <input type="hidden" name="ticket_id" value={ticket.id} />
                      <div className="grid gap-3 xl:grid-cols-[1.1fr_0.7fr_1fr]">
                        <div>
                          <p className="font-semibold text-white">{ticket.tenants?.name ?? "Sem tenant"}</p>
                          <p className="mt-1 text-sm text-white/72">{ticket.subject}</p>
                          <p className="mt-1 text-sm text-white/56">{ticket.description ?? "Sem descrição"}</p>
                          {ticket.admin_reply ? (
                            <div className="mt-3 rounded-[16px] border border-sky-400/20 bg-sky-400/10 p-3">
                              <p className="text-xs uppercase tracking-[0.18em] text-sky-100/70">Resposta enviada</p>
                              <p className="mt-2 text-sm text-white/80">{ticket.admin_reply}</p>
                              {ticket.admin_reply_at ? <p className="mt-2 text-xs text-white/50">{formatDate(ticket.admin_reply_at)}</p> : null}
                            </div>
                          ) : null}
                        </div>
                        <p className="text-sm text-white/56">{formatDate(ticket.created_at)}</p>
                        <div className="space-y-2">
                          <select name="status" defaultValue={ticket.status} className="h-11 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-3 text-sm text-white outline-none">
                            <option value="open">Aberto</option>
                            <option value="in_progress">Em andamento</option>
                            <option value="resolved">Resolvido</option>
                          </select>
                          <textarea
                            name="admin_reply"
                            defaultValue={ticket.admin_reply ?? ""}
                            placeholder="Responder o tenant"
                            rows={4}
                            className="w-full rounded-[18px] border border-white/10 bg-[#0f141b] px-3 py-3 text-sm text-white outline-none"
                          />
                          <AuthSubmitButton
                            label="Salvar resposta"
                            pendingLabel="Salvando resposta..."
                            className="flex min-h-11 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-white/82 disabled:cursor-not-allowed disabled:opacity-70"
                          />
                        </div>
                      </div>
                    </form>
                  ))
                )}
              </div>
            </section>
          ) : null}

          {currentSection === "configuracoes" ? (
            <section className="rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
              <p className="text-xs uppercase tracking-[0.24em] text-white/40">Configurações</p>
              <form action={savePlatformSettingsAction} className="mt-5 grid gap-3 xl:grid-cols-2">
                <input name="platform_name" defaultValue={dashboard.settings?.platform_name ?? "Verifica"} placeholder="Nome da plataforma" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                <input name="logo_url" defaultValue={dashboard.settings?.logo_url ?? ""} placeholder="Logo" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                <input name="primary_domain" defaultValue={dashboard.settings?.primary_domain ?? ""} placeholder="Domínio" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                <input name="smtp_from_email" defaultValue={dashboard.settings?.smtp_from_email ?? ""} placeholder="SMTP remetente" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                <input name="resend_from_email" defaultValue={dashboard.settings?.resend_from_email ?? ""} placeholder="Resend remetente" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                <input name="resend_reply_to_email" defaultValue={dashboard.settings?.resend_reply_to_email ?? ""} placeholder="Resend responder para" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                <input name="smtp_host" defaultValue={dashboard.settings?.smtp_host ?? ""} placeholder="SMTP host" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                <input name="smtp_port" defaultValue={dashboard.settings?.smtp_port ?? ""} placeholder="SMTP porta" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                <input name="smtp_username" defaultValue={dashboard.settings?.smtp_username ?? ""} placeholder="SMTP usuário" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                <input name="smtp_password" defaultValue={dashboard.settings?.smtp_password ?? ""} placeholder="SMTP senha" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                <input name="whatsapp_provider" defaultValue={dashboard.settings?.whatsapp_provider ?? "Evolution"} placeholder="WhatsApp provider" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                <input name="whatsapp_base_url" defaultValue={dashboard.settings?.whatsapp_base_url ?? ""} placeholder="Base URL do WhatsApp" className="h-12 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                <div className="xl:col-span-2 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white/60">
                  A conexão do WhatsApp é isolada por tenant e configurada no workspace administrativo de cada cliente.
                </div>
                <button className="xl:col-span-2 flex min-h-12 items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_30px_rgba(0,245,212,0.24)]">
                  Salvar configurações
                </button>
              </form>
            </section>
          ) : null}

          {currentSection === "logs" ? (
            <section className="rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
              <p className="text-xs uppercase tracking-[0.24em] text-white/40">Logs</p>
              <div className="mt-5 grid gap-3">
                {dashboard.logs.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-white/12 bg-black/10 p-4 text-sm text-white/56">
                    Nenhum log registrado ainda.
                  </div>
                ) : (
                  dashboard.logs.map((log) => (
                    <div key={log.id} className="rounded-[22px] border border-white/10 bg-black/15 p-4">
                      <p className="font-medium text-white">{log.message}</p>
                      <p className="mt-1 text-xs text-white/52">{formatDate(log.created_at)} • {log.action}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : null}
        </section>
      </div>

      {currentSection === "tenants" && drawer === "new-tenant" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020617]/78 p-4 backdrop-blur-sm">
          <div className="max-h-[94vh] w-full max-w-[1380px] overflow-y-auto rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.14),_transparent_55%),rgba(22,27,34,0.98)] p-6 shadow-[0_22px_80px_rgba(0,0,0,0.46)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/40">Novo tenant</p>
                <h3 className="mt-2 text-3xl font-semibold text-white">Cadastro completo</h3>
                <p className="mt-2 text-sm text-white/58">Tela ampliada para cadastro completo em desktop.</p>
              </div>
              <Link href={hrefFor("tenants")} className="rounded-2xl border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/75">
                Fechar
              </Link>
            </div>

            <div className="mt-6 rounded-[28px] border border-white/10 bg-black/15 p-6">
              <AdminTenantForm
                title="Novo tenant"
                submitLabel="Criar tenant"
                includeOwnerPassword
                formAction={createTenantByAdminAction}
              />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
