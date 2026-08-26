import Link from "next/link";
import { requireCustomer } from "@/backend/auth/guards";
import { rpcCustomerListVehicles, rpcCustomerListServices } from "@/backend/repos/customer-rpc-repo";
import { getPublicTenantSiteCritical } from "@/backend/repos/public-tenant-site-repo";
import { getOrderPreviewUseCase } from "@/backend/use-cases/customer/order-preview";
import { priceCustomerServices } from "@/backend/shared/customer-service-pricing";
import { createOrderDraftAction, confirmOrderAction } from "./actions";
import { SubmitButton } from "@/components/cliente/submit-button";
import { ServiceSelection } from "@/components/cliente/service-selection";
import { FlashNotice } from "@/components/flash-notice";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const brl = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export default async function LavarAgoraPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { token, customer } = await requireCustomer();
  const [vehicles, services] = await Promise.all([rpcCustomerListVehicles(token), rpcCustomerListServices(token)]);
  const vehicleId = String(params.vehicle ?? vehicles.data?.[0]?.id ?? "");
  const vehicle = (vehicles.data ?? []).find((item) => item.id === vehicleId);
  const draft = String(params.draft ?? "");
  const selectedIds = String(params.selected ?? "").split(",").filter(Boolean);
  const preview = draft ? await getOrderPreviewUseCase({ token, customer, draftId: draft }) : { error: "" };
  const site = customer.tenantSlug ? await getPublicTenantSiteCritical(customer.tenantSlug) : null;
  const priced = priceCustomerServices(services.data ?? [], vehicle);
  return <main className="relative isolate mx-auto min-h-[100dvh] w-full max-w-md space-y-4 overflow-hidden px-4 py-6">{site?.landing?.cover_image_url ? <div aria-hidden="true" className="customer-portal-banner pointer-events-none fixed inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: `linear-gradient(rgba(13,17,23,.76),rgba(13,17,23,.94)),url(${JSON.stringify(site.landing.cover_image_url)})` }} /> : null}<Link href="/cliente/portal" className="text-sm font-medium text-[color:var(--text-secondary)]">← Voltar</Link><p className="text-xs uppercase tracking-[0.22em] text-[color:var(--accent)]">{site?.singleSource.displayName ?? customer.tenantSlug ?? "Portal do cliente"}</p><h1 className="text-2xl font-bold text-[color:var(--text-primary)]">Lavar agora</h1><p className="text-sm text-[color:var(--text-muted)]">Escolha um serviço principal e os complementos desejados.</p>{params.error ? <FlashNotice error={String(params.error)} /> : null}<form action={createOrderDraftAction} className="space-y-4"><input type="hidden" name="vehicle" value={vehicleId} /><section className="rounded-3xl border border-[color:var(--surface-border)] bg-[color:var(--card)] p-4"><p className="text-sm font-medium text-[color:var(--text-secondary)]">Veículo</p><p className="mt-1 text-sm text-[color:var(--text-primary)]">{vehicle?.plate} — {[vehicle?.brand, vehicle?.model].filter(Boolean).join(" ") || "Veículo"}</p></section><ServiceSelection services={priced} selectedIds={selectedIds} /><SubmitButton>{draft ? "Atualizar resumo" : "Ver resumo"}</SubmitButton></form>{draft ? <Summary preview={preview} draft={draft} vehicleId={vehicleId} /> : null}</main>;
}

function Summary({ preview, draft, vehicleId }: { preview: Awaited<ReturnType<typeof getOrderPreviewUseCase>>; draft: string; vehicleId: string }) { return <section className="space-y-4 rounded-3xl border border-[var(--accent)]/40 bg-[linear-gradient(135deg,rgba(0,245,212,.18),rgba(15,23,42,.78))] p-4"><p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Resumo confirmado pelo sistema</p>{preview?.error || !preview?.data ? <p className="text-sm text-[color:var(--text-muted)]">{preview?.error ?? "Carregando resumo..."}</p> : <><p className="text-sm text-[color:var(--text-secondary)]">Veículo: <strong className="text-[color:var(--text-primary)]">{preview.data.vehicle.plate}</strong></p><ul className="space-y-2">{preview.data.items.map((item) => <li key={item.name} className="flex justify-between text-sm text-[color:var(--text-primary)]"><span>{item.name}</span><span>{brl(item.price)}</span></li>)}</ul><div className="flex justify-between text-base font-bold text-[color:var(--text-primary)]"><span>Total</span><span>{brl(preview.data.total)}</span></div><form action={confirmOrderAction}><input type="hidden" name="draft" value={draft} /><input type="hidden" name="vehicle" value={vehicleId} /><SubmitButton>Dar OK — confirmar contratação</SubmitButton></form></>}</section>; }
