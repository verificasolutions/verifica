import Link from "next/link";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { InventoryBarcodeScanner } from "@/components/inventory-barcode-scanner";
import { CurrencyInput } from "@/components/masked-inputs";
import type { OperatorInventoryWorkspace } from "@/backend/use-cases/operator/get-operator-inventory-workspace";
import {
  createOperatorInventoryItemAction,
  createOperatorInventoryShelfAction,
  quickOperatorInventoryEntryAction,
  registerOperatorInventoryMovementAction,
} from "@/app/operador/dashboard/actions";

function inventoryHref(options?: { shelfId?: string | null }) {
  const params = new URLSearchParams();
  if (options?.shelfId) params.set("shelfId", options.shelfId);
  const query = params.toString();
  return query ? `/operador/dashboard?${query}` : "/operador/dashboard";
}

function formatQuantity(value: number, unit: string) {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(Number(value ?? 0))} ${unit}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "Sem registro";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export function OperatorInventorySection({ inventory }: { inventory: OperatorInventoryWorkspace }) {
  const selectedShelf = inventory.selectedShelf;

  return (
    <section className="rounded-[22px] border border-white/10 bg-white/6 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.24)] backdrop-blur-xl">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-white/42">Estoque do operador</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Prateleiras, código de barras e movimentação</h2>
        <p className="mt-2 text-sm text-white/60">Aqui o operador pode cadastrar produto, criar prateleira e lançar entrada ou saída pelo celular.</p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Prateleiras" value={String(inventory.stats.shelvesCount)} />
        <MetricCard label="Itens ativos" value={String(inventory.stats.itemsCount)} />
        <MetricCard label="Estoque baixo" value={String(inventory.stats.lowStockCount)} tone="alert" />
        <MetricCard label="Movimentos" value={String(inventory.stats.movementCount)} tone="accent" />
      </div>

      <div className="mt-5 grid gap-4">
        <Panel title="Nova prateleira" subtitle="Crie a base física antes do cadastro dos produtos.">
          <form action={createOperatorInventoryShelfAction} className="mt-4 space-y-3">
            <input type="hidden" name="redirect_to" value={inventoryHref({ shelfId: selectedShelf?.id ?? null })} />
            <input name="name" placeholder="Nome da prateleira" className={inputClass} />
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="code" placeholder="Código curto opcional" className={inputClass} />
              <input name="note" placeholder="Observação" className={inputClass} />
            </div>
            <AuthSubmitButton label="Criar prateleira" pendingLabel="Criando prateleira..." className={primaryButtonClass} />
          </form>
        </Panel>

        <Panel title="Prateleiras cadastradas">
          <div className="mt-4 grid gap-3">
            {inventory.shelves.length === 0 ? (
              <EmptyBox text="Nenhuma prateleira criada ainda." />
            ) : (
              inventory.shelves.map((shelf) => {
                const active = selectedShelf?.id === shelf.id;

                return (
                  <Link
                    key={shelf.id}
                    href={inventoryHref({ shelfId: shelf.id })}
                    className={`block rounded-[20px] border p-4 ${active ? "border-[var(--accent)] bg-[rgba(0,245,212,0.1)]" : "border-white/10 bg-black/15"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-white">{shelf.name}</p>
                        <p className="mt-1 text-sm text-white/55">
                          {shelf.code ? `${shelf.code} • ` : ""}
                          {shelf.itemCount} item(ns)
                        </p>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/72">
                        {new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(shelf.totalQuantity)}
                      </span>
                    </div>
                    {shelf.note ? <p className="mt-3 text-xs text-white/48">{shelf.note}</p> : null}
                  </Link>
                );
              })
            )}
          </div>
        </Panel>

        {!selectedShelf ? (
          <EmptyBox text="Crie a primeira prateleira para começar o controle de estoque." />
        ) : (
          <>
            <Panel title={selectedShelf.name} subtitle={selectedShelf.note ?? "Prateleira selecionada para cadastro e movimentação."}>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <SmallInfo label="Itens" value={String(selectedShelf.itemCount)} />
                <SmallInfo
                  label="Quantidade total"
                  value={new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(selectedShelf.totalQuantity)}
                />
                <SmallInfo label="Código" value={selectedShelf.code ?? "Sem código"} />
              </div>
            </Panel>

            <InventoryBarcodeScanner items={inventory.barcodeCatalog} />

            <div className="grid gap-4 xl:grid-cols-2">
              <Panel title="Entrada rápida" subtitle="Se o código já existir, informe só a quantidade.">
                <form id="inventory-quick-entry" action={quickOperatorInventoryEntryAction} className="mt-4 space-y-3">
                  <input type="hidden" name="redirect_to" value={inventoryHref({ shelfId: selectedShelf.id })} />
                  <input type="hidden" name="shelf_id" value={selectedShelf.id} />
                  <input
                    id="inventory-quick-barcode"
                    name="barcode"
                    defaultValue={inventory.pendingBarcode}
                    placeholder="Código de barras / GTIN / SKU"
                    className={inputClass}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input id="inventory-quick-quantity" name="quantity" defaultValue={inventory.pendingQuantity} placeholder="Quantidade" className={inputClass} />
                    <input name="note" placeholder="Observação da entrada" className={inputClass} />
                  </div>
                  <AuthSubmitButton label="Adicionar na prateleira" pendingLabel="Registrando entrada..." className={primaryButtonClass} />
                </form>
              </Panel>

              <Panel title="Cadastro de item" subtitle="Use quando o código ainda não existir no estoque.">
                <form action={createOperatorInventoryItemAction} className="mt-4 space-y-3">
                  <input type="hidden" name="redirect_to" value={inventoryHref({ shelfId: selectedShelf.id })} />
                  <input type="hidden" name="shelf_id" value={selectedShelf.id} />
                  <input id="inventory-new-name" name="name" placeholder="Nome do produto" className={inputClass} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input name="brand" placeholder="Marca" className={inputClass} />
                    <input name="category" placeholder="Categoria" className={inputClass} />
                  </div>
                  <input id="inventory-new-barcode" name="barcode" defaultValue={inventory.pendingBarcode} placeholder="Código de barras / GTIN / SKU" className={inputClass} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input name="sku" placeholder="SKU interno" className={inputClass} />
                    <input name="supplier" placeholder="Fornecedor" className={inputClass} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select name="unit" defaultValue="un" className={inputClass}>
                      <option value="un">Unidade</option>
                      <option value="lt">Litro</option>
                      <option value="ml">Mililitro</option>
                      <option value="kg">Quilo</option>
                      <option value="g">Grama</option>
                      <option value="pct">Pacote</option>
                      <option value="cx">Caixa</option>
                    </select>
                    <input name="package_size" placeholder="Embalagem / volume" className={inputClass} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input name="initial_quantity" placeholder="Quantidade inicial" className={inputClass} />
                    <input name="min_quantity" placeholder="Estoque mínimo" className={inputClass} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <CurrencyInput name="cost_price" placeholder="Custo unitário: 0,00" className={inputClass} />
                    <CurrencyInput name="sale_price" placeholder="Preço de venda: 0,00" className={inputClass} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input name="location_label" placeholder="Posição na prateleira" className={inputClass} />
                    <input name="batch_code" placeholder="Lote opcional" className={inputClass} />
                  </div>
                  <input name="expiration_date" type="date" className={inputClass} />
                  <input name="movement_note" placeholder="Observação da entrada inicial" className={inputClass} />
                  <textarea name="notes" placeholder="Observações do item" className={`${inputClass} min-h-24 py-3`} />
                  <AuthSubmitButton label="Salvar item" pendingLabel="Salvando item..." className={primaryButtonClass} />
                </form>
              </Panel>
            </div>

            <Panel title="Itens da prateleira" subtitle="Entrada e saída manual ficam em cada item.">
              <div className="mt-4 space-y-3">
                {inventory.selectedItems.length === 0 ? (
                  <EmptyBox text="Nenhum item nesta prateleira ainda." />
                ) : (
                  inventory.selectedItems.map((item) => {
                    const low = Number(item.quantity) <= Number(item.min_quantity);

                    return (
                      <div key={item.id} className="rounded-[20px] border border-white/10 bg-black/15 p-4">
                        <div className="flex flex-col gap-4">
                          <div className="flex flex-col gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-semibold text-white">{item.name}</p>
                              <span className={`rounded-full border px-2.5 py-1 text-[11px] ${low ? "border-amber-300/20 bg-amber-300/10 text-amber-100" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"}`}>
                                {low ? "Estoque baixo" : "Nível ok"}
                              </span>
                            </div>
                            <p className="break-words text-sm text-white/55">
                              {[item.brand, item.category, item.barcode, item.location_label].filter(Boolean).join(" • ") || "Sem complemento"}
                            </p>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-3">
                            <SmallInfo label="Atual" value={formatQuantity(Number(item.quantity), item.unit)} />
                            <SmallInfo label="Mínimo" value={formatQuantity(Number(item.min_quantity), item.unit)} />
                            <SmallInfo label="Última entrada" value={formatDateTime(item.last_entry_at)} />
                          </div>

                          <form action={registerOperatorInventoryMovementAction} className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(120px,0.65fr)_minmax(200px,1fr)_auto_auto]">
                            <input type="hidden" name="redirect_to" value={inventoryHref({ shelfId: selectedShelf.id })} />
                            <input type="hidden" name="item_id" value={item.id} />
                            <input name="quantity" inputMode="decimal" placeholder="Quantidade" className="h-11 min-w-0 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                            <input name="note" placeholder="Observação" className="h-11 min-w-0 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
                            <button type="submit" name="movement_kind" value="in" className="min-h-11 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 text-sm font-medium text-emerald-100">
                              Entrada
                            </button>
                            <button type="submit" name="movement_kind" value="out" className="min-h-11 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-5 text-sm font-medium text-rose-100">
                              Saída
                            </button>
                          </form>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Panel>

            <Panel title="Movimentações recentes">
              <div className="mt-4 space-y-3">
                {inventory.recentMovements.length === 0 ? (
                  <EmptyBox text="Nenhuma movimentação registrada ainda." />
                ) : (
                  inventory.recentMovements.map((movement) => (
                    <div key={movement.id} className="rounded-[20px] border border-white/10 bg-black/15 px-4 py-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {movement.item?.name ?? "Item"} • {movement.kind === "out" ? "Saída" : movement.kind === "initial" ? "Carga inicial" : "Entrada"}
                          </p>
                          <p className="mt-1 text-xs text-white/55">
                            {movement.shelf?.name ?? "Prateleira"} • {formatQuantity(Number(movement.quantity), movement.item?.unit ?? "un")}
                            {movement.note ? ` • ${movement.note}` : ""}
                          </p>
                        </div>
                        <p className="text-xs text-white/45">{formatDateTime(movement.created_at)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Panel>
          </>
        )}
      </div>
    </section>
  );
}

const inputClass = "h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none";
const primaryButtonClass = "flex min-h-12 w-full items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950";

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-black/15 p-4">
      <p className="text-base font-semibold text-white">{title}</p>
      {subtitle ? <p className="mt-2 text-sm text-white/60">{subtitle}</p> : null}
      {children}
    </div>
  );
}

function EmptyBox({ text }: { text: string }) {
  return <div className="rounded-[20px] border border-dashed border-white/12 bg-black/10 p-4 text-sm text-white/56">{text}</div>;
}

function MetricCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "accent" | "alert" }) {
  const toneClass =
    tone === "accent"
      ? "border-[var(--accent)] bg-[rgba(0,245,212,0.1)]"
      : tone === "alert"
        ? "border-amber-300/20 bg-amber-300/10"
        : "border-white/10 bg-black/15";

  return (
    <div className={`rounded-[20px] border p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.22em] text-white/42">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function SmallInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-white/5 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">{label}</p>
      <p className="mt-1 text-sm text-white/82">{value}</p>
    </div>
  );
}
