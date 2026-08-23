"use client";

import { useMemo, useState } from "react";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { DocumentInput, PhoneInput } from "@/components/masked-inputs";
import { VehicleIdentityFields } from "@/components/vehicle-identity-fields";

type ServiceOption = {
  id: string;
  name: string;
  price: number;
  pricePasseio: number;
  priceMedio: number;
  priceGrande: number;
  priceBemGrande: number;
};

type CustomerOption = {
  id: string;
  name: string;
  trade_name?: string | null;
  whatsapp?: string | null;
};

type VehicleTypeOption = {
  code: string;
  label: string;
  tier?: "passeio" | "medio" | "grande" | "bem_grande";
};

type VehicleModelOption = {
  brand: string;
  name: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function NewAttendanceFormClient({
  formAction,
  services,
  customers,
  redirectTo,
  brandOptions,
  modelOptions,
  colorOptions,
  vehicleTypeOptions,
  operationalProfile,
}: {
  formAction: (formData: FormData) => void;
  services: ServiceOption[];
  customers: CustomerOption[];
  redirectTo: string;
  brandOptions: string[];
  modelOptions: VehicleModelOption[];
  colorOptions: string[];
  vehicleTypeOptions: VehicleTypeOption[];
  operationalProfile: "automotive" | "generic";
}) {
  const [isFleet, setIsFleet] = useState(false);
  const [vehicleType, setVehicleType] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const isAutomotive = operationalProfile === "automotive";

  const currentTier = vehicleTypeOptions.find((option) => option.code === vehicleType)?.tier ?? "passeio";

  const pricePreview = useMemo(() => {
    return services
      .filter((service) => selectedServices.includes(service.id))
      .reduce((sum, service) => {
        if (currentTier === "medio") return sum + Number(service.priceMedio ?? service.price);
        if (currentTier === "grande") return sum + Number(service.priceGrande ?? service.price);
        if (currentTier === "bem_grande") return sum + Number(service.priceBemGrande ?? service.price);
        return sum + Number(service.pricePasseio ?? service.price);
      }, 0);
  }, [currentTier, selectedServices, services]);

  function toggleService(serviceId: string) {
    setSelectedServices((current) => (current.includes(serviceId) ? current.filter((item) => item !== serviceId) : [...current, serviceId]));
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="redirect_to" value={redirectTo} />

      <select name="customer_id" defaultValue="" className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none">
        <option value="">Cliente já cadastrado (opcional)</option>
        {customers.map((customer) => (
          <option key={customer.id} value={customer.id}>
            {customer.trade_name ?? customer.name}
          </option>
        ))}
      </select>

      <input name="customer_name" placeholder="Nome do cliente" className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
      <PhoneInput name="whatsapp" placeholder="WhatsApp" className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />

      {isAutomotive ? (
        <VehicleIdentityFields
          brandOptions={brandOptions}
          modelOptions={modelOptions}
          colorOptions={colorOptions}
          vehicleTypeOptions={vehicleTypeOptions}
          valueVehicleType={vehicleType}
          onVehicleTypeChange={setVehicleType}
        />
      ) : (
        <div className="space-y-3">
          <input type="hidden" name="plate" value="" />
          <input type="hidden" name="vehicle_type" value="" />
          <input type="hidden" name="vehicle_brand" value="" />
          <input type="hidden" name="vehicle_model" value="" />
          <input type="hidden" name="color" value="" />
          <input
            name="email"
            type="email"
            placeholder="E-mail"
            className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
          />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <PhoneInput
              name="contact_phone_2"
              placeholder="Outro telefone de contato"
              className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
            />
            <DocumentInput
              name="document"
              placeholder="CPF ou CNPJ"
              className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
            />
          </div>
        </div>
      )}

      <div className="rounded-[24px] border border-white/10 bg-black/15 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Serviços do atendimento</p>
            <p className="mt-1 text-xs text-white/58">Marque quantos serviços quiser. Se não houver serviço fechado ainda, deixe em branco e descreva abaixo.</p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/74">
            {selectedServices.length} marcado(s)
          </span>
        </div>

        {services.length > 0 ? (
          <div className="mt-4 grid gap-2">
            {services.map((service) => {
              const isSelected = selectedServices.includes(service.id);
              const price =
                currentTier === "medio"
                  ? Number(service.priceMedio ?? service.price)
                  : currentTier === "grande"
                    ? Number(service.priceGrande ?? service.price)
                    : currentTier === "bem_grande"
                      ? Number(service.priceBemGrande ?? service.price)
                      : Number(service.pricePasseio ?? service.price);

              return (
                <label
                  key={service.id}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                    isSelected ? "border-[var(--accent)] bg-[var(--accent)]/10 text-white" : "border-white/10 bg-white/5 text-white/74"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      name="service_ids"
                      value={service.id}
                      checked={isSelected}
                      onChange={() => toggleService(service.id)}
                      className="size-4"
                    />
                    <span>{service.name}</span>
                  </div>
                  <span className="text-xs text-white/60">{formatCurrency(price)}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
            Nenhum serviço de catálogo cadastrado. O atendimento ainda pode ser aberto como orçamento, diagnóstico ou serviço livre.
          </div>
        )}

        <textarea
          name="manual_service_items"
          rows={4}
          placeholder={"Serviços livres ou em análise, um por linha.\nExemplo:\nDiagnóstico de freio\nLevantamento de peças"}
          className="mt-4 w-full rounded-[22px] border border-white/10 bg-[#0f141b] px-4 py-3 text-sm text-white outline-none"
        />

        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/68">
          Valor estimado pelos serviços marcados: <span className="font-semibold text-white">{formatCurrency(pricePreview)}</span>
        </div>
      </div>

      <input
        name="extra_minutes"
        type="number"
        min={0}
        step={5}
        defaultValue={0}
        placeholder="Acrescimo de tempo (min)"
        className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
      />

      <select name="payment_method" defaultValue="pending" className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none">
        <option value="cash">Dinheiro</option>
        <option value="pix">Pix</option>
        <option value="card">Cartão</option>
        <option value="pending">Pendente</option>
      </select>

      {isAutomotive ? (
        <>
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white/80">
            <input type="checkbox" name="fleet_billing" value="true" checked={isFleet} onChange={(event) => setIsFleet(event.target.checked)} className="size-4" />
            Atendimento de frota
          </label>
          {isFleet ? (
            <input
              type="date"
              name="billing_due_date"
              className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
            />
          ) : null}
        </>
      ) : null}

      <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white/80">
        <input type="checkbox" name="notify_customer" value="true" className="size-4" />
        Enviar mensagem de recebimento
      </label>

      <AuthSubmitButton
        label="Adicionar à fila"
        pendingLabel="Adicionando à fila..."
        disabled={isAutomotive && !vehicleType}
        className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950 disabled:opacity-70"
      />
    </form>
  );
}
