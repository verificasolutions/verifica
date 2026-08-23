import Link from "next/link";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { CopyTextButton } from "@/components/copy-text-button";
import type { LeadCompanyRecord, LeadEmailDispatchRecord } from "@/backend/types";
import type { getLeadHunterDashboardUseCase } from "@/backend/use-cases/admin/get-lead-hunter-dashboard";
import {
  generateLeadEmailAction,
  generateLeadAnalysisAction,
  generateLeadMessageAction,
  importLeadBatchAction,
  registerLeadActivityAction,
  runLeadHuntAction,
  saveLeadEmailSequenceAction,
  sendLeadEmailAction,
  sendLeadFirstEmailBatchAction,
  updateLeadStatusAction,
} from "@/app/admin/actions";

type DashboardData = Awaited<ReturnType<typeof getLeadHunterDashboardUseCase>>;

const inputClassName = "h-12 min-w-0 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none";
const cardClassName = "rounded-[22px] border border-white/10 bg-black/15 p-4";
const actionButtonClassName = "flex min-h-11 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-center text-sm text-white/82";

function labelForOpportunity(level: LeadCompanyRecord["opportunity_level"]) {
  if (level === "alta") return "Alta oportunidade";
  if (level === "media") return "Média oportunidade";
  return "Baixa oportunidade";
}

function labelForStatus(status: LeadCompanyRecord["status"]) {
  switch (status) {
    case "found":
      return "Novo";
    case "analyzed":
      return "Analisado";
    case "message_generated":
      return "Mensagem gerada";
    case "contacted":
      return "Contato realizado";
    case "responded":
      return "Respondeu";
    case "demo_scheduled":
      return "Demonstração marcada";
    case "closed_won":
      return "Cliente fechado";
    case "lost":
      return "Perdido";
    case "kept":
      return "Manter ativo";
    case "archived":
      return "Arquivado";
    default:
      return status;
  }
}

function formatRawCode(value: string | null | undefined) {
  return value?.trim() || "-";
}

function labelForContactQuality(value: string | null | undefined) {
  switch (value) {
    case "A_TELEFONE_E_EMAIL":
      return "Telefone e e-mail";
    case "B_SO_TELEFONE":
      return "Somente telefone";
    case "C_SO_EMAIL":
      return "Somente e-mail";
    case "D_SEM_CONTATO":
      return "Sem contato útil";
    default:
      return formatRawCode(value);
  }
}

function labelForContactRisk(value: string | null | undefined) {
  switch (value) {
    case "baixo":
      return "Baixo";
    case "medio":
      return "Médio";
    case "alto":
      return "Alto";
    default:
      return formatRawCode(value);
  }
}

function labelForContactRole(value: string | null | undefined) {
  switch (value) {
    case "provavel_empresa":
      return "Provável contato da empresa";
    case "possivel_contador":
      return "Possível contador";
    case "sem_sinal_claro":
      return "Sem sinal claro";
    default:
      return formatRawCode(value);
  }
}

function labelForRecommendedChannel(value: string | null | undefined) {
  switch (value) {
    case "whatsapp_primeiro_email_de_apoio":
      return "WhatsApp primeiro, e-mail de apoio";
    case "email_primeiro":
      return "E-mail primeiro";
    case "abordagem_contador_parceiro":
      return "Abordagem de contador/parceiro";
    case "baixa_prioridade":
      return "Baixa prioridade";
    default:
      return formatRawCode(value);
  }
}

function formatBrazilDate(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D+/g, "");
  if (digits.length !== 8) return "-";
  return `${digits.slice(6, 8)}/${digits.slice(4, 6)}/${digits.slice(0, 4)}`;
}

