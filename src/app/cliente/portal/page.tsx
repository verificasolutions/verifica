import Link from "next/link";
import { requireCustomer } from "@/backend/auth/guards";
import { rpcCustomerListVehicles } from "@/backend/repos/customer-rpc-repo";
import { logoutAction, linkVehicleAction, unlinkVehicleAction, lookupVehicleAction } from "./actions";
import { SubmitButton } from "@/components/cliente/submit-button";
import { FlashNotice } from "@/components/flash-notice";
import { ThemeToggle } from "@/components/theme-toggle";
import { getPublicTenantSiteCritical } from "@/backend/repos/public-tenant-site-repo";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const USAGE_LABELS: Record<string, string> = {
  particular: "Particular",
  app_driver: "Uber / 99 / InDrive",
  taxi: "Táxi",
  company: "Empresa",
  other_professional: "Outro profissional",
};

export default async function PortalHomePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { token, customer } = await requireCustomer();
  const vehicles = await rpcCustomerListVehicles(token);
  const site = customer.tenantSlug ? await getPublicTenantSiteCritical(customer.tenantSlug) : null;
  const banner = site?.landing?.cover_image_url ?? null;
  const list = vehicles.data ?? [];
  const error = String(params.error ?? "");
  const ok = String(params.ok ?? "");
  const addMode = String(params.add ?? "") === "1";
  const plate = String(params.plate ?? "");
  const brand = String(params.brand ?? "");
  const model = String(params.model ?? "");
  const color = String(params.color ?? "");
  const vehicleType = String(params.vehicle_type ?? "");
  const sizeTier = String(params.size_tier ?? "");

  return (
    <main className="relative isolate mx-auto min-h-[100dvh] w-full max-w-md space-y-4 overflow-hidden px-4 py-6">
      {banner ? (
        <div
          aria-hidden="true"
          className="customer-portal-banner pointer-events-none fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `linear-gradient(rgba(13,17,23,.76), rgba(13,17,23,.94)), url(${JSON.stringify(banner)})`,
          }}
        />
      ) : null}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--text-soft)]">{customer.tenantSlug ?? "portal"}</p>
          <h1 className="truncate text-2xl font-bold text-[color:var(--text-primary)]">Olá, {customer.name ?? "cliente"}</h1>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="min-h-11 rounded-2xl border border-[color:var(--surface-border)] px-4 text-sm font-medium text-[color:var(--text-secondary)] transition enabled:hover:brightness-110"
          >
            Sair
          </button>
        </form>
      </header>

      {error ? <FlashNotice error={error} /> : null}
      {ok ? <FlashNotice message={ok} /> : null}

      <div className="flex justify-end"><ThemeToggle /></div>

      <Link href="/cliente/passatempos" className="flex min-h-11 items-center justify-center rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] text-sm font-semibold text-[color:var(--text-primary)]">
        Passatempo
      </Link>

      {list.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] p-6 text-center">
          <p className="text-sm text-[color:var(--text-muted)]">Nenhum veículo vinculado ainda.</p>
          <p className="mt-1 text-xs text-[color:var(--text-soft)]">Adicione seu primeiro veículo abaixo.</p>
        </section>
      ) : (
        <ul className="space-y-3">
          {list.map((v) => (
            <li key={v.id} className="rounded-3xl border border-[color:var(--surface-border)] bg-[color:var(--card)] p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-lg font-bold tracking-wide text-[color:var(--text-primary)]">{v.plate}</p>
                <span className="rounded-full border border-[color:var(--surface-border)] px-2.5 py-1 text-[11px] text-[color:var(--text-muted)]">
                  {USAGE_LABELS[v.usage_type] ?? v.usage_type}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-[color:var(--text-secondary)]">
                {[v.brand, v.model, v.color].filter(Boolean).join(" ") || "Veículo"}
              </p>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <Link
                  href={`/cliente/lavar-agora?vehicle=${v.id}`}
                  className="flex min-h-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(0,245,212,0.22),rgba(56,189,248,0.1))] px-2 text-center text-sm font-semibold text-[color:var(--text-primary)]"
                >
                  Lavar agora
                </Link>
                <Link
                  href={`/cliente/agendar?vehicle=${v.id}`}
                  className="flex min-h-11 items-center justify-center rounded-2xl border border-[color:var(--surface-border)] px-2 text-center text-sm font-medium text-[color:var(--text-secondary)]"
                >
                  Agendar
                </Link>
                <Link
                  href={`/cliente/fidelidade?vehicle=${v.id}`}
                  className="flex min-h-11 items-center justify-center rounded-2xl border border-[color:var(--surface-border)] px-2 text-center text-sm font-medium text-[color:var(--text-secondary)]"
                >
                  Fidelidade
                </Link>
              </div>

              <form action={unlinkVehicleAction} className="mt-2">
                <input type="hidden" name="vehicle_id" value={v.id} />
                <button type="submit" className="min-h-9 text-xs font-medium text-[color:var(--text-soft)] underline">
                  Desvincular
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <section className="rounded-3xl border border-[color:var(--surface-border)] bg-[color:var(--card)] p-4">
        {addMode ? (
          <form action={linkVehicleAction} className="space-y-3">
            <p className="text-sm font-semibold text-[color:var(--text-primary)]">Adicionar veículo</p>
            <input
              name="plate"
              defaultValue={plate}
              required
              maxLength={8}
              placeholder="Placa"
              className="min-h-11 w-full rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 uppercase outline-none focus:border-[var(--accent)]"
            />
            <div className="grid grid-cols-2 gap-2">
              <input name="brand" defaultValue={brand} placeholder="Marca" className="min-h-11 rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 outline-none" />
              <input name="model" defaultValue={model} placeholder="Modelo" className="min-h-11 rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input name="color" defaultValue={color} placeholder="Cor" className="min-h-11 rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 outline-none" />
              <input name="vehicle_type" defaultValue={vehicleType} placeholder="Tipo (hatch, sedan...)" className="min-h-11 rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 outline-none" />
            </div>
            <input name="size_tier" defaultValue={sizeTier} placeholder="Porte (passeio, medio, grande, bem_grande)" className="min-h-11 w-full rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 outline-none" />
            <SubmitButton>Vincular</SubmitButton>
          </form>
        ) : (
          <Link href="/cliente/portal?add=1" className="flex min-h-11 items-center justify-center rounded-2xl border border-dashed border-[color:var(--surface-border)] text-sm font-medium text-[color:var(--text-secondary)]">
            + Adicionar veículo
          </Link>
        )}

        <form action={lookupVehicleAction} className="mt-3 flex gap-2">
          <input
            name="plate"
            placeholder="Consultar placa (preenche dados)"
            className="min-h-11 flex-1 rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 uppercase outline-none focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            className="min-h-11 rounded-2xl border border-[color:var(--surface-border)] px-4 text-sm font-medium text-[color:var(--text-secondary)]"
          >
            Consultar
          </button>
        </form>
      </section>
    </main>
  );
}
