import Link from "next/link";
import { requireCustomer } from "@/backend/auth/guards";
import { rpcCustomerListVehicles } from "@/backend/repos/customer-rpc-repo";
import { rpcCustomerLoyaltySummary } from "@/backend/repos/customer-rpc-repo";
import { getPublicTenantSiteCritical } from "@/backend/repos/public-tenant-site-repo";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function FidelidadePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { token, customer } = await requireCustomer();
  const vehicles = await rpcCustomerListVehicles(token);
  const vehicleId = String(params.vehicle ?? vehicles.data?.[0]?.id ?? "");
  const summary = vehicleId ? await rpcCustomerLoyaltySummary({ token, vehicleId }) : null;
  const vehicle = (vehicles.data ?? []).find((v) => v.id === vehicleId);
  const data = summary?.data;
  const site = customer.tenantSlug ? await getPublicTenantSiteCritical(customer.tenantSlug) : null;

  const washesRequired = data?.washes_required ?? 10;
  const washesCompleted = data?.washes_completed ?? 0;
  const positions = Array.from({ length: washesRequired }, (_, index) => index + 1);

  return (
    <main className="relative isolate mx-auto min-h-[100dvh] w-full max-w-md space-y-4 overflow-hidden px-4 py-6">
      {site?.landing?.cover_image_url ? <div aria-hidden="true" className="customer-portal-banner pointer-events-none fixed inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: `linear-gradient(rgba(13,17,23,.76),rgba(13,17,23,.94)),url(${JSON.stringify(site.landing.cover_image_url)})` }} /> : null}
      <Link href="/cliente/portal" className="text-sm font-medium text-[color:var(--text-secondary)]">
        ← Voltar
      </Link>
      <h1 className="text-2xl font-bold text-[color:var(--text-primary)]">Fidelidade</h1>

      <form action="" className="space-y-2">
        <select name="vehicle" defaultValue={vehicleId} className="min-h-11 w-full rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--card)] px-3 text-[color:var(--text-primary)] outline-none">
          {(vehicles.data ?? []).map((v) => (
            <option key={v.id} value={v.id}>
              {v.plate} — {[v.brand, v.model].filter(Boolean).join(" ") || "Veículo"}
            </option>
          ))}
        </select>
        <button type="submit" className="min-h-11 w-full rounded-2xl border border-[color:var(--surface-border)] text-sm font-medium text-[color:var(--text-secondary)]">
          Ver
        </button>
      </form>

      {data ? (
        <section className="rounded-3xl border border-[color:var(--surface-border)] bg-[color:var(--card)] p-4">
          <p className="text-sm text-[color:var(--text-secondary)]">{vehicle?.plate}</p>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            Lavagens no ciclo: <strong className="text-[color:var(--text-primary)]">{washesCompleted}</strong> de {washesRequired}
          </p>

          <div className="mt-4 grid grid-cols-5 gap-2">
            {positions.map((position) => {
              const done = position <= washesCompleted;
              const isTenth = position === washesRequired;
              return (
                <div
                  key={position}
                  className={`flex min-h-11 items-center justify-center rounded-2xl border text-xs font-semibold ${
                    isTenth
                      ? "border-[var(--accent)] bg-[linear-gradient(135deg,rgba(0,245,212,0.22),rgba(56,189,248,0.1))] text-[color:var(--text-primary)]"
                      : done
                        ? "border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] text-[color:var(--text-primary)]"
                        : "border-[color:var(--surface-border)] text-[color:var(--text-soft)]"
                  }`}
                >
                  {isTenth ? "🎁" : done ? "✓" : position}
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-sm">
            {data.reward_id
              ? data.reward_status === "available"
                ? "Recompensa disponível: 1 lavagem gratuita para este veículo."
                : "Recompensa gerada."
              : washesCompleted >= washesRequired
                ? "Recompensa gerada — use na próxima lavagem."
                : `Faltam ${Math.max(0, washesRequired - washesCompleted)} lavagens para a recompensa.`}
          </p>
          {data.cycle_started_at ? (
            <p className="mt-1 text-xs text-[color:var(--text-soft)]">Ciclo iniciado em {data.cycle_started_at}</p>
          ) : null}
        </section>
      ) : (
        <section className="rounded-3xl border border-dashed border-[color:var(--surface-border)] p-6 text-center">
          <p className="text-sm text-[color:var(--text-muted)]">
            {summary?.error ? "Não foi possível carregar a fidelidade." : "Selecione um veículo."}
          </p>
        </section>
      )}

      <p className="text-center text-xs text-[color:var(--text-soft)]">Nenhum valor financeiro é exibido nesta tela.</p>
    </main>
  );
}
