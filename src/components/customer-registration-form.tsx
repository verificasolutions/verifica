"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

function digitsOnly(value: string) {
  return value.replace(/\D+/g, "");
}

function normalizePlate(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
}

function formatDocument(value: string) {
  const digits = digitsOnly(value).slice(0, 14);

  if (digits.length <= 11) {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatPostalCode(value: string) {
  const digits = digitsOnly(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function formatPhone(value: string) {
  const digits = digitsOnly(value).slice(0, 11);

  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

type ViaCepResponse = {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

type VehicleTypeOption = {
  code: string;
  label: string;
};

type VehicleModelOption = {
  brand: string;
  name: string;
};

type VehicleDraft = {
  id: string;
  plate: string;
  vehicleType: string;
  brand: string;
  model: string;
  color: string;
};

type CustomerRegistrationFormProps = {
  formAction: (formData: FormData) => void;
  isAutomotive: boolean;
  redirectTo?: string;
  backHref: string;
  brandOptions: string[];
  modelOptions: VehicleModelOption[];
  colorOptions: string[];
  vehicleTypeOptions: VehicleTypeOption[];
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-2 flex min-h-[2.75rem] items-end text-xs font-medium uppercase leading-[1.15rem] tracking-[0.18em] text-white/42">{children}</label>;
}

function createVehicleDraft(): VehicleDraft {
  return {
    id: crypto.randomUUID(),
    plate: "",
    vehicleType: "",
    brand: "",
    model: "",
    color: "",
  };
}

export function CustomerRegistrationForm({
  formAction,
  isAutomotive,
  redirectTo,
  backHref,
  brandOptions,
  modelOptions,
  colorOptions,
  vehicleTypeOptions,
}: CustomerRegistrationFormProps) {
  const [postalCode, setPostalCode] = useState("");
  const [street, setStreet] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleDraft[]>(isAutomotive ? [createVehicleDraft()] : []);

  useEffect(() => {
    const digits = digitsOnly(postalCode);
    if (digits.length !== 8) return;

    let cancelled = false;
    setLoadingAddress(true);

    fetch(`https://viacep.com.br/ws/${digits}/json/`)
      .then((response) => response.json() as Promise<ViaCepResponse>)
      .then((data) => {
        if (cancelled || data?.erro) return;
        setStreet(data.logradouro ?? "");
        setNeighborhood(data.bairro ?? "");
        setCity(data.localidade ?? "");
        setStateCode(data.uf ?? "");
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingAddress(false);
      });

    return () => {
      cancelled = true;
    };
  }, [postalCode]);

  function updateVehicle(id: string, patch: Partial<VehicleDraft>) {
    setVehicles((current) => current.map((vehicle) => (vehicle.id === id ? { ...vehicle, ...patch } : vehicle)));
  }

  function removeVehicle(id: string) {
    setVehicles((current) => current.filter((vehicle) => vehicle.id !== id));
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="redirect_to" value={redirectTo ?? "/app/dashboard?section=clientes&customerForm=1"} />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <FieldLabel>Nome exibido</FieldLabel>
          <input name="name" placeholder="Nome do CPF ou fantasia do CNPJ" className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
        </div>
        <div>
          <FieldLabel>CPF ou CNPJ</FieldLabel>
          <DocumentField />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <FieldLabel>Razão social</FieldLabel>
          <input name="legal_name" placeholder="Razão social" className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
        </div>
        <div>
          <FieldLabel>Inscrição estadual</FieldLabel>
          <input name="state_registration" placeholder="Inscrição estadual" className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
        </div>
      </div>

      <div>
        <FieldLabel>E-mail</FieldLabel>
        <input name="email" type="email" placeholder="contato@empresa.com.br" className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <FieldLabel>Telefone</FieldLabel>
          <PhoneField name="contact_phone_1" placeholder="Telefone principal" />
        </div>
        <div>
          <FieldLabel>WhatsApp</FieldLabel>
          <PhoneField name="whatsapp" placeholder="WhatsApp" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.55fr_0.3fr_0.45fr]">
        <div>
          <FieldLabel>CEP</FieldLabel>
          <input
            name="postal_code"
            value={postalCode}
            onChange={(event) => setPostalCode(formatPostalCode(event.target.value))}
            placeholder="00000-000"
            className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
          />
        </div>
        <div>
          <FieldLabel>Número</FieldLabel>
          <input name="street_number" placeholder="Número" className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
        </div>
        <div>
          <FieldLabel>Complemento</FieldLabel>
          <input name="complement" placeholder="Complemento" className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
        </div>
      </div>

      <div>
        <FieldLabel>Endereço {loadingAddress ? "• buscando CEP" : ""}</FieldLabel>
        <input
          name="street"
          value={street}
          onChange={(event) => setStreet(event.target.value)}
          placeholder="Rua, avenida, rodovia..."
          className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.7fr_0.7fr_0.25fr]">
        <div>
          <FieldLabel>Bairro</FieldLabel>
          <input
            name="neighborhood"
            value={neighborhood}
            onChange={(event) => setNeighborhood(event.target.value)}
            placeholder="Bairro"
            className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
          />
        </div>
        <div>
          <FieldLabel>Cidade</FieldLabel>
          <input
            name="city"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="Cidade"
            className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
          />
        </div>
        <div>
          <FieldLabel>UF</FieldLabel>
          <input
            name="state"
            value={stateCode}
            onChange={(event) => setStateCode(event.target.value.toUpperCase().slice(0, 2))}
            placeholder="UF"
            className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm uppercase text-white outline-none"
          />
        </div>
      </div>

      <div>
        <FieldLabel>Inscrição municipal</FieldLabel>
        <input name="municipal_registration" placeholder="Inscrição municipal" className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none" />
      </div>

      {isAutomotive ? (
        <div className="rounded-[24px] border border-white/10 bg-black/15 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-base font-semibold text-white">Veículos do cliente</p>
              <p className="mt-1 text-sm text-white/56">Cadastre um ou vários veículos já vinculados a este cliente.</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/82">
                <input type="checkbox" name="is_fleet" value="true" className="size-4 accent-[var(--accent)]" />
                Cliente frotista
              </label>
              <button
                type="button"
                onClick={() => setVehicles((current) => [...current, createVehicleDraft()])}
                className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-semibold text-white/84"
              >
                Adicionar veículo
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {vehicles.map((vehicle, index) => (
              <VehicleCard
                key={vehicle.id}
                index={index}
                vehicle={vehicle}
                brandOptions={brandOptions}
                modelOptions={modelOptions}
                colorOptions={colorOptions}
                vehicleTypeOptions={vehicleTypeOptions}
                onChange={updateVehicle}
                onRemove={vehicles.length > 1 ? removeVehicle : undefined}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-white/10 pt-5 lg:flex-row lg:items-center lg:justify-between">
        <Link href={backHref} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/6 px-5 text-sm font-semibold text-white/84">
          Voltar
        </Link>

        <div className="grid gap-3 lg:grid-cols-2">
          <button
            type="submit"
            name="submit_intent"
            value="save"
            className="flex min-h-14 min-w-[220px] items-center justify-center rounded-2xl border border-white/10 bg-white/6 px-4 text-sm font-semibold text-white"
          >
            Salvar cliente
          </button>
          <button
            type="submit"
            name="submit_intent"
            value="quote"
            className="flex min-h-14 min-w-[220px] items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950"
          >
            Salvar e orçamento
          </button>
        </div>
      </div>
    </form>
  );
}

function DocumentField() {
  const [value, setValue] = useState("");

  return (
    <input
      name="document"
      value={value}
      onChange={(event) => setValue(formatDocument(event.target.value))}
      placeholder="CPF ou CNPJ"
      className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
    />
  );
}

function PhoneField({ name, placeholder }: { name: string; placeholder: string }) {
  const [value, setValue] = useState("");

  return (
    <input
      name={name}
      value={value}
      onChange={(event) => setValue(formatPhone(event.target.value))}
      placeholder={placeholder}
      className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
    />
  );
}

function VehicleCard({
  index,
  vehicle,
  brandOptions,
  modelOptions,
  colorOptions,
  vehicleTypeOptions,
  onChange,
  onRemove,
}: {
  index: number;
  vehicle: VehicleDraft;
  brandOptions: string[];
  modelOptions: VehicleModelOption[];
  colorOptions: string[];
  vehicleTypeOptions: VehicleTypeOption[];
  onChange: (id: string, patch: Partial<VehicleDraft>) => void;
  onRemove?: (id: string) => void;
}) {
  const brandListId = useId();
  const modelListId = useId();
  const colorListId = useId();

  const availableModels = vehicle.brand.trim()
    ? modelOptions.filter((item) => item.brand.toLowerCase() === vehicle.brand.trim().toLowerCase()).map((item) => item.name)
    : modelOptions.map((item) => item.name);

  return (
    <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">Veículo {index + 1}</p>
        {onRemove ? (
          <button
            type="button"
            onClick={() => onRemove(vehicle.id)}
            className="rounded-2xl border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs font-semibold text-rose-100"
          >
            Remover
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <FieldLabel>Placa</FieldLabel>
          <input
            name="vehicle_plate"
            value={vehicle.plate}
            onChange={(event) => onChange(vehicle.id, { plate: normalizePlate(event.target.value) })}
            placeholder="ABC1D23"
            className="h-14 w-full rounded-2xl border border-white/10 bg-gradient-to-r from-slate-100 to-white px-4 text-center font-mono text-base tracking-[0.25em] text-slate-900 uppercase outline-none"
          />
        </div>
        <div>
          <FieldLabel>Tipo do veículo</FieldLabel>
          <select
            name="vehicle_type"
            value={vehicle.vehicleType}
            onChange={(event) => onChange(vehicle.id, { vehicleType: event.target.value })}
            className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
          >
            <option value="">Selecione o tipo</option>
            {vehicleTypeOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div>
          <FieldLabel>Marca</FieldLabel>
          <input
            name="vehicle_brand"
            list={brandListId}
            value={vehicle.brand}
            onChange={(event) => onChange(vehicle.id, { brand: event.target.value })}
            placeholder="Marca"
            className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
          />
          <datalist id={brandListId}>
            {brandOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </div>

        <div>
          <FieldLabel>Modelo</FieldLabel>
          <input
            name="vehicle_model"
            list={modelListId}
            value={vehicle.model}
            onChange={(event) => onChange(vehicle.id, { model: event.target.value })}
            placeholder="Modelo"
            className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
          />
          <datalist id={modelListId}>
            {availableModels.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </div>

        <div>
          <FieldLabel>Cor</FieldLabel>
          <input
            name="vehicle_color"
            list={colorListId}
            value={vehicle.color}
            onChange={(event) => onChange(vehicle.id, { color: event.target.value })}
            placeholder="Cor"
            className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none"
          />
          <datalist id={colorListId}>
            {colorOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </div>
      </div>
    </div>
  );
}
