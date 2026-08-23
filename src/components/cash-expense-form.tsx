"use client";

import { useMemo, useState } from "react";
import { CurrencyInput } from "@/components/masked-inputs";

type DailyPayoutOption = {
  employeeId: string;
  name: string;
  roleLabel: string;
  amount: number;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function CashExpenseForm({
  formAction,
  dailyPayouts,
}: {
  formAction: (formData: FormData) => void | Promise<void>;
  dailyPayouts: DailyPayoutOption[];
}) {
  const [category, setCategory] = useState("supplies");
  const [employeeId, setEmployeeId] = useState(dailyPayouts[0]?.employeeId ?? "");
  const isDailyPayout = category === "daily_payout";

  const selectedPayout = useMemo(
    () => dailyPayouts.find((item) => item.employeeId === employeeId) ?? null,
    [dailyPayouts, employeeId],
  );

  return (
    <form action={formAction} className="mt-5 space-y-4">
      <input type="hidden" name="redirect_to" value="/app/dashboard?section=caixa" />
      <input type="hidden" name="kind" value="expense" />
      <input type="hidden" name="payment_method" value="cash" />

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <label className="mb-2 flex min-h-[2.75rem] items-end text-xs font-medium uppercase leading-[1.15rem] tracking-[0.18em] text-white/42">Categoria da saída</label>
          <select
            name="entry_category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
          >
            <option value="supplies">Insumo</option>
            <option value="supplier">Fornecedor</option>
            <option value="lunch">Alimentação</option>
            <option value="transport">Transporte</option>
            <option value="daily_payout">Pagamento de diária</option>
            <option value="other_expense">Outra saída</option>
          </select>
        </div>

        {isDailyPayout ? (
          <div>
            <label className="mb-2 flex min-h-[2.75rem] items-end text-xs font-medium uppercase leading-[1.15rem] tracking-[0.18em] text-white/42">Valor da diária</label>
            <div className="flex h-14 w-full items-center rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-base font-semibold text-white">
              {selectedPayout ? formatCurrency(selectedPayout.amount) : "Sem diária pendente"}
            </div>
          </div>
        ) : (
          <div>
            <label className="mb-2 flex min-h-[2.75rem] items-end text-xs font-medium uppercase leading-[1.15rem] tracking-[0.18em] text-white/42">Valor</label>
            <CurrencyInput
              name="amount"
              placeholder="R$ 0,00"
              className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-base font-semibold text-white outline-none"
            />
          </div>
        )}
      </div>

      {isDailyPayout ? (
        <div className="rounded-[22px] border border-amber-300/14 bg-amber-300/8 p-4">
          <label className="mb-2 flex min-h-[2.75rem] items-end text-xs font-medium uppercase leading-[1.15rem] tracking-[0.18em] text-white/42">Operador ativo do dia</label>
          {dailyPayouts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/12 bg-black/15 px-4 py-4 text-sm text-white/58">
              Nenhum operador com diária pendente hoje.
            </div>
          ) : (
            <>
              <select
                name="employee_id"
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
              >
                {dailyPayouts.map((item) => (
                  <option key={item.employeeId} value={item.employeeId}>
                    {item.name} • {item.roleLabel} • {formatCurrency(item.amount)}
                  </option>
                ))}
              </select>
              <p className="mt-3 text-sm text-white/58">
                O sistema usa a pendência da diária já gerada para esse operador e marca o pagamento corretamente.
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div>
              <label className="mb-2 flex min-h-[2.75rem] items-end text-xs font-medium uppercase leading-[1.15rem] tracking-[0.18em] text-white/42">Item ou motivo</label>
              <input
                name="item_name"
                placeholder="Shampoo, pano, almoço, combustível..."
                className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
              />
            </div>
            <div>
              <label className="mb-2 flex min-h-[2.75rem] items-end text-xs font-medium uppercase leading-[1.15rem] tracking-[0.18em] text-white/42">Fornecedor ou referência</label>
              <input
                name="counterparty"
                placeholder="Nome da loja, fornecedor ou referência"
                className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 flex min-h-[2.75rem] items-end text-xs font-medium uppercase leading-[1.15rem] tracking-[0.18em] text-white/42">Observação</label>
            <input
              name="description"
              placeholder="Detalhe opcional da despesa"
              className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label className="mb-2 flex min-h-[2.75rem] items-end text-xs font-medium uppercase leading-[1.15rem] tracking-[0.18em] text-white/42">Data da saída</label>
            <input
              type="date"
              name="effective_date"
              className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
            />
          </div>
        </>
      )}

      <button
        disabled={isDailyPayout && dailyPayouts.length === 0}
        className="flex min-h-14 w-full items-center justify-center rounded-2xl border border-transparent bg-rose-300 px-4 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isDailyPayout ? "Registrar pagamento da diária" : "Registrar saída"}
      </button>
    </form>
  );
}