function labelForActivityType(value: string) {
  switch (value) {
    case "import_created":
      return "Carga importada";
    case "import_update":
      return "Lead atualizado por nova carga";
    case "analysis_generated":
      return "Análise IA gerada";
    case "message_generated":
      return "Mensagem gerada";
    case "email_generated":
      return "Rascunho de e-mail";
    case "email_sent":
      return "E-mail enviado";
    case "email_skipped":
      return "E-mail ignorado";
    case "email_delivered":
      return "E-mail entregue";
    case "email_delivery_delayed":
      return "Entrega atrasada";
    case "email_bounced":
      return "E-mail devolvido";
    case "email_complained":
      return "Marcado como spam";
    case "email_opened":
      return "E-mail aberto";
    case "email_clicked":
      return "Link clicado";
    case "email_failed":
      return "Falha no envio";
    case "email_suppressed":
      return "E-mail suprimido";
    case "email_received":
      return "Resposta recebida";
    case "email_sequence_sent":
      return "E-mail da cadÃªncia enviado";
    case "email_sequence_completed":
      return "CadÃªncia concluÃ­da";
    case "status_changed":
      return "Status alterado";
    case "manual_update":
      return "Ação manual";
    default:
      return value;
  }
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function externalLink(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://${url}`;
}

function formatRelativeDays(days: number) {
  return days === 1 ? "1 dia" : `${days} dias`;
}

function labelForEmailDispatchStatus(value: LeadEmailDispatchRecord["status"] | null | undefined) {
  switch (value) {
    case "sent":
      return "Enviado";
    case "delivered":
      return "Entregue";
    case "delivery_delayed":
      return "Atrasado";
    case "bounced":
      return "Devolvido";
    case "complained":
      return "Spam";
    case "opened":
      return "Aberto";
    case "clicked":
      return "Clicado";
    case "failed":
      return "Falhou";
    case "suppressed":
      return "Suprimido";
    case "received":
      return "Respondeu";
    default:
      return "Sem envio";
  }
}

function emailDispatchTone(value: LeadEmailDispatchRecord["status"] | null | undefined) {
  switch (value) {
    case "delivered":
    case "opened":
    case "clicked":
    case "received":
      return "bg-emerald-400/12 text-emerald-200";
    case "delivery_delayed":
    case "sent":
      return "bg-amber-400/12 text-amber-200";
    case "bounced":
    case "failed":
    case "complained":
    case "suppressed":
      return "bg-rose-400/12 text-rose-200";
    default:
      return "bg-slate-400/12 text-slate-200";
  }
}

function buildRadarReturnUrl(filters: DashboardData["filters"]) {
  const params = new URLSearchParams({ section: "radar" });
  if (filters.niche) params.set("lead_niche", String(filters.niche));
  if (filters.city) params.set("lead_city", String(filters.city));
  if (filters.state) params.set("lead_state", String(filters.state));
  if (filters.status) params.set("lead_status", String(filters.status));
  if (filters.opportunityLevel) params.set("lead_level", String(filters.opportunityLevel));
  if (filters.contactRiskLevel) params.set("lead_contact_risk", String(filters.contactRiskLevel));
  if (filters.contactRoleHint) params.set("lead_contact_role", String(filters.contactRoleHint));
  if (filters.recommendedChannel) params.set("lead_channel", String(filters.recommendedChannel));
  if (filters.withPhone !== null && filters.withPhone !== undefined) params.set("lead_with_phone", String(filters.withPhone));
  if (filters.withWebsite !== null && filters.withWebsite !== undefined) params.set("lead_with_website", String(filters.withWebsite));
  return `/admin?${params.toString()}`;
}

export function AdminLeadHunterSection({ data }: { data: DashboardData }) {
  const radarReturnUrl = buildRadarReturnUrl(data.filters);
  return (
    <div className="grid gap-4">
      <section className="rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/40">Prospecção</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Fila de empresas</h2>
            <p className="mt-2 max-w-3xl text-sm text-white/60">
              O CSV grande fica fora do banco. Aqui entram cargas pequenas para trabalhar, registrar resumo e manter histórico comercial.
            </p>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded-[20px] border border-white/10 bg-black/15 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-white/40">Fonte principal</p>
              <p className="mt-2 text-sm font-semibold text-emerald-300">Receita CNPJ por CSV</p>
            </div>
            <div className="rounded-[20px] border border-white/10 bg-black/15 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-white/40">IA opcional</p>
              <p className={`mt-2 text-sm font-semibold ${data.integrations.openAiReady ? "text-emerald-300" : "text-amber-300"}`}>
                {data.integrations.openAiReady ? "OpenAI pronta" : "OPENAI_API_KEY pendente"}
              </p>
            </div>
            <div className="rounded-[20px] border border-white/10 bg-black/15 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-white/40">Envio de e-mail</p>
              <p className={`mt-2 text-sm font-semibold ${data.integrations.resendReady ? "text-emerald-300" : "text-amber-300"}`}>
                {data.integrations.resendReady ? "Resend pronto" : "Resend pendente"}
              </p>
            </div>
          </div>
        </div>

        <form action={importLeadBatchAction} className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_180px_minmax(0,1fr)]">
          <input type="file" name="lead_file" accept=".csv,text/csv" className={inputClassName} required />
          <input name="batch_size" placeholder="Qtd. na carga" className={inputClassName} defaultValue="50" inputMode="numeric" />
          <input name="batch_label" placeholder="Nome da carga" className={inputClassName} defaultValue="VerificaWash - primeira carga" />
          <div className="xl:col-span-3">
            <AuthSubmitButton
              label="Subir carga pequena"
              pendingLabel="Importando carga..."
              className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_30px_rgba(0,245,212,0.24)]"
            />
          </div>
          <p className="text-sm text-white/54 xl:col-span-3">
            Use um CSV pequeno já filtrado. O limite por carga é 100 registros para não lotar o Supabase.
          </p>
        </form>

        <details className="mt-4 rounded-[22px] border border-white/10 bg-black/10 p-4">
          <summary className="cursor-pointer list-none text-sm font-semibold text-white/82">Busca antiga por API externa</summary>
          <form action={runLeadHuntAction} className="mt-4 grid gap-3 xl:grid-cols-[1.3fr_1fr_180px_180px_220px]">
            <input name="niche" placeholder="Nicho do negócio" className={inputClassName} defaultValue={String(data.filters.niche ?? "")} />
            <input name="city" placeholder="Cidade" className={inputClassName} defaultValue={String(data.filters.city ?? "")} />
            <input name="state" placeholder="UF" className={inputClassName} defaultValue={String(data.filters.state ?? "")} maxLength={2} />
            <input name="radius_km" placeholder="Raio em km" className={inputClassName} defaultValue="15" inputMode="numeric" />
            <input name="max_results" placeholder="Máximo" className={inputClassName} defaultValue="20" inputMode="numeric" />
            <div className="xl:col-span-5">
              <AuthSubmitButton label="Caçar por API" pendingLabel="Buscando..." className={actionButtonClassName} />
            </div>
          </form>
        </details>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <div className={cardClassName}>
          <p className="text-xs uppercase tracking-[0.2em] text-white/38">1. Entrada</p>
          <h3 className="mt-2 text-lg font-semibold text-white">Carga pequena</h3>
          <p className="mt-2 text-sm leading-6 text-white/62">Subir 50 a 100 empresas já filtradas por CNAE, ativa, UF e contato.</p>
        </div>
        <div className={cardClassName}>
          <p className="text-xs uppercase tracking-[0.2em] text-white/38">2. Triagem</p>
          <h3 className="mt-2 text-lg font-semibold text-white">Validar contato</h3>
          <p className="mt-2 text-sm leading-6 text-white/62">Marcar se parece dono, empresa, contador ou contato fraco antes de gastar tempo.</p>
        </div>
        <div className={cardClassName}>
          <p className="text-xs uppercase tracking-[0.2em] text-white/38">3. Abordagem</p>
          <h3 className="mt-2 text-lg font-semibold text-white">Telefone primeiro</h3>
          <p className="mt-2 text-sm leading-6 text-white/62">WhatsApp quando o número parecer da empresa. E-mail entra como apoio e registro.</p>
        </div>
        <div className={cardClassName}>
          <p className="text-xs uppercase tracking-[0.2em] text-white/38">4. Contador</p>
          <h3 className="mt-2 text-lg font-semibold text-white">Virar canal</h3>
          <p className="mt-2 text-sm leading-6 text-white/62">Se for contador, tratar como parceiro: ele indica clientes e ganha argumento comercial.</p>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/40">CadÃªncia de e-mail</p>
            <h3 className="mt-2 text-xl font-semibold text-white">SequÃªncia automÃ¡tica 1 a 6</h3>
            <p className="mt-2 max-w-3xl text-sm text-white/60">
              O e-mail 1 jÃ¡ fica salvo com imagem. Os prÃ³ximos ficam prontos para vocÃª colar os textos e definir o intervalo em dias.
            </p>
          </div>
          <div className="rounded-[20px] border border-white/10 bg-black/15 px-4 py-3 text-sm text-white/74">
            <p className="text-xs uppercase tracking-[0.18em] text-white/40">Regra ativa</p>
            <p className="mt-2">Quem recebeu o e-mail 1 entra na fila automÃ¡tica e o sistema nÃ£o repete esse primeiro contato.</p>
          </div>
        </div>

        <form action={saveLeadEmailSequenceAction} className="mt-5 grid gap-4">
          {data.emailSequence.steps.map((step) => (
            <div key={step.id} className="rounded-[22px] border border-white/10 bg-black/15 p-4">
              <div className="grid gap-3 xl:grid-cols-[160px_180px_minmax(0,1fr)]">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/40">E-mail {step.step_number}</p>
                  <p className="mt-2 text-sm text-white/60">
                    {step.step_number === 1 ? "Primeiro contato da tela" : `Dispara ${formatRelativeDays(step.delay_days)} depois do Ãºltimo envio.`}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <select name={`step_${step.step_number}_is_active`} defaultValue={step.is_active ? "true" : "false"} className={inputClassName}>
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                  <input
                    name={`step_${step.step_number}_delay_days`}
                    defaultValue={String(step.delay_days)}
                    className={inputClassName}
                    inputMode="numeric"
                    placeholder="Dias"
                  />
                </div>
                <div className="grid gap-3">
                  <input
                    name={`step_${step.step_number}_subject`}
                    defaultValue={step.subject ?? ""}
                    placeholder={`Assunto do e-mail ${step.step_number}`}
                    className={inputClassName}
                  />
                  <input
                    name={`step_${step.step_number}_image_url`}
                    defaultValue={step.image_url ?? ""}
                    placeholder={step.step_number === 1 ? "/lead-email-dashboard-auto.jpg" : "Imagem opcional"}
                    className={inputClassName}
                  />
                  <textarea
                    name={`step_${step.step_number}_body_text`}
                    defaultValue={step.body_text ?? ""}
                    placeholder={`Texto do e-mail ${step.step_number}`}
                    className="min-h-44 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 py-3 text-sm text-white outline-none"
                  />
                </div>
              </div>
            </div>
          ))}

          <div className="flex justify-end">
            <AuthSubmitButton
              label="Salvar cadÃªncia"
              pendingLabel="Salvando cadÃªncia..."
              className="flex min-h-12 min-w-52 items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_30px_rgba(0,245,212,0.24)]"
            />
          </div>
        </form>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/40">Filtros</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Leads em trabalho</h3>
          </div>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
            <form method="GET" action="/admin" className="grid gap-3 xl:grid-cols-4">
            <input type="hidden" name="section" value="radar" />
            <input name="lead_niche" placeholder="CNAE ou tipo" defaultValue={String(data.filters.niche ?? "")} className={inputClassName} />
            <input name="lead_city" placeholder="Município/código" defaultValue={String(data.filters.city ?? "")} className={inputClassName} />
            <input name="lead_state" placeholder="UF" defaultValue={String(data.filters.state ?? "")} className={inputClassName} />
            <select name="lead_status" defaultValue={String(data.filters.status ?? "")} className={inputClassName}>
              <option value="">Status comercial</option>
              <option value="found">Novo</option>
              <option value="analyzed">Analisado</option>
              <option value="message_generated">Mensagem gerada</option>
              <option value="contacted">Contato realizado</option>
              <option value="responded">Respondeu</option>
              <option value="demo_scheduled">Demo marcada</option>
              <option value="closed_won">Cliente fechado</option>
              <option value="lost">Perdido</option>
              <option value="kept">Manter ativo</option>
              <option value="archived">Arquivado</option>
            </select>
            <select name="lead_with_phone" defaultValue={data.filters.withPhone === null || data.filters.withPhone === undefined ? "" : String(data.filters.withPhone)} className={inputClassName}>
              <option value="">Telefone</option>
              <option value="true">Com telefone</option>
              <option value="false">Sem telefone</option>
            </select>
            <select name="lead_level" defaultValue={String(data.filters.opportunityLevel ?? "")} className={inputClassName}>
              <option value="">Oportunidade</option>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
            <select name="lead_contact_risk" defaultValue={String(data.filters.contactRiskLevel ?? "")} className={inputClassName}>
              <option value="">Risco do contato</option>
              <option value="baixo">Baixo</option>
              <option value="medio">Médio</option>
              <option value="alto">Alto</option>
            </select>
            <select name="lead_contact_role" defaultValue={String(data.filters.contactRoleHint ?? "")} className={inputClassName}>
              <option value="">Origem do contato</option>
              <option value="provavel_empresa">Provável empresa</option>
              <option value="possivel_contador">Possível contador</option>
              <option value="sem_sinal_claro">Sem sinal claro</option>
            </select>
            <select name="lead_channel" defaultValue={String(data.filters.recommendedChannel ?? "")} className={inputClassName}>
              <option value="">Canal sugerido</option>
              <option value="whatsapp_primeiro_email_de_apoio">WhatsApp primeiro</option>
              <option value="email_primeiro">E-mail primeiro</option>
              <option value="abordagem_contador_parceiro">Contador/parceiro</option>
              <option value="baixa_prioridade">Baixa prioridade</option>
            </select>
            <button className={actionButtonClassName}>Aplicar filtros</button>
            <Link href="/admin?section=radar" className={actionButtonClassName}>
              Limpar filtros
            </Link>
            </form>
            <form action={sendLeadFirstEmailBatchAction} className="rounded-[22px] border border-white/10 bg-black/15 p-4">
              <input type="hidden" name="return_url" value={radarReturnUrl} />
              {data.leads.map((item) => (
                <input key={item.lead.id} type="hidden" name="lead_company_ids" value={item.lead.id} />
              ))}
              <p className="text-xs uppercase tracking-[0.18em] text-white/40">Disparo em massa</p>
              <p className="mt-2 text-sm leading-6 text-white/62">
                Envia o e-mail 1 da cadência para todos os leads visíveis nesta tela, registra o retorno do Resend por lead e coloca cada um na fila automática.
              </p>
              <div className="mt-4">
                <AuthSubmitButton
                  label={`Enviar e-mail 1 da tela (${data.leads.length})`}
                  pendingLabel="Disparando lote..."
                  className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_30px_rgba(0,245,212,0.24)]"
                />
              </div>
            </form>
          </div>
        </div>
      </section>

      <section className="grid gap-3">
        {data.leads.length ? null : (
          <div className="rounded-[28px] border border-white/10 bg-white/6 p-6 text-sm text-white/60">
            Nenhum lead carregado. Suba a primeira carga pequena de CSV.
          </div>
        )}

        {data.leads.map((item) => (
          <article key={item.lead.id} className="rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-xl font-semibold text-white">{item.lead.business_name}</h4>
                  {item.lead.cnpj ? <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/72">CNPJ {item.lead.cnpj}</span> : null}
                  {item.lead.cnae_principal ? <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/72">CNAE {item.lead.cnae_principal}</span> : null}
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/72">{labelForStatus(item.lead.status)}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${emailDispatchTone(item.latestEmailDispatch?.status)}`}>
                    E-mail: {labelForEmailDispatchStatus(item.latestEmailDispatch?.status)}
                  </span>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/72">
                    Cadência:{" "}
                    {item.latestEmailSequenceEnrollment
                      ? `etapa ${item.latestEmailSequenceEnrollment.current_step}${item.latestEmailSequenceEnrollment.next_send_at ? ` • próximo ${formatDateTime(item.latestEmailSequenceEnrollment.next_send_at)}` : ""}`
                      : "não iniciada"}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      item.lead.opportunity_level === "alta"
                        ? "bg-emerald-400/12 text-emerald-200"
                        : item.lead.opportunity_level === "media"
                          ? "bg-amber-400/12 text-amber-200"
                          : "bg-slate-400/12 text-slate-200"
                    }`}
                  >
                    {labelForOpportunity(item.lead.opportunity_level)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-white/60">
                  {item.lead.city ? `Município ${item.lead.city}` : "Município não informado"} - {item.lead.state ?? "-"} - abertura {formatBrazilDate(item.lead.abertura_date)}
                </p>
                <p className="mt-1 text-sm text-white/60">{item.lead.address ?? "Endereço não informado"}</p>
                <p className="mt-1 text-sm text-white/60">
                  Bairro: {String(item.lead.raw_data?.bairro ?? "").trim() || "Não informado"}
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-[18px] border border-white/10 bg-black/15 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/38">Score</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{item.lead.opportunity_score}</p>
                </div>
                <div className="rounded-[18px] border border-white/10 bg-black/15 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/38">Contato</p>
                  <p className="mt-2 text-sm font-semibold text-white">{labelForContactQuality(item.lead.contato_quality)}</p>
                </div>
                <div className="rounded-[18px] border border-white/10 bg-black/15 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/38">Carga</p>
                  <p className="mt-2 text-sm font-semibold text-white">{item.lead.import_batch_label ?? "-"}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div className="space-y-4">
                <div className={cardClassName}>
                  <p className="text-sm font-semibold text-white">Dados da empresa</p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/76">
                      <p className="text-xs uppercase tracking-[0.16em] text-white/38">Município</p>
                      <p className="mt-2 text-sm font-medium text-white">
                        {item.lead.city ?? "Não informado"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/76">
                      <p className="text-xs uppercase tracking-[0.16em] text-white/38">Bairro</p>
                      <p className="mt-2 text-sm font-medium text-white">
                        {String(item.lead.raw_data?.bairro ?? "").trim() || "Não informado"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/76">
                      <p className="text-xs uppercase tracking-[0.16em] text-white/38">Telefone</p>
                      <p className="mt-2 text-sm font-medium text-white">{item.lead.phone ?? "Não informado"}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/76">
                      <p className="text-xs uppercase tracking-[0.16em] text-white/38">E-mail</p>
                      <p className="mt-2 text-sm font-medium text-white break-all">{item.lead.email ?? "Não informado"}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/76">
                      <p className="text-xs uppercase tracking-[0.16em] text-white/38">Site</p>
                      <p className="mt-2 text-sm font-medium text-white break-all">{item.lead.website ?? "Não informado"}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/76">
                      <p className="text-xs uppercase tracking-[0.16em] text-white/38">Google Maps</p>
                      <p className="mt-2 text-sm font-medium text-white">{item.lead.google_maps_url ? "Link disponível" : "Não informado"}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/76">
                      <p className="text-xs uppercase tracking-[0.16em] text-white/38">Canal sugerido</p>
                      <p className="mt-2 text-sm font-medium text-white">{labelForRecommendedChannel(item.lead.recommended_channel)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/76">
                      <p className="text-xs uppercase tracking-[0.16em] text-white/38">Risco do contato</p>
                      <p className="mt-2 text-sm font-medium text-white">{labelForContactRisk(item.lead.contact_risk_level)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/76 md:col-span-2">
                      <p className="text-xs uppercase tracking-[0.16em] text-white/38">Origem provável do contato</p>
                      <p className="mt-2 text-sm font-medium text-white">{labelForContactRole(item.lead.contact_role_hint)}</p>
                    </div>
                  </div>
                  {item.lead.contact_evidence ? (
                    <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/8 px-4 py-3 text-sm leading-6 text-amber-100">
                      Evidência usada na triagem: {item.lead.contact_evidence}
                    </div>
                  ) : null}
                  <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/76">
                    <p className="font-semibold text-white">Resumo da carga</p>
                    <p className="mt-2">
                      Qualificação: {labelForContactQuality(item.lead.contato_quality)}. Canal sugerido: {labelForRecommendedChannel(item.lead.recommended_channel)}. Origem provável: {labelForContactRole(item.lead.contact_role_hint)}.
                    </p>
                  </div>
                </div>

                <details className={cardClassName}>
                  <summary className="cursor-pointer list-none text-sm font-semibold text-white">Ver detalhes</summary>
                  <div className="mt-4 space-y-3 text-sm text-white/70">
                    <p>Fonte: {item.lead.source}</p>
                    <p>CNAEs secundários: {item.lead.cnae_secundaria ?? "-"}</p>
                    <p>Site: {item.lead.website ? item.lead.website : "Não informado"}</p>
                    <p>
                      Google Maps:{" "}
                      {item.lead.google_maps_url ? (
                        <a href={externalLink(item.lead.google_maps_url)} target="_blank" rel="noreferrer" className="text-[var(--accent)]">
                          Abrir mapa
                        </a>
                      ) : (
                        "Não informado"
                      )}
                    </p>
                    <p>Criado em: {formatDateTime(item.lead.created_at)}</p>
                    <p>Atualizado em: {formatDateTime(item.lead.updated_at)}</p>
                  </div>
                </details>
              </div>

              <div className="space-y-4">
                <div className={cardClassName}>
                  <p className="text-sm font-semibold text-white">Ações comerciais</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <form action={generateLeadAnalysisAction}>
                      <input type="hidden" name="lead_company_id" value={item.lead.id} />
                      <AuthSubmitButton label="Gerar análise IA" pendingLabel="Gerando..." className={actionButtonClassName} />
                    </form>
                    <form action={generateLeadMessageAction}>
                      <input type="hidden" name="lead_company_id" value={item.lead.id} />
                      <AuthSubmitButton label="Gerar mensagem" pendingLabel="Gerando..." className={actionButtonClassName} />
                    </form>
                    <form action={generateLeadEmailAction}>
                      <input type="hidden" name="lead_company_id" value={item.lead.id} />
                      <AuthSubmitButton label="Gerar e-mail" pendingLabel="Gerando..." className={actionButtonClassName} />
                    </form>
                    {item.latestWhatsappMessage?.message_text ? <CopyTextButton text={item.latestWhatsappMessage.message_text} className={actionButtonClassName} /> : <div className={`${actionButtonClassName} opacity-50`}>Copiar WhatsApp</div>}
                    {item.whatsappLink ? <a href={item.whatsappLink} target="_blank" rel="noreferrer" className={actionButtonClassName}>Abrir WhatsApp</a> : <div className={`${actionButtonClassName} opacity-50`}>Abrir WhatsApp</div>}
                    {item.latestEmailMessage?.message_text ? (
                      <CopyTextButton
                        text={`${item.latestEmailMessage.subject ? `Assunto: ${item.latestEmailMessage.subject}\n\n` : ""}${item.latestEmailMessage.message_text}`}
                        className={actionButtonClassName}
                      />
                    ) : (
                      <div className={`${actionButtonClassName} opacity-50`}>Copiar e-mail</div>
                    )}
                    {item.lead.email ? (
                      <form action={sendLeadEmailAction}>
                        <input type="hidden" name="lead_company_id" value={item.lead.id} />
                        <AuthSubmitButton label="Enviar e-mail" pendingLabel="Enviando..." className={actionButtonClassName} />
                      </form>
                    ) : (
                      <div className={`${actionButtonClassName} opacity-50`}>Enviar e-mail</div>
                    )}
                  </div>
                  <form action={updateLeadStatusAction} className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
                    <input type="hidden" name="lead_company_id" value={item.lead.id} />
                    <select name="status" defaultValue={item.lead.status} className={inputClassName}>
                      <option value="found">Novo</option>
                      <option value="analyzed">Analisado</option>
                      <option value="message_generated">Mensagem gerada</option>
                      <option value="contacted">Contato realizado</option>
                      <option value="responded">Respondeu</option>
                      <option value="demo_scheduled">Demo marcada</option>
                      <option value="closed_won">Cliente fechado</option>
                      <option value="lost">Perdido</option>
                      <option value="kept">Manter ativo</option>
                      <option value="archived">Arquivado</option>
                    </select>
                    <AuthSubmitButton label="Salvar status" pendingLabel="Salvando..." className={actionButtonClassName} />
                  </form>
                  <form action={registerLeadActivityAction} className="mt-3 grid gap-3">
                    <input type="hidden" name="lead_company_id" value={item.lead.id} />
                    <select name="channel" defaultValue="" className={inputClassName}>
                      <option value="">Canal da ação</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="email">E-mail</option>
                      <option value="ligacao">Ligação</option>
                      <option value="manual">Manual</option>
                    </select>
                    <textarea
                      name="note"
                      placeholder="Ex.: Hoje enviei WhatsApp e e-mail. Cliente pediu retorno amanhã."
                      className="min-h-28 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 py-3 text-sm text-white outline-none"
                    />
                    <AuthSubmitButton label="Registrar ação" pendingLabel="Registrando..." className={actionButtonClassName} />
                  </form>
                </div>

                <div className={cardClassName}>
                  <p className="text-sm font-semibold text-white">Análise IA</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/74">
                    {item.latestAnalysis?.ai_summary ?? item.latestAnalysis?.opportunity_reason ?? "Ainda não existe análise gerada para este lead."}
                  </p>
                </div>

                <div className={cardClassName}>
                  <p className="text-sm font-semibold text-white">Mensagem WhatsApp</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/74">
                    {item.latestWhatsappMessage?.message_text ?? "Ainda não existe mensagem gerada para este lead."}
                  </p>
                </div>

                <div className={cardClassName}>
                  <p className="text-sm font-semibold text-white">Rascunho de e-mail</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-white/45">Assunto</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white">
                    {item.latestEmailMessage?.subject ?? "Ainda não existe assunto gerado para este lead."}
                  </p>
                  <p className="mt-4 text-xs uppercase tracking-[0.18em] text-white/45">Corpo</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/74">
                    {item.latestEmailMessage?.message_text ?? "Ainda não existe e-mail gerado para este lead."}
                  </p>
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/76">
                    <p className="text-xs uppercase tracking-[0.16em] text-white/38">Último status no Resend</p>
                    <p className="mt-2 font-medium text-white">{labelForEmailDispatchStatus(item.latestEmailDispatch?.status)}</p>
                    <p className="mt-1 text-white/60">
                      {item.latestEmailDispatch?.provider_email_id
                        ? `ID ${item.latestEmailDispatch.provider_email_id} • ${formatDateTime(item.latestEmailDispatch.updated_at)}`
                        : "Nenhum disparo registrado ainda."}
                    </p>
                    {item.latestEmailDispatch?.last_error ? <p className="mt-2 whitespace-pre-wrap text-rose-200">{item.latestEmailDispatch.last_error}</p> : null}
                  </div>
                </div>

                <div className={cardClassName}>
                  <p className="text-sm font-semibold text-white">Histórico comercial</p>
                  <div className="mt-3 space-y-2">
                    {item.activities.length ? (
                      item.activities.map((activity) => (
                        <div key={activity.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/74">
                          <p className="font-medium text-white">{labelForActivityType(activity.activity_type)}</p>
                          <p className="mt-1 text-white/60">
                            {activity.channel ? `${activity.channel} • ` : ""}
                            {formatDateTime(activity.created_at)}
                            {activity.created_by_email ? ` • ${activity.created_by_email}` : ""}
                          </p>
                          {activity.note ? <p className="mt-2 whitespace-pre-wrap">{activity.note}</p> : null}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
                        Nenhuma ação registrada ainda.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
