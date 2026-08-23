import Link from "next/link";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { InventoryBarcodeScanner } from "@/components/inventory-barcode-scanner";
import { CurrencyInput } from "@/components/masked-inputs";
import type { InventoryWorkspace } from "@/backend/use-cases/tenant/get-inventory-workspace";
import {
  createInventoryItemAction,
  createInventoryShelfAction,
  quickInventoryEntryAction,
  registerInventoryMovementAction,
  updateInventoryItemAction,
} from "@/app/app/dashboard/actions";

function inventoryHref(options?: { shelfId?: string | null; itemId?: string | null }) {
  const params = new URLSearchParams();
  params.set("section", "estoque");
  if (options?.shelfId) params.set("shelfId", options.shelfId);
  if (options?.itemId) params.set("inventoryItemId", options.itemId);
  return `/app/dashboard?${params.toString()}`;
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

export function InventorySection({ inventory }: { inventory: InventoryWorkspace }) {
  const selectedShelf = inventory.selectedShelf;

  return (
    <section className="rounded-[28px] border border-[color:var(--surface-border)] bg-[color:var(--surface-panel)] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.24)] backdrop-blur-xl lg:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--text-soft)]">Estoque</p>
          <h2 className="mt-2 text-xl font-semibold text-[color:var(--text-primary)] lg:text-2xl">Controle manual por estantes</h2>
          <p className="mt-2 max-w-3xl text-sm text-[color:var(--text-muted)]">
            Crie estantes, cadastre itens e registre entradas ou saídas sem sair desta tela.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Estantes" value={String(inventory.stats.shelvesCount)} />
        <MetricCard label="Itens ativos" value={String(inventory.stats.itemsCount)} />
        <MetricCard label="Estoque baixo" value={String(inventory.stats.lowStockCount)} tone="alert" />
        <MetricCard label="Movimentos recentes" value={String(inventory.stats.movementCount)} tone="accent" />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="space-y-4">
          <Panel title="Nova estante" subtitle="Use nomes como Prateleira A, Armário químico, Estoque externo ou o padrão que fizer sentido na operação.">
            <form action={createInventoryShelfAction} className="mt-4 space-y-3">
              <input type="hidden" name="redirect_to" value={inventoryHref({ shelfId: selectedShelf?.id ?? null })} />
              <input name="name" placeholder="Nome da estante" className={inputClass} />
              <div className="grid gap-3 md:grid-cols-2">
                <input name="code" placeholder="Código curto opcional" className={inputClass} />
                <input name="note" placeholder="Observação" className={inputClass} />
              </div>
              <AuthSubmitButton label="Criar estante" pendingLabel="Criando estante..." className={primaryButtonClass} />
            </form>
          </Panel>

          <Panel title="Estantes cadastradas">
            <div className="mt-4 space-y-3">
              {inventory.shelves.length === 0 ? (
                <EmptyBox text="Nenhuma estante criada ainda." />
              ) : (
                inventory.shelves.map((shelf) => {
                  const active = selectedShelf?.id === shelf.id;

                  return (
                    <Link
                      key={shelf.id}
                      href={inventoryHref({ shelfId: shelf.id })}
                      className={`block rounded-[22px] border p-4 ${
                        active
                          ? "border-[var(--accent)] bg-[linear-gradient(135deg,rgba(0,245,212,0.16),rgba(56,189,248,0.08))]"
                          : "border-[color:var(--surface-border)] bg-[color:var(--surface-soft)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-[color:var(--text-primary)]">{shelf.name}</p>
                          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                            {shelf.code ? `${shelf.code} • ` : ""}
                            {shelf.itemCount} item(ns)
                          </p>
                        </div>
                        <span className="rounded-full border border-[color:var(--surface-border)] bg-black/15 px-3 py-1 text-xs text-[color:var(--text-secondary)]">
                          {new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(shelf.totalQuantity)}
                        </span>
                      </div>
                      {shelf.note ? <p className="mt-3 text-xs text-[color:var(--text-soft)]">{shelf.note}</p> : null}
                    </Link>
                  );
                })
              )}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          {!selectedShelf ? (
            <EmptyBox text="Crie a primeira estante para começar o controle de estoque." />
          ) : (
            <>
              <Panel title={selectedShelf.name} subtitle={selectedShelf.note ?? "Estante selecionada para cadastro, entrada e saída de itens."}>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
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
                <Panel title="Entrada rápida" subtitle="Para item já cadastrado, informe código e quantidade. Se o código não existir, cadastre o item no formulário abaixo.">
                  <form id="inventory-quick-entry" action={quickInventoryEntryAction} className="mt-4 space-y-3">
                    <input type="hidden" name="redirect_to" value={inventoryHref({ shelfId: selectedShelf.id })} />
                    <input type="hidden" name="shelf_id" value={selectedShelf.id} />
                    <input
                      id="inventory-quick-barcode"
                      name="barcode"
                      defaultValue={inventory.pendingBarcode}
                      placeholder="Código de barras, GTIN, SKU ou QR"
                      className={inputClass}
                    />
                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        id="inventory-quick-quantity"
                        name="quantity"
                        defaultValue={inventory.pendingQuantity}
                        placeholder="Quantidade"
                        className={inputClass}
                      />
                      <input name="note" placeholder="Observação da entrada" className={inputClass} />
                    </div>
                    <AuthSubmitButton label="Adicionar à estante" pendingLabel="Registrando entrada..." className={primaryButtonClass} />
                  </form>
                </Panel>

                <Panel title="Importação por NF" subtitle="Fica como próxima etapa para testarmos com chave de acesso ou XML real.">
                  <div className="mt-4 rounded-[22px] border border-dashed border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] p-4 text-sm text-[color:var(--text-muted)]">
                    A base de estantes, itens, códigos e movimentações já está pronta para receber a leitura da nota fiscal depois.
                  </div>
                </Panel>
              </div>

              <div id="inventory-new-item">
                <Panel title="Cadastrar item na estante" subtitle="Cadastro completo para produto químico, acessório, embalagem, ferramenta ou item de consumo.">
                  <form action={createInventoryItemAction} className="mt-4 grid gap-4 xl:grid-cols-2">
                    <input type="hidden" name="redirect_to" value={inventoryHref({ shelfId: selectedShelf.id })} />
                    <input type="hidden" name="shelf_id" value={selectedShelf.id} />

                    <div className="space-y-4">
                      <input id="inventory-new-name" name="name" placeholder="Nome do produto" className={inputClass} />
                      <div className="grid gap-3 md:grid-cols-2">
                        <input name="brand" placeholder="Marca" className={inputClass} />
                        <input name="category" placeholder="Categoria" className={inputClass} />
                      </div>
                      <input
                        id="inventory-new-barcode"
                        name="barcode"
                        defaultValue={inventory.pendingBarcode}
                        placeholder="Código de barras / GTIN / SKU"
                        className={inputClass}
                      />
                      <div className="grid gap-3 md:grid-cols-2">
                        <input name="sku" placeholder="SKU interno" className={inputClass} />
                        <input name="supplier" placeholder="Fornecedor" className={inputClass} />
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
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
                    </div>

                    <div className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <input name="initial_quantity" placeholder="Quantidade inicial" className={inputClass} />
                        <input name="min_quantity" placeholder="Estoque mínimo" className={inputClass} />
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <CurrencyInput name="cost_price" placeholder="Custo unitário: 0,00" className={inputClass} />
                      <CurrencyInput name="sale_price" placeholder="Preço de venda: 0,00" className={inputClass} />
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <input name="location_label" placeholder="Posição na estante" className={inputClass} />
                        <input name="batch_code" placeholder="Lote opcional" className={inputClass} />
                      </div>
                      <input name="expiration_date" type="date" className={inputClass} />
                      <input name="movement_note" placeholder="Observação da entrada inicial" className={inputClass} />
                      <textarea name="notes" placeholder="Observações do item" className={`${inputClass} min-h-28 py-3`} />
                      <AuthSubmitButton label="Salvar item" pendingLabel="Salvando item..." className={primaryButtonClass} />
                    </div>
                  </form>
                </Panel>
              </div>

              <Panel title="Itens da estante" subtitle="Entrada e saída manual ficam em cada item.">
                <div className="mt-4 space-y-3">
                  {inventory.selectedItems.length === 0 ? (
                    <EmptyBox text="Nenhum item nesta estante ainda." />
                  ) : (
                    inventory.selectedItems.map((item) => {
                      const low = Number(item.quantity) <= Number(item.min_quantity);

                      return (
                        <div key={item.id} className="rounded-[22px] border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] p-4">
                          <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Link
                                    href={inventoryHref({ shelfId: selectedShelf.id, itemId: item.id })}
                                    scroll={false}
                                    className="text-base font-semibold text-[color:var(--text-primary)] underline decoration-[var(--accent)]/45 underline-offset-4 transition hover:text-[var(--accent)]"
                                  >
                                    {item.name}
                                  </Link>
                                  <span className={`rounded-full border px-2.5 py-1 text-[11px] ${low ? "border-amber-300/20 bg-amber-300/10 text-amber-100" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"}`}>
                                    {low ? "Estoque baixo" : "Nível ok"}
                                  </span>
                                </div>
                                <p className="mt-1 break-words text-sm text-[color:var(--text-muted)]">
                                  {[item.brand, item.category, item.barcode, item.location_label].filter(Boolean).join(" • ") || "Sem complemento"}
                                </p>
                              </div>

                              <div className="grid w-full gap-2 sm:grid-cols-3 lg:w-[440px] lg:shrink-0">
                                <SmallInfo label="Atual" value={formatQuantity(Number(item.quantity), item.unit)} />
                                <SmallInfo label="Mínimo" value={formatQuantity(Number(item.min_quantity), item.unit)} />
                                <SmallInfo label="Última entrada" value={formatDateTime(item.last_entry_at)} />
                              </div>
                            </div>

                            <form
                              action={registerInventoryMovementAction}
                              className="grid w-full gap-2 border-t border-[color:var(--surface-border)] pt-4 md:grid-cols-2 xl:grid-cols-[minmax(150px,0.75fr)_minmax(220px,1.25fr)_auto_auto]"
                            >
                              <input type="hidden" name="redirect_to" value={inventoryHref({ shelfId: selectedShelf.id })} />
                              <input type="hidden" name="item_id" value={item.id} />
                              <input name="quantity" inputMode="decimal" placeholder="Quantidade" className="h-11 min-w-0 rounded-2xl border border-[color:var(--surface-border)] bg-[#0f141b] px-4 text-sm text-white outline-none" />
                              <input name="note" placeholder="Observação" className="h-11 min-w-0 rounded-2xl border border-[color:var(--surface-border)] bg-[#0f141b] px-4 text-sm text-white outline-none" />
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
                      <div key={movement.id} className="rounded-[20px] border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 py-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                              {movement.item?.name ?? "Item"} • {movement.kind === "out" ? "Saída" : movement.kind === "initial" ? "Carga inicial" : "Entrada"}
                            </p>
                            <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                              {movement.shelf?.name ?? "Estante"} • {formatQuantity(Number(movement.quantity), movement.item?.unit ?? "un")}
                              {movement.note ? ` • ${movement.note}` : ""}
                            </p>
                          </div>
                          <p className="text-xs text-[color:var(--text-soft)]">{formatDateTime(movement.created_at)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Panel>
            </>
          )}
        </div>
      </div>

      {inventory.selectedItem ? (
        <InventoryItemEditor inventory={inventory} />
      ) : null}
    </section>
  );
}

const inputClass = "h-12 w-full rounded-2xl border border-[color:var(--surface-border)] bg-[#0f141b] px-4 text-sm text-white outline-none";
const primaryButtonClass = "flex min-h-12 w-full items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950";

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[24px] border border-[color:var(--surface-border)] bg-black/10 p-5">
      <p className="text-base font-semibold text-[color:var(--text-primary)]">{title}</p>
      {subtitle ? <p className="mt-2 text-sm text-[color:var(--text-muted)]">{subtitle}</p> : null}
      {children}
    </div>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] p-4 text-sm text-[color:var(--text-muted)]">
      {text}
    </div>
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

function SmallInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[color:var(--surface-border)] bg-black/15 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]">{label}</p>
      <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{value}</p>
    </div>
  );
}

function InventoryItemEditor({ inventory }: { inventory: InventoryWorkspace }) {
  const item = inventory.selectedItem;
  if (!item) return null;

  const closeHref = inventoryHref({ shelfId: item.shelf_id });

  return (
    <>
      <Link href={closeHref} scroll={false} className="fixed inset-0 z-40 bg-[color:var(--overlay-strong)]" aria-label="Fechar edição do item" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative max-h-[92vh] w-full max-w-[1080px] overflow-y-auto rounded-[32px] border border-[color:var(--surface-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--background)_98%,#000000_2%),color-mix(in_srgb,var(--surface-strong)_96%,#ffffff_4%))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.48)] lg:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--text-soft)]">Estoque</p>
              <h2 className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">Editar {item.name}</h2>
              <p className="mt-2 text-sm text-[color:var(--text-muted)]">
                Atualize os dados cadastrais. Entradas e saídas permanecem no histórico.
              </p>
            </div>
            <Link href={closeHref} scroll={false} className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 py-2 text-sm text-[color:var(--text-secondary)]">
              Fechar
            </Link>
          </div>

          <form action={updateInventoryItemAction} className="mt-6 grid gap-5 lg:grid-cols-2">
            <input type="hidden" name="item_id" value={item.id} />
            <input type="hidden" name="redirect_to" value={inventoryHref({ shelfId: item.shelf_id, itemId: item.id })} />

            <div className="space-y-4">
              <Field label="Nome do produto">
                <input name="name" required defaultValue={item.name} className={inputClass} />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Marca">
                  <input name="brand" defaultValue={item.brand ?? ""} className={inputClass} />
                </Field>
                <Field label="Categoria">
                  <input name="category" defaultValue={item.category ?? ""} className={inputClass} />
                </Field>
              </div>

              <Field label="Código de barras / GTIN">
                <input name="barcode" defaultValue={item.barcode ?? ""} className={inputClass} />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="SKU interno">
                  <input name="sku" defaultValue={item.sku ?? ""} className={inputClass} />
                </Field>
                <Field label="Fornecedor">
                  <input name="supplier" defaultValue={item.supplier ?? ""} className={inputClass} />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Estante">
                  <select name="shelf_id" defaultValue={item.shelf_id} className={inputClass}>
                    {inventory.shelves.map((shelf) => (
                      <option key={shelf.id} value={shelf.id}>
                        {shelf.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Posição na estante">
                  <input name="location_label" defaultValue={item.location_label ?? ""} className={inputClass} />
                </Field>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Unidade">
                  <select name="unit" defaultValue={item.unit} className={inputClass}>
                    <option value="un">Unidade</option>
                    <option value="lt">Litro</option>
                    <option value="ml">Mililitro</option>
                    <option value="kg">Quilo</option>
                    <option value="g">Grama</option>
                    <option value="pct">Pacote</option>
                    <option value="cx">Caixa</option>
                  </select>
                </Field>
                <Field label="Embalagem / volume">
                  <input name="package_size" defaultValue={item.package_size ?? ""} className={inputClass} />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Quantidade atual">
                  <input value={String(Number(item.quantity))} readOnly className={`${inputClass} cursor-not-allowed opacity-65`} />
                </Field>
                <Field label="Estoque mínimo">
                  <input name="min_quantity" inputMode="decimal" defaultValue={String(Number(item.min_quantity))} className={inputClass} />
                </Field>
                <Field label="Lote">
                  <input name="batch_code" defaultValue={item.batch_code ?? ""} className={inputClass} />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Custo unitário">
                  <CurrencyInput name="cost_price" defaultValue={Number(item.cost_price)} placeholder="0,00" className={inputClass} />
                </Field>
                <Field label="Preço de venda">
                  <CurrencyInput name="sale_price" defaultValue={Number(item.sale_price)} placeholder="0,00" className={inputClass} />
                </Field>
              </div>

              <Field label="Validade">
                <input name="expiration_date" type="date" defaultValue={item.expiration_date ?? ""} className={inputClass} />
              </Field>

              <Field label="Observações">
                <textarea name="notes" defaultValue={item.notes ?? ""} className={`${inputClass} min-h-28 py-3`} />
              </Field>
            </div>

            <div className="flex flex-col gap-3 border-t border-[color:var(--surface-border)] pt-5 sm:flex-row lg:col-span-2">
              <AuthSubmitButton
                label="Salvar alterações"
                pendingLabel="Salvando alterações..."
                className="flex min-h-12 flex-1 items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-5 text-sm font-semibold text-slate-950 disabled:opacity-70"
              />
              <Link href={closeHref} scroll={false} className="flex min-h-12 items-center justify-center rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-6 text-sm text-[color:var(--text-secondary)]">
                Cancelar
              </Link>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-[color:var(--text-soft)]">{label}</span>
      {children}
    </label>
  );
}
