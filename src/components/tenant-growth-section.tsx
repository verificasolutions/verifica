import { AuthSubmitButton } from "@/components/auth-submit-button";
import type { TenantGrowthWorkspace } from "@/backend/use-cases/tenant/get-tenant-growth-workspace";
import { saveTenantGrowthStepAction } from "@/app/app/dashboard/actions";

export function TenantGrowthSection({ workspace }: { workspace: TenantGrowthWorkspace }) {
  return (
    <section className="rounded-[28px] border border-[color:var(--surface-border)] bg-[color:var(--surface-panel)] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.24)] backdrop-blur-xl lg:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--text-soft)]">Crescendo e evoluindo</p>
          <h2 className="mt-2 text-xl font-semibold text-[color:var(--text-primary)] lg:text-2xl">Plano guiado de evolução do negócio</h2>
          <p className="mt-2 max-w-3xl text-sm text-[color:var(--text-muted)]">
            Preencha etapa por etapa, organize a empresa com método e acompanhe a maturidade do negócio dentro do próprio SaaS.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Progresso geral" value={`${workspace.stats.completionRate}%`} tone="accent" />
        <MetricCard label="Etapas concluídas" value={String(workspace.stats.completedSteps)} />
        <MetricCard label="Etapas abertas" value={String(workspace.stats.pendingSteps)} tone="alert" />
        <MetricCard label="Total do plano" value={String(workspace.stats.totalSteps)} />
      </div>

      <div className="mt-5 h-3 overflow-hidden rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),#57c7ff)] transition-all"
          style={{ width: `${workspace.stats.completionRate}%` }}
        />
      </div>

      <div className="mt-6 grid gap-4">
        {workspace.phases.map((phase) => (
          <div key={phase.key} className="rounded-[24px] border border-[color:var(--surface-border)] bg-black/10 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--text-soft)]">{phase.key}</p>
                <h3 className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">{phase.title}</h3>
                <p className="mt-2 max-w-3xl text-sm text-[color:var(--text-muted)]">{phase.description}</p>
              </div>
              <div className="rounded-[18px] border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-secondary)]">
                {phase.completedCount} de {phase.totalSteps} concluídas
              </div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {phase.steps.map((step) => (
                <form key={step.key} action={saveTenantGrowthStepAction} className="rounded-[22px] border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] p-4">
                  <input type="hidden" name="redirect_to" value="/app/dashboard?section=crescendo" />
                  <input type="hidden" name="step_key" value={step.key} />

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-[color:var(--text-primary)]">{step.title}</p>
                      <p className="mt-2 text-sm text-[color:var(--text-muted)]">{step.description}</p>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] ${
                        step.completed
                          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                          : "border-amber-300/20 bg-amber-300/10 text-amber-100"
                      }`}
                    >
                      {step.completed ? "Concluída" : "Em aberto"}
                    </span>
                  </div>

                  <div className="mt-4 rounded-[18px] border border-dashed border-[color:var(--surface-border)] bg-black/10 p-3 text-sm text-[color:var(--text-secondary)]">
                    {step.prompt}
                  </div>

                  <textarea
                    name="notes"
                    defaultValue={step.notes}
                    placeholder="Registre aqui o que já está definido, o que falta e como pretende executar."
                    className="mt-4 min-h-28 w-full rounded-2xl border border-[color:var(--surface-border)] bg-[#0f141b] px-4 py-3 text-sm text-white outline-none"
                  />

                  <label className="mt-4 flex items-center gap-3 rounded-2xl border border-[color:var(--surface-border)] bg-black/10 px-4 py-3 text-sm text-[color:var(--text-secondary)]">
                    <input type="checkbox" name="completed" defaultChecked={step.completed} className="size-4 accent-[var(--accent)]" />
                    Marcar esta etapa como concluída
                  </label>

                  <div className="mt-4">
                    <AuthSubmitButton
                      label="Salvar etapa"
                      pendingLabel="Salvando etapa..."
                      className="flex min-h-11 w-full items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950"
                    />
                  </div>
                </form>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "accent" | "alert";
}) {
  const toneClass =
    tone === "accent"
      ? "border-[var(--accent)] bg-[linear-gradient(135deg,rgba(0,245,212,0.16),rgba(56,189,248,0.08))]"
      : tone === "alert"
        ? "border-amber-300/20 bg-amber-300/10"
        : "border-[color:var(--surface-border)] bg-[color:var(--surface-soft)]";

  return (
    <div className={`rounded-[22px] border p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--text-soft)]">{label}</p>
      <p className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">{value}</p>
    </div>
  );
}
