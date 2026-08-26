"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

type ServiceOption = {
  id: string;
  name: string;
  price: number;
};

type CashReceiptFormProps = {
  formAction: (formData: FormData) => void | Promise<void>;
  redirectTo: string;
  services: ServiceOption[];
  initialAmount?: string;
  initialService?: string;
  initialDescription?: string;
  initialAttendanceId?: string;
};

function formatAmount(value: string) {
  const digits = value.replace(/\D+/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(digits) / 100);
}

function formatInitialAmount(value: string) {
  const numeric = Number(value.replace(",", "."));
  if (!Number.isFinite(numeric)) return "";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric);
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-300 px-4 text-sm font-semibold text-slate-950 disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? "Lançando recebimento..." : "Lançar recebimento"}
    </button>
  );
}

export function CashReceiptForm({
  formAction,
  redirectTo,
  services,
  initialAmount = "",
  initialService = "",
  initialDescription = "",
  initialAttendanceId = "",
}: CashReceiptFormProps) {
  const initialServiceId = services.find((service) => service.name === initialService)?.id ?? "";
  const [category, setCategory] = useState(initialService ? "service" : "service");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(initialServiceId ? [initialServiceId] : []);
  const [amount, setAmount] = useState(() => initialAmount ? formatInitialAmount(initialAmount) : "");

  const selectedServices = useMemo(
    () => services.filter((service) => selectedServiceIds.includes(service.id)),
    [services, selectedServiceIds],
  );
  const selectedServiceNames = selectedServices.map((service) => service.name).join(" + ");
  const isAttendanceCharge = Boolean(initialAttendanceId);

  function toggleService(service: ServiceOption) {
    setSelectedServiceIds((current) => {
      const next = current.includes(service.id)
        ? current.filter((id) => id !== service.id)
        : [...current, service.id];
      if (!isAttendanceCharge) {
        const total = services.filter((item) => next.includes(item.id)).reduce((sum, item) => sum + item.price, 0);
        setAmount(total ? formatAmount(String(total)) : "");
      }
      return next;
    });
  }

  return (
    <form action={formAction} className="space-y-3 rounded-[22px] border border-emerald-400/14 bg-emerald-400/6 p-4">
      <input type="hidden" name="redirect_to" value={redirectTo} />
      <input type="hidden" name="kind" value="income" />
      {isAttendanceCharge ? (
        <>
          <input type="hidden" name="entry_category" value="service" />
          <input type="hidden" name="attendance_id" value={initialAttendanceId} />
          <input type="hidden" name="amount" value={initialAmount} />
          <input type="hidden" name="item_name" value={initialService} />
          <input type="hidden" name="description" value={initialDescription} />
          <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Cobrança identificada</p>
            <p className="mt-1 text-sm font-semibold text-white">{initialService || "Serviço do atendimento"}</p>
            <p className="mt-1 text-lg font-semibold text-emerald-300">R$ {initialAmount.replace(".", ",")}</p>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <select name="entry_category" value={category} onChange={(event) => setCategory(event.target.value)} className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-3 text-sm text-white outline-none">
              <option value="service">Serviço</option>
              <option value="addon">Adicional</option>
              <option value="extra">Extra</option>
              <option value="other_income">Outra entrada</option>
            </select>
            <select name="payment_method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-3 text-sm text-white outline-none">
              <option value="cash">Dinheiro</option>
              <option value="pix">Pix</option>
              <option value="card">Cartão</option>
              <option value="pending">Pendente</option>
            </select>
          </div>
          {category === "service" ? (
            <div className="space-y-2 rounded-2xl border border-white/10 bg-black/15 p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Serviços realizados</p>
              {services.length === 0 ? <p className="text-sm text-white/55">Nenhum serviço ativo cadastrado.</p> : services.map((service) => (
                <label key={service.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-sm text-white">
                  <span className="flex items-center gap-2"><input type="checkbox" checked={selectedServiceIds.includes(service.id)} onChange={() => toggleService(service)} />{service.name}</span>
                  <span className="text-emerald-300">R$ {service.price.toFixed(2).replace(".", ",")}</span>
                </label>
              ))}
              <input type="hidden" name="item_name" value={selectedServiceNames} />
            </div>
          ) : (
            <input name="description" defaultValue={initialDescription} placeholder={category === "other_income" ? "Descrição do recebimento" : "Descrição do adicional/extra"} className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-3 text-sm text-white outline-none" />
          )}
          <input name="amount" value={amount} onChange={(event) => setAmount(formatAmount(event.target.value))} placeholder="R$ 0,00" className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-3 text-sm text-white outline-none" />
        </>
      )}
      {isAttendanceCharge ? (
        <select name="payment_method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-3 text-sm text-white outline-none">
          <option value="cash">Dinheiro</option>
          <option value="pix">Pix</option>
          <option value="card">Cartão</option>
        </select>
      ) : null}
      <SubmitButton />
    </form>
  );
}
