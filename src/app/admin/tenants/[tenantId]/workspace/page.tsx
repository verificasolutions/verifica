import Link from "next/link";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { FlashNotice } from "@/components/flash-notice";
import {
  provisionTenantWhatsappAction,
  saveTenantInstagramConfigAction,
  saveTenantLandingConfigAction,
  saveTenantOperatorInventoryConfigAction,
  saveTenantWhatsappConfigAction,
} from "@/app/admin/actions";
import { getEvolutionConnectionState, requestEvolutionConnectionCode } from "@/backend/integrations/evolution-admin";
import { getPlatformSettingsAdmin } from "@/backend/repos/admin-control-repo";
import { getAppUrl } from "@/backend/shared/app-url";
import { getAdminTenantWorkspaceUseCase } from "@/backend/use-cases/admin/get-admin-tenant-workspace";
import { digitsOnly } from "@/backend/shared/input-normalizers";
import { maskSecret } from "@/backend/shared/tenant-whatsapp";

type WorkspaceQueueItem = {
  id: string;
  status: string;
  final_price: number;
  public_code: string;
  customers?: { name: string } | null;
  vehicles?: { plate: string; model: string; color: string | null } | null;
  services?: { name: string } | null;
  employees?: { name: string } | null;
};

type WorkspaceAppointmentItem = {
  id: string;
  scheduled_for: string;
  customers?: { name: string } | null;
  vehicles?: { model: string; plate: string } | null;
  services?: { name: string } | null;
};

type WorkspaceCustomerItem = {
  id: string;
  name: string;
  whatsapp: string | null;
};

