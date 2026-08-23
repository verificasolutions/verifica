"use client";

import Link from "next/link";
import { CurrencyInput } from "@/components/masked-inputs";

type QuoteServiceOption = {
  id: string;
  name: string;
  price: number;
};

type QuoteVehicleOption = {
  id: string;
  plate: string;
  brand: string | null;
  model: string;
  color: string | null;
};

type ServiceQuoteFormProps = {
  formAction: (formData: FormData) => void;
  redirectTo: string;
  backHref: string;
  customerId: string;
  customerName: string;
  customerContact: string | null;
  customerEmail: string | null;
  services: QuoteServiceOption[];
  vehicles: QuoteVehicleOption[];
  isAutomotive: boolean;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-2 flex min-h-[2.75rem] items-end text-xs font-medium uppercase leading-[1.15rem] tracking-[0.18em] text-white/42">{children}</label>;
}

export function ServiceQuoteForm({
  formAction,
  redirectTo,
  backHref,
  customerId,
  customerName,
  customerContact,
  customerEmail,
  services,
  vehicles,
  isAutomotive,
}: ServiceQuoteFormProps) {
  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="redirect_to" value={redirectTo} />
      <input type="hidden" name="customer_id" value={customerId} />

      <div className="rounded-[24px] border border-white/10 bg-black/15 p-5">
        <p className="text-base font-semibold text-white">Cliente do orçamento</p>
        <p className="mt-3 text-lg font-semibold text-white">{customerName}</p>
        <p className="mt-1 text-sm text-white/60">{customerContact ?? "Sem contato principal"}</p>
        <p className="text-sm text-white/60">{customerEmail ?? "Sem e-mail"}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <div>
          <FieldLabel>Serviço operacional</FieldLabel>
          <select name="service_id" defaultValue="" className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none">
            <option value="" disabled>
              Selecione o serviço que vai entrar no fluxo
            </option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} • {formatCurrency(service.price)}
              </option>
            ))}
          </select>
        </div>

        {isAutomotive ? (
          <div>
            <FieldLabel>Veículo</FieldLabel>
            <select name="vehicle_id" defaultValue="" className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none">
              <option value="">Selecione o veículo</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.model} • {vehicle.plate}
                  {vehicle.color ? ` • ${vehicle.color}` : ""}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <input type="hidden" name="vehicle_id" value="" />
        )}
      </div>

      <div>
        <FieldLabel>Solicitação do cliente</FieldLabel>
        <textarea
          name="request_description"
          rows={5}
          placeholder="Descreva exatamente o que o cliente pediu."
          className="w-full rounded-[22px] border border-white/10 bg-[#0f141b] px-4 py-3 text-sm text-white outline-none"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <FieldLabel>Mão de obra</FieldLabel>
          <textarea
            name="labor_description"
            rows={4}
            placeholder="Detalhe a mão de obra do orçamento."
            className="w-full rounded-[22px] border border-white/10 bg-[#0f141b] px-4 py-3 text-sm text-white outline-none"
          />
        </div>
        <div>
          <FieldLabel>Peças, acessórios e materiais</FieldLabel>
          <textarea
            name="parts_description"
            rows={4}
            placeholder="Liste peças, acessórios ou materiais previstos."
            className="w-full rounded-[22px] border border-white/10 bg-[#0f141b] px-4 py-3 text-sm text-white outline-none"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <FieldLabel>Valor da mão de obra</FieldLabel>
          <CurrencyInput
            name="labor_amount"
            placeholder="0,00"
            className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
          />
        </div>
        <div>
          <FieldLabel>Valor de peças e acessórios</FieldLabel>
          <CurrencyInput
            name="parts_amount"
            placeholder="0,00"
            className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
          />
        </div>
      </div>

      <div>
        <FieldLabel>Observações</FieldLabel>
        <textarea
          name="notes"
          rows={4}
          placeholder="Observações internas ou condições combinadas."
          className="w-full rounded-[22px] border border-white/10 bg-[#0f141b] px-4 py-3 text-sm text-white outline-none"
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-white/10 pt-5 lg:flex-row lg:items-center lg:justify-between">
        <Link href={backHref} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/6 px-5 text-sm font-semibold text-white/84">
          Voltar
        </Link>

        <button
          type="submit"
          className="flex min-h-14 min-w-[240px] items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950"
        >
          Salvar orçamento
        </button>
      </div>
    </form>
  );
}
