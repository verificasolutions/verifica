import Link from "next/link";
import { requireCustomer } from "@/backend/auth/guards";
import { rpcCustomerListVehicles, rpcCustomerListServices } from "@/backend/repos/customer-rpc-repo";
import { getOrderPreviewUseCase } from "@/backend/use-cases/customer/order-preview";
import { createOrderDraftAction, confirmOrderAction } from "./actions";
import { SubmitButton } from "@/components/cliente/submit-button";
import { FlashNotice } from "@/components/flash-notice";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default async function LavarAgoraPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { token, customer } = await requireCustomer();
  const vehicles = await rpcCustomerListVehicles(token);
  const services = await rpcCustomerListServices(token);
  const vehicleId = String(params.vehicle ?? vehicles.data?.[0]?.id ?? "");
  const draft = String(params.draft ?? "");
  const error = String(params.error ?? "");

  const preview = draft ? await getOrderPreviewUseCase({ token, customer, draftId: draft }) : null;
  const mains = (services.data ?? []).filter((s) => s.kind === "main");
  const extras = (services.data ?? []).filter((s) => s.kind === "extra");

  return (
    <main className="mx-auto w-full max-w-md space-y-4 px-4 py-6">
      <Link href="/cliente/portal" className="text-sm font-medium text-[color:var(--text-secondary)]">
        ← Voltar
      </Link>
      <h1 className="text-2xl font-bold text-[color:var(--text-primary)]">Lavar agora</h1>
      {error ? <FlashNotice error={error} /> : null}

      {draft ? (
        <section className="space-y-4 rounded-3xl border border-[color:var(--surface-border)] bg-[color:var(--card)] p-4">
          {preview?.error || !preview?.data ? (
            <p className="text-sm text-[color:var(--text-muted)]">{preview?.error ?? "Carregando resumo..."}</p>
          ) : (
            <>
              <p className="text-sm text-[color:var(--text-secondary)]">
                Veículo: <strong className="text-[color:var(--text-primary)]">{preview.data.vehicle.plate}</strong>
              </p>
              <ul className="space-y-2">
                {preview.data.items.map((item) => (
                  <li key={item.name} className="flex items-center justify-between text-sm">
                    <span className="text-[color:var(--text-secondary)]">{item.name}</span>
                    <span className="text-[color:var(--text-primary)]">{formatBRL(item.price)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t border-[color:var(--surface-border)] pt-3 text-sm">
                <span className="text-[color:var(--text-muted)]">Duração estimada</span>
                <span className="text-[color:var(--text-primary)]">{preview.data.minutes} min</span>
              </div>
              <div className="flex items-center justify-between text-base font-semibold">
                <span className="text-[color:var(--text-primary)]">Total</span>
                <span className="text-[color:var(--text-primary)]">{formatBRL(preview.data.total)}</span>
              </div>
              <form action={confirmOrderAction} className="space-y-2">
                <input type="hidden" name="draft" value={draft} />
                <input type="hidden" name="vehicle" value={vehicleId} />
                <SubmitButton>Dar OK — confirmar contratação</SubmitButton>
              </form>
              <p className="text-center text-xs text-[color:var(--text-soft)]">
                O preço final é calculado e confirmado pelo servidor na confirmação.
              </p>
            </>
          )}
        </section>
      ) : (
        <form action={createOrderDraftAction} className="space-y-4">
          <section className="rounded-3xl border border-[color:var(--surface-border)] bg-[color:var(--card)] p-4">
            <label className="block text-sm font-medium text-[color:var(--text-secondary)]">
              Veículo
              <select
                name="vehicle"
                defaultValue={vehicleId}
                className="mt-1.5 min-h-11 w-full rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 text-[color:var(--text-primary)] outline-none"
              >
                {(vehicles.data ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate} — {[v.brand, v.model].filter(Boolean).join(" ") || "Veículo"}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="rounded-3xl border border-[color:var(--surface-border)] bg-[color:var(--card)] p-4">
            <p className="text-sm font-medium text-[color:var(--text-secondary)]">Serviço principal (escolha 1)</p>
            {mains.length === 0 ? (
              <p className="mt-2 text-sm text-[color:var(--text-muted)]">Nenhum serviço disponível no momento.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {mains.map((s) => (
                  <label key={s.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border border-[color:var(--surface-border)] px-3">
                    <input type="radio" name="service_id" value={s.id} required className="size-4 accent-[var(--accent)]" />
                    <span className="flex-1 text-sm text-[color:var(--text-primary)]">{s.name}</span>
                  </label>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-[color:var(--surface-border)] bg-[color:var(--card)] p-4">
            <p className="text-sm font-medium text-[color:var(--text-secondary)]">Complementos (até 3)</p>
            {extras.length === 0 ? (
              <p className="mt-2 text-sm text-[color:var(--text-soft)]">Nenhum complemento disponível.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {extras.map((s) => (
                  <label key={s.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border border-[color:var(--surface-border)] px-3">
                    <input type="checkbox" name="service_id" value={s.id} className="size-4 accent-[var(--accent)]" />
                    <span className="flex-1 text-sm text-[color:var(--text-primary)]">{s.name}</span>
                  </label>
                ))}
              </div>
            )}
          </section>

          <SubmitButton>Ver resumo (preço do servidor)</SubmitButton>
        </form>
      )}
    </main>
  );
}
