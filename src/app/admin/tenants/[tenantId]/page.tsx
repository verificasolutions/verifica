import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { AdminTenantForm } from "@/components/admin-tenant-form";
import { FlashNotice } from "@/components/flash-notice";
import { requirePlatformAdmin } from "@/backend/auth/guards";
import { getAdminTenantPreviewUseCase } from "@/backend/use-cases/admin/get-admin-tenant-preview";
import { saveTenantByAdminAction, toggleTenantStatusAction } from "@/app/admin/actions";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function digitsOnly(value: string | null | undefined) {
  return String(value ?? "").replace(/\D+/g, "");
}

function formatPhone(value: string | null | undefined) {
  const digits = digitsOnly(value).slice(0, 11);
  if (!digits) return "não informado";
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCnpj(value: string | null | undefined) {
  const digits = digitsOnly(value).slice(0, 14);
  if (!digits) return "não informado";
  if (digits.length < 14) return digits;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatCep(value: string | null | undefined) {
  const digits = digitsOnly(value).slice(0, 8);
  if (!digits) return "não informado";
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function formatRegistration(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized || "não informado";
}

type Search = {
  error?: string;
  message?: string;
  drawer?: string;
};

export default async function AdminTenantPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<Search>;
}) {
  const [{ tenantId }, { error, message, drawer }, admin] = await Promise.all([params, searchParams, requirePlatformAdmin()]);
  const preview = await getAdminTenantPreviewUseCase(tenantId);
  const tenantFormValues = {
    tenant_name: preview.tenant.name,
    slug: preview.tenant.slug ?? "",
    trade_name: preview.companyProfile?.trade_name ?? "",
    legal_name: preview.companyProfile?.legal_name ?? "",
    cnpj: preview.companyProfile?.cnpj ?? "",
    state_registration: preview.companyProfile?.state_registration ?? "",
    municipal_registration: preview.companyProfile?.municipal_registration ?? "",
    company_email: preview.companyProfile?.email ?? "",
    company_phone: preview.companyProfile?.phone ?? "",
    website: preview.companyProfile?.website ?? "",
    company_phone_secondary: preview.companyProfile?.phone_secondary ?? "",
    operational_profile: preview.tenant.operational_profile ?? "automotive",
    postal_code: preview.companyProfile?.postal_code ?? "",
    street: preview.companyProfile?.street ?? "",
    street_number: preview.companyProfile?.street_number ?? "",
    complement: preview.companyProfile?.complement ?? "",
    neighborhood: preview.companyProfile?.neighborhood ?? "",
    city: preview.companyProfile?.city ?? "",
    state: preview.companyProfile?.state ?? "",
    country: preview.companyProfile?.country ?? "Brasil",
    owner_name: preview.companyProfile?.representative_name ?? "",
    representative_role: preview.companyProfile?.representative_role ?? "",
    owner_email: preview.companyProfile?.representative_email ?? "",
    representative_phone: preview.companyProfile?.representative_phone ?? "",
    representative_phone_secondary: preview.companyProfile?.representative_phone_secondary ?? "",
  };

  const fullAddress =
    [
      preview.companyProfile?.street,
      preview.companyProfile?.street_number,
      preview.companyProfile?.complement,
      preview.companyProfile?.neighborhood,
      preview.companyProfile?.city,
      preview.companyProfile?.state,
    ]
      .filter(Boolean)
      .join(", ") || "não informado";

  return (
    <AdminShell currentSection="tenants" adminEmail={admin.email}>
      <FlashNotice error={error} message={message} />

      <section className="rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(0,245,212,0.16),_transparent_34%),linear-gradient(135deg,_rgba(56,189,248,0.1),_rgba(22,27,34,0.96))] p-6 shadow-[0_18px_56px_rgba(0,0,0,0.32)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <Link href="/admin?section=tenants" className="text-sm text-[var(--accent)]">
              Voltar para tenants
            </Link>
            <p className="mt-4 text-xs uppercase tracking-[0.28em] text-white/45">Gestão do tenant</p>
            <h1 className="mt-2 text-4xl font-semibold text-white">{preview.companyProfile?.trade_name ?? preview.tenant.name}</h1>
            <p className="mt-2 text-sm text-white/58">
              {preview.companyProfile?.legal_name ?? "Razão social não informada"} • /{preview.tenant.slug ?? "sem-slug"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/admin/tenants/${tenantId}?drawer=edit-tenant`}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/6 px-4 text-sm font-medium text-white/82"
            >
              Editar tenant
            </Link>
            <form action={toggleTenantStatusAction}>
              <input type="hidden" name="tenant_id" value={tenantId} />
              <input type="hidden" name="next_value" value={preview.tenant.is_active ? "false" : "true"} />
              <input type="hidden" name="redirect_to" value={`/admin/tenants/${tenantId}?message=Status do tenant atualizado.`} />
              <button className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 text-sm font-medium text-amber-100">
                {preview.tenant.is_active ? "Inativar tenant" : "Reativar tenant"}
              </button>
            </form>
            <Link
              href={`/admin/tenants/${tenantId}/users`}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 text-sm font-medium text-[var(--accent)]"
            >
              Usuários do tenant
            </Link>
            <Link
              href={`/admin/tenants/${tenantId}/workspace#whatsapp-tenant`}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/6 px-4 text-sm font-medium text-white/82"
            >
              WhatsApp e mensagens
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {[
          ["Atendimentos", String(preview.stats.attendances)],
          ["Clientes", String(preview.stats.customers)],
          ["Veículos", String(preview.stats.vehicles)],
          ["Equipe", String(preview.stats.employees)],
          ["Serviços", String(preview.stats.services)],
          ["Mensalidade", formatCurrency(preview.subscription?.amount ?? 0)],
        ].map(([label, value]) => (
          <section key={label} className="rounded-[24px] border border-white/10 bg-white/6 p-4 shadow-[0_12px_32px_rgba(0,0,0,0.22)]">
            <p className="text-xs uppercase tracking-[0.16em] text-white/40">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
          </section>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.75fr)]">
        <section className="rounded-[26px] border border-white/10 bg-white/6 p-5 shadow-[0_12px_32px_rgba(0,0,0,0.22)]">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/40">Dados do tenant</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Identificação e contatos</h2>
          </div>

          <div className="mt-5 space-y-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
              <InfoLine label="Nome operacional" value={preview.tenant.name} />
              <InfoLine label="Nome fantasia" value={preview.companyProfile?.trade_name ?? "não informado"} />
            </div>

            <div className="grid gap-4">
              <InfoLine label="Razão social" value={preview.companyProfile?.legal_name ?? "não informado"} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(220px,0.8fr)_minmax(220px,0.8fr)_minmax(220px,0.8fr)]">
              <InfoLine label="CNPJ" value={formatCnpj(preview.companyProfile?.cnpj)} />
              <InfoLine label="Inscrição estadual" value={formatRegistration(preview.companyProfile?.state_registration)} />
              <InfoLine label="Inscrição municipal" value={formatRegistration(preview.companyProfile?.municipal_registration)} />
            </div>

            <div className="grid gap-4">
              <InfoLine label="E-mail da empresa" value={preview.companyProfile?.email ?? "não informado"} />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <InfoLine label="Telefone principal" value={formatPhone(preview.companyProfile?.phone)} />
              <InfoLine label="Telefone adicional" value={formatPhone(preview.companyProfile?.phone_secondary)} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
              <InfoLine label="Responsável" value={preview.companyProfile?.representative_name ?? "não informado"} />
              <InfoLine label="Cargo do responsável" value={preview.companyProfile?.representative_role ?? "não informado"} />
            </div>

            <div className="grid gap-4">
              <InfoLine label="E-mail do responsável" value={preview.companyProfile?.representative_email ?? "não informado"} />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <InfoLine label="Telefone do responsável" value={formatPhone(preview.companyProfile?.representative_phone)} />
              <InfoLine label="Telefone adicional do responsável" value={formatPhone(preview.companyProfile?.representative_phone_secondary)} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
              <InfoLine label="CEP" value={formatCep(preview.companyProfile?.postal_code)} />
              <InfoLine label="Endereço completo" value={fullAddress} />
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <section className="rounded-[26px] border border-white/10 bg-white/6 p-5 shadow-[0_12px_32px_rgba(0,0,0,0.22)]">
            <p className="text-xs uppercase tracking-[0.24em] text-white/40">Assinatura</p>
            <div className="mt-4 space-y-3">
              <InfoLine label="Plano" value={preview.subscription?.plans?.name ?? "Sem plano"} compact />
              <InfoLine label="Status" value={preview.subscription?.status ?? "Sem assinatura"} compact />
              <InfoLine label="Valor" value={formatCurrency(preview.subscription?.amount ?? 0)} compact />
              <InfoLine label="Próximo ciclo" value={preview.subscription?.current_period_end ?? preview.subscription?.trial_ends_at ?? "não definido"} compact />
            </div>
          </section>

          <section className="rounded-[26px] border border-white/10 bg-white/6 p-5 shadow-[0_12px_32px_rgba(0,0,0,0.22)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/40">Usuários</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Acesso da equipe</h2>
              </div>
              <Link
                href={`/admin/tenants/${tenantId}/users`}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 text-sm font-medium text-[var(--accent)]"
              >
                Abrir lista
              </Link>
            </div>

            <div className="mt-5 rounded-[20px] border border-dashed border-white/12 bg-black/10 p-4 text-sm text-white/60">
              A gestão de usuários fica em uma tela própria. Lá você vê a lista, adiciona, edita, inativa e exclui.
            </div>
          </section>
        </section>
      </div>

      {drawer === "edit-tenant" ? (
        <section className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4 py-8">
          <div className="max-h-[92vh] w-full max-w-[1180px] overflow-y-auto rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.14),_transparent_55%),rgba(22,27,34,0.98)] p-6 shadow-[0_22px_80px_rgba(0,0,0,0.46)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/40">Editar tenant</p>
                <h2 className="mt-2 text-3xl font-semibold text-white">Atualizar cadastro completo</h2>
              </div>
              <Link href={`/admin/tenants/${tenantId}`} className="rounded-2xl border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/75">
                Fechar
              </Link>
            </div>

            <div className="mt-6">
              <AdminTenantForm
                tenantId={tenantId}
                title="Editar tenant"
                submitLabel="Salvar tenant"
                values={tenantFormValues}
                formAction={saveTenantByAdminAction}
              />
            </div>
          </div>
        </section>
      ) : null}
    </AdminShell>
  );
}

function InfoLine({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={`rounded-[20px] border border-white/10 bg-black/15 ${compact ? "px-4 py-3" : "px-5 py-4"}`}>
      <p className="text-xs uppercase tracking-[0.16em] text-white/40">{label}</p>
      <p className={`mt-2 break-words text-white/84 ${compact ? "text-sm" : "text-[15px] leading-6"}`}>{value}</p>
    </div>
  );
}