type WorkspaceEmployeeItem = {
  id: string;
  name: string;
  role_label: string;
  is_present: boolean;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatConnectionState(value: string | null) {
  if (!value) return "Não provisionado";

  const map: Record<string, string> = {
    open: "Conectado",
    close: "Desconectado",
    connecting: "Conectando",
    qrcode: "Aguardando pareamento",
  };

  return map[value] ?? value;
}

function buildQrImageSrc(value: string | null) {
  if (!value) return null;
  if (value.startsWith("data:image/")) return value;
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(value)}`;
}

export default async function AdminTenantWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ error?: string; message?: string; connect?: string; whatsapp_status?: string }>;
}) {
  const { tenantId } = await params;
  const { error, message, connect, whatsapp_status: whatsappStatus } = await searchParams;
  const [workspace, platformSettings] = await Promise.all([getAdminTenantWorkspaceUseCase(tenantId), getPlatformSettingsAdmin()]);

  const queue = workspace.queue as WorkspaceQueueItem[];
  const appointments = workspace.appointments as WorkspaceAppointmentItem[];
  const customers = workspace.customers as WorkspaceCustomerItem[];
  const employees = workspace.employees as WorkspaceEmployeeItem[];
  const tenantSettings = workspace.tenantSettings as {
    evolution_base_url?: string | null;
    evolution_instance?: string | null;
    evolution_api_key?: string | null;
    evolution_enabled?: boolean | null;
    customer_messages_enabled?: boolean | null;
    landing_enabled?: boolean | null;
    instagram_enabled?: boolean | null;
    operator_inventory_enabled?: boolean | null;
    whatsapp_pairing_token?: string | null;
  } | null;

  const masterEvolutionReady = Boolean(platformSettings?.whatsapp_base_url && platformSettings.evolution_api_key && platformSettings.evolution_enabled);
  const tenantPhone = digitsOnly(workspace.tenant.whatsapp ?? "");
  const appUrl = getAppUrl();
  const publicPairingPath = tenantSettings?.whatsapp_pairing_token ? `/pareamento/${tenantSettings.whatsapp_pairing_token}` : null;
  const publicPairingUrl = publicPairingPath && appUrl ? `${appUrl}${publicPairingPath}` : publicPairingPath;

  let connectionState: string | null = null;
  let connectionError: string | null = null;
  let pairingCode: string | null = null;
  let qrCode: string | null = null;

  const shouldFetchWhatsappState = connect === "1" || whatsappStatus === "1";

  if (shouldFetchWhatsappState && masterEvolutionReady && tenantSettings?.evolution_instance) {
    const stateResult = await getEvolutionConnectionState({
      config: {
        baseUrl: platformSettings!.whatsapp_base_url!,
        masterApiKey: platformSettings!.evolution_api_key!,
      },
      instanceName: tenantSettings.evolution_instance,
    });

    if (stateResult.ok) {
      connectionState = stateResult.state ?? null;
    } else {
      connectionError = stateResult.message ?? null;
    }

    if (connect === "1") {
      const connectResult = await requestEvolutionConnectionCode({
        config: {
          baseUrl: platformSettings!.whatsapp_base_url!,
          masterApiKey: platformSettings!.evolution_api_key!,
        },
        instanceName: tenantSettings.evolution_instance,
      });

      if (connectResult.ok) {
        pairingCode = connectResult.pairingCode ?? null;
        qrCode = connectResult.qrCode ?? null;
      } else {
        connectionError = connectResult.message ?? null;
      }
    }
  }

  return (
    <main className="min-h-screen bg-[#0d1117] px-4 py-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4">
        <FlashNotice error={error ?? connectionError ?? undefined} message={message} />

        <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(0,245,212,0.14),_transparent_52%),rgba(22,27,34,0.94)] p-5 shadow-[0_18px_56px_rgba(0,0,0,0.32)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Link href={`/admin/tenants/${tenantId}`} className="text-sm text-[var(--accent)]">
                Voltar ao resumo
              </Link>
              <p className="mt-3 text-xs uppercase tracking-[0.24em] text-white/45">Workspace de suporte</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">{workspace.tenant.name}</h1>
              <p className="mt-1 text-sm text-white/60">
                {workspace.companyProfile?.trade_name ?? workspace.tenant.name} • {workspace.subscription?.plans?.name ?? "Sem plano"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:min-w-[360px]">
              {[
                ["Atendimentos", String(workspace.stats.attendances)],
                ["Clientes", String(workspace.stats.customers)],
                ["Equipe", String(workspace.stats.employees)],
                ["Caixa", workspace.cashSession?.status === "open" ? "Aberto" : "Fechado"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[20px] border border-white/10 bg-black/15 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/40">{label}</p>
                  <p className="mt-2 text-lg font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_420px]">
          <section className="space-y-4">
            <section id="whatsapp-tenant" className="rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-white/40">Fila do dia</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Operação atual do tenant</h2>
                </div>
                <Link href={`/admin?section=comercial&tab=assinaturas&tenant_id=${tenantId}`} className="rounded-2xl border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/82">
                  Abrir comercial
                </Link>
              </div>

              <div className="mt-5 grid gap-3">
                {queue.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-white/12 bg-black/10 p-4 text-sm text-white/56">
                    Nenhum atendimento ativo no momento.
                  </div>
                ) : (
                  queue.map((item) => (
                    <div key={item.id} className="rounded-[22px] border border-white/10 bg-black/15 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-white">
                            {item.vehicles?.model ?? "Veículo"}
                            {item.vehicles?.color ? ` ${item.vehicles.color}` : ""}
                          </p>
                          <p className="text-sm text-white/56">{item.vehicles?.plate}</p>
                          <p className="mt-2 text-sm text-white/72">
                            {item.customers?.name} • {item.services?.name}
                          </p>
                          <p className="mt-1 text-sm text-white/56">
                            Lavador: {item.employees?.name ?? "Não atribuído"}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/75">{item.status}</span>
                          <p className="mt-3 text-sm font-semibold text-white">{formatCurrency(Number(item.final_price ?? 0))}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link href={`/acompanhar/${item.public_code}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/82">
                          Abrir link público
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
              <p className="text-xs uppercase tracking-[0.24em] text-white/40">Agendamentos</p>
              <div className="mt-5 grid gap-3">
                {appointments.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-white/12 bg-black/10 p-4 text-sm text-white/56">
                    Nenhum agendamento ativo.
                  </div>
                ) : (
                  appointments.map((item) => (
                    <div key={item.id} className="rounded-[22px] border border-white/10 bg-black/15 p-4">
                      <p className="text-base font-semibold text-white">{new Date(item.scheduled_for).toLocaleString("pt-BR")}</p>
                      <p className="mt-1 text-sm text-white/60">
                        {item.customers?.name} • {item.vehicles?.model ?? "Carro"} • {item.services?.name}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </section>

          <aside className="space-y-4">
            <section className="rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
              <p className="text-xs uppercase tracking-[0.24em] text-white/40">WhatsApp do tenant</p>
              <p className="mt-2 text-sm text-white/60">
                O tenant edita só os textos automáticos. A conexão técnica é provisionada aqui uma vez, com instância e token próprios por cliente.
              </p>

              <div className="mt-5 space-y-3">
                {[
                  ["Infra master", masterEvolutionReady ? "Pronta" : "Pendente"],
                  ["Status da conexão", shouldFetchWhatsappState ? formatConnectionState(connectionState) : "Consultar sob demanda"],
                  ["Instância", tenantSettings?.evolution_instance ?? "Será gerada automaticamente"],
                  ["Token do tenant", maskSecret(tenantSettings?.evolution_api_key)],
                  ["Número do tenant", tenantPhone || "Cadastre o WhatsApp da empresa"],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-[20px] border border-white/10 bg-black/15 px-4 py-3">
                    <span className="text-sm text-white/60">{label}</span>
                    <span className="text-sm font-semibold text-white">{value}</span>
                  </div>
                ))}
              </div>

              <form action={saveTenantWhatsappConfigAction} className="mt-5 rounded-[22px] border border-white/10 bg-black/15 p-4">
                <input type="hidden" name="tenant_id" value={tenantId} />
                <input type="hidden" name="evolution_base_url" value={tenantSettings?.evolution_base_url ?? ""} />
                <input type="hidden" name="evolution_instance" value={tenantSettings?.evolution_instance ?? ""} />
                <input type="hidden" name="evolution_api_key" value={tenantSettings?.evolution_api_key ?? ""} />
                <input type="hidden" name="evolution_enabled" value="false" />
                <input type="hidden" name="customer_messages_enabled" value="false" />

                <p className="text-sm font-semibold text-white">Liberação do tenant</p>
                <div className="mt-4 space-y-3">
                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/82">
                    <input
                      type="checkbox"
                      name="evolution_enabled"
                      value="true"
                      defaultChecked={tenantSettings?.evolution_enabled ?? false}
                      className="size-4"
                    />
                    Conexão técnica ativa
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/82">
                    <input
                      type="checkbox"
                      name="customer_messages_enabled"
                      value="true"
                      defaultChecked={tenantSettings?.customer_messages_enabled ?? false}
                      className="size-4"
                    />
                    Tenant pode usar mensagens automáticas
                  </label>
                </div>

                <AuthSubmitButton
                  label="Salvar liberação"
                  pendingLabel="Salvando liberação..."
                  className="mt-4 flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/6 px-4 text-sm font-semibold text-white/86 transition disabled:cursor-not-allowed disabled:opacity-70"
                />
              </form>

              <div className="mt-5 grid gap-3">
                <Link
                  href={`/admin/tenants/${tenantId}/workspace?whatsapp_status=1#whatsapp-tenant`}
                  className="flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/6 px-4 text-sm font-semibold text-white/86"
                >
                  Consultar status da conexão
                </Link>

                <form action={provisionTenantWhatsappAction}>
                  <input type="hidden" name="tenant_id" value={tenantId} />
                  <button className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950">
                    Provisionar conexão
                  </button>
                </form>

                {publicPairingUrl ? (
                  <Link
                    href={publicPairingUrl}
                    target="_blank"
                    className="flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/6 px-4 text-sm font-semibold text-white/86"
                  >
                    Abrir tela pública de pareamento
                  </Link>
                ) : null}

                {platformSettings?.whatsapp_base_url ? (
                  <Link
                    href={`${platformSettings.whatsapp_base_url.replace(/\/+$/, "")}/manager`}
                    target="_blank"
                    className="flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/6 px-4 text-sm font-semibold text-white/86"
                  >
                    Abrir manager da Evolution
                  </Link>
                ) : null}
              </div>

              {!masterEvolutionReady ? (
                <div className="mt-4 rounded-[20px] border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
                  Falta configurar a URL e a chave mestre da Evolution no Admin Master para provisionar automaticamente os tenants.
                </div>
              ) : null}

              {publicPairingUrl ? (
                <div className="mt-4 rounded-[22px] border border-white/10 bg-black/15 p-4 text-sm text-white/80">
                  <p className="font-semibold text-white">Link para enviar ao tenant</p>
                  <input
                    readOnly
                    value={publicPairingUrl}
                    className="mt-3 h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
                  />
                </div>
              ) : null}

              {pairingCode || qrCode ? (
                <div className="mt-4 rounded-[22px] border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-100">
                  <p className="font-semibold text-white">Pareamento gerado</p>
                  <p className="mt-2">Envie o QR Code abaixo para o cliente abrir em outra tela e conectar o WhatsApp dele.</p>
                  <p className="mt-2">Código curto: {pairingCode ?? "não retornado"}</p>
                  {buildQrImageSrc(qrCode) ? (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-white p-3">
                      <img src={buildQrImageSrc(qrCode)!} alt="QR Code de pareamento do WhatsApp" className="mx-auto h-auto w-full max-w-[280px]" />
                    </div>
                  ) : qrCode ? (
                    <textarea
                      readOnly
                      value={qrCode}
                      className="mt-3 h-32 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-3 py-3 text-xs text-white outline-none"
                    />
                  ) : null}
                  <p className="mt-3 text-xs text-emerald-100/80">
                    Se o cliente estiver longe, mande esse QR para ele abrir em outro aparelho ou computador e conectar em
                    `Configurações &gt; Aparelhos conectados`.
                  </p>
                </div>
              ) : null}
            </section>

            <section className="rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
              <p className="text-xs uppercase tracking-[0.24em] text-white/40">Landing pública do tenant</p>
              <p className="mt-2 text-sm text-white/60">
                Todo tenant já nasce com a estrutura da página pública. Aqui o admin decide se ela pode ou não ficar acessível para o cliente final.
              </p>

              <div className="mt-5 space-y-3">
                {[
                  ["Liberação", tenantSettings?.landing_enabled ? "Ativa" : "Bloqueada"],
                  ["URL pública", workspace.tenant.slug ? `/${workspace.tenant.slug}` : "Sem slug"],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-[20px] border border-white/10 bg-black/15 px-4 py-3">
                    <span className="text-sm text-white/60">{label}</span>
                    <span className="text-sm font-semibold text-white">{value}</span>
                  </div>
                ))}
              </div>

              <form action={saveTenantLandingConfigAction} className="mt-5 rounded-[22px] border border-white/10 bg-black/15 p-4">
                <input type="hidden" name="tenant_id" value={tenantId} />
                <input type="hidden" name="tenant_slug" value={workspace.tenant.slug ?? ""} />
                <input type="hidden" name="landing_enabled" value="false" />

                <p className="text-sm font-semibold text-white">Liberação do tenant</p>
                <div className="mt-4 space-y-3">
                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/82">
                    <input
                      type="checkbox"
                      name="landing_enabled"
                      value="true"
                      defaultChecked={tenantSettings?.landing_enabled ?? false}
                      className="size-4"
                    />
                    Tenant pode usar a landing pública
                  </label>
                </div>

                <AuthSubmitButton
                  label="Salvar liberação"
                  pendingLabel="Salvando liberação..."
                  className="mt-4 flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/6 px-4 text-sm font-semibold text-white/86 transition disabled:cursor-not-allowed disabled:opacity-70"
                />
              </form>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
              <p className="text-xs uppercase tracking-[0.24em] text-white/40">Instagram do tenant</p>
              <p className="mt-2 text-sm text-white/60">
                Aqui o admin master libera ou bloqueia o uso do Instagram. A conexão da conta acontece dentro do próprio tenant, na área social.
              </p>

              <div className="mt-5 space-y-3">
                {[
                  ["Liberação", tenantSettings?.instagram_enabled ? "Ativa" : "Bloqueada"],
                  ["Modo inicial", "Manual"],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-[20px] border border-white/10 bg-black/15 px-4 py-3">
                    <span className="text-sm text-white/60">{label}</span>
                    <span className="text-sm font-semibold text-white">{value}</span>
                  </div>
                ))}
              </div>

              <form action={saveTenantInstagramConfigAction} className="mt-5 rounded-[22px] border border-white/10 bg-black/15 p-4">
                <input type="hidden" name="tenant_id" value={tenantId} />
                <input type="hidden" name="instagram_enabled" value="false" />

                <p className="text-sm font-semibold text-white">Liberação do tenant</p>
                <div className="mt-4 space-y-3">
                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/82">
                    <input
                      type="checkbox"
                      name="instagram_enabled"
                      value="true"
                      defaultChecked={tenantSettings?.instagram_enabled ?? false}
                      className="size-4"
                    />
                    Tenant pode conectar e publicar no Instagram
                  </label>
                </div>

                <AuthSubmitButton
                  label="Salvar liberação"
                  pendingLabel="Salvando liberação..."
                  className="mt-4 flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/6 px-4 text-sm font-semibold text-white/86 transition disabled:cursor-not-allowed disabled:opacity-70"
                />
              </form>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
              <p className="text-xs uppercase tracking-[0.24em] text-white/40">Estoque no operador</p>
              <p className="mt-2 text-sm text-white/60">
                Aqui o admin master decide se o operador pode lançar produto, criar prateleira e usar a câmera do celular para ler código de barras.
              </p>

              <div className="mt-5 space-y-3">
                {[
                  ["Liberação", tenantSettings?.operator_inventory_enabled ? "Ativa" : "Bloqueada"],
                  ["Escopo", "Prateleiras, cadastro, leitura e movimentação"],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-[20px] border border-white/10 bg-black/15 px-4 py-3">
                    <span className="text-sm text-white/60">{label}</span>
                    <span className="text-sm font-semibold text-white">{value}</span>
                  </div>
                ))}
              </div>

              <form action={saveTenantOperatorInventoryConfigAction} className="mt-5 rounded-[22px] border border-white/10 bg-black/15 p-4">
                <input type="hidden" name="tenant_id" value={tenantId} />
                <input type="hidden" name="operator_inventory_enabled" value="false" />

                <p className="text-sm font-semibold text-white">Liberação do tenant</p>
                <div className="mt-4 space-y-3">
                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/82">
                    <input
                      type="checkbox"
                      name="operator_inventory_enabled"
                      value="true"
                      defaultChecked={tenantSettings?.operator_inventory_enabled ?? false}
                      className="size-4"
                    />
                    Operador pode acessar e movimentar o estoque
                  </label>
                </div>

                <AuthSubmitButton
                  label="Salvar liberação"
                  pendingLabel="Salvando liberação..."
                  className="mt-4 flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/6 px-4 text-sm font-semibold text-white/86 transition disabled:cursor-not-allowed disabled:opacity-70"
                />
              </form>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
              <p className="text-xs uppercase tracking-[0.24em] text-white/40">Financeiro</p>
              <div className="mt-5 space-y-3">
                {[
                  ["Dinheiro", workspace.cashTotals.cash],
                  ["Pix", workspace.cashTotals.pix],
                  ["Cartão", workspace.cashTotals.card],
                  ["Pendente", workspace.cashTotals.pending],
                  ["Despesas", workspace.cashTotals.expenses],
                  ["Bruto", workspace.cashTotals.gross],
                  ["Líquido", workspace.cashTotals.net],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-[20px] border border-white/10 bg-black/15 px-4 py-3">
                    <span className="text-sm text-white/60">{label}</span>
                    <span className="text-sm font-semibold text-white">{formatCurrency(Number(value))}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
              <p className="text-xs uppercase tracking-[0.24em] text-white/40">Clientes recentes</p>
              <div className="mt-5 space-y-3">
                {customers.map((customer) => (
                  <div key={customer.id} className="rounded-[20px] border border-white/10 bg-black/15 p-4">
                    <p className="text-base font-semibold text-white">{customer.name}</p>
                    <p className="mt-1 text-sm text-white/56">{customer.whatsapp ?? "Sem WhatsApp"}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
              <p className="text-xs uppercase tracking-[0.24em] text-white/40">Equipe</p>
              <div className="mt-5 space-y-3">
                {employees.map((employee) => (
                  <div key={employee.id} className="rounded-[20px] border border-white/10 bg-black/15 p-4">
                    <p className="text-base font-semibold text-white">{employee.name}</p>
                    <p className="mt-1 text-sm text-white/56">
                      {employee.role_label} • {employee.is_present ? "Presente" : "Ausente"}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
