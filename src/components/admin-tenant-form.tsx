"use client";

import { useEffect, useState } from "react";
import { PhoneInput } from "@/components/masked-inputs";

function digitsOnly(value: string) {
  return value.replace(/\D+/g, "");
}

function formatPostalCode(value: string) {
  const digits = digitsOnly(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function formatCnpj(value: string) {
  const digits = digitsOnly(value).slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatRegistration(value: string) {
  return value.replace(/[^0-9A-Za-z]/g, "").toUpperCase().slice(0, 20);
}

type TenantFormValues = {
  tenant_name?: string | null;
  slug?: string | null;
  trade_name?: string | null;
  legal_name?: string | null;
  cnpj?: string | null;
  state_registration?: string | null;
  municipal_registration?: string | null;
  company_email?: string | null;
  company_phone?: string | null;
  company_phone_secondary?: string | null;
  operational_profile?: "automotive" | "generic" | null;
  postal_code?: string | null;
  street?: string | null;
  street_number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  owner_name?: string | null;
  representative_role?: string | null;
  owner_email?: string | null;
  representative_phone?: string | null;
  representative_phone_secondary?: string | null;
};

type Props = {
  tenantId?: string;
  title: string;
  submitLabel: string;
  values?: TenantFormValues | null;
  includeOwnerPassword?: boolean;
  formAction: (formData: FormData) => void;
};

type ViaCepResponse = {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

const inputClassName = "h-12 min-w-0 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none";

export function AdminTenantForm({
  tenantId,
  title,
  submitLabel,
  values,
  includeOwnerPassword = false,
  formAction,
}: Props) {
  const [cnpj, setCnpj] = useState(formatCnpj(values?.cnpj ?? ""));
  const [stateRegistration, setStateRegistration] = useState(formatRegistration(values?.state_registration ?? ""));
  const [municipalRegistration, setMunicipalRegistration] = useState(formatRegistration(values?.municipal_registration ?? ""));
  const [postalCode, setPostalCode] = useState(formatPostalCode(values?.postal_code ?? ""));
  const [street, setStreet] = useState(values?.street ?? "");
  const [neighborhood, setNeighborhood] = useState(values?.neighborhood ?? "");
  const [city, setCity] = useState(values?.city ?? "");
  const [stateCode, setStateCode] = useState(values?.state ?? "");
  const [loadingAddress, setLoadingAddress] = useState(false);

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

  return (
    <form action={formAction} className="space-y-6">
      {tenantId ? <input type="hidden" name="tenant_id" value={tenantId} /> : null}

      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-white/40">{title}</p>
        <h3 className="mt-2 text-2xl font-semibold text-white">Identificação completa do tenant</h3>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-white/84">Empresa</p>
        <div className="grid gap-3">
          <input name="tenant_name" defaultValue={values?.tenant_name ?? ""} placeholder="Nome operacional do tenant" className={inputClassName} />
          <input name="trade_name" defaultValue={values?.trade_name ?? ""} placeholder="Nome fantasia" className={inputClassName} />
          <input name="legal_name" defaultValue={values?.legal_name ?? ""} placeholder="Razão social" className={inputClassName} />
        </div>
        <div className="grid gap-3 2xl:grid-cols-[minmax(280px,1fr)_minmax(240px,0.85fr)_minmax(240px,0.85fr)]">
          <input name="cnpj" value={cnpj} onChange={(event) => setCnpj(formatCnpj(event.target.value))} placeholder="CNPJ" className={inputClassName} inputMode="numeric" />
          <input name="state_registration" value={stateRegistration} onChange={(event) => setStateRegistration(formatRegistration(event.target.value))} placeholder="Inscrição estadual" className={inputClassName} />
          <input name="municipal_registration" value={municipalRegistration} onChange={(event) => setMunicipalRegistration(formatRegistration(event.target.value))} placeholder="Inscrição municipal" className={inputClassName} />
        </div>
        <input name="company_email" type="email" defaultValue={values?.company_email ?? ""} placeholder="E-mail da empresa" className={inputClassName} spellCheck={false} />
        <div className="grid gap-3 xl:grid-cols-2">
          <PhoneInput name="company_phone" defaultValue={values?.company_phone ?? ""} placeholder="Telefone principal" className={inputClassName} />
          <PhoneInput name="company_phone_secondary" defaultValue={values?.company_phone_secondary ?? ""} placeholder="Telefone adicional" className={inputClassName} />
        </div>
        <div className="grid gap-3 xl:grid-cols-[minmax(320px,1fr)_320px]">
          <input name="slug" defaultValue={values?.slug ?? ""} placeholder="Slug" className={inputClassName} spellCheck={false} />
          <input name="country" defaultValue={values?.country ?? "Brasil"} placeholder="País" className={inputClassName} />
        </div>
        <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-semibold text-white/84">Perfil operacional</p>
          <p className="mt-1 text-xs text-white/52">Define o preset inicial do fluxo. Automotivo preserva placas, veículos e boxes de lava rápido. Genérico nasce com etapas limpas para outros serviços.</p>
          <select name="operational_profile" defaultValue={values?.operational_profile ?? "automotive"} className={`${inputClassName} mt-3`}>
            <option value="automotive">Automotivo</option>
            <option value="generic">Genérico</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-white/84">Endereço</p>
        <div className="grid gap-3 2xl:grid-cols-[220px_minmax(360px,1fr)_180px_220px]">
          <input name="postal_code" value={postalCode} onChange={(event) => setPostalCode(formatPostalCode(event.target.value))} placeholder="CEP" className={inputClassName} />
          <input
            name="street"
            value={street}
            onChange={(event) => setStreet(event.target.value)}
            placeholder={`Endereço${loadingAddress ? " • buscando CEP" : ""}`}
            className={inputClassName}
          />
          <input name="street_number" defaultValue={values?.street_number ?? ""} placeholder="Número" className={inputClassName} />
          <input name="complement" defaultValue={values?.complement ?? ""} placeholder="Complemento" className={inputClassName} />
        </div>
        <div className="grid gap-3 xl:grid-cols-[minmax(220px,0.8fr)_minmax(220px,0.8fr)_140px]">
          <input name="neighborhood" value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} placeholder="Bairro" className={inputClassName} />
          <input name="city" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Cidade" className={inputClassName} />
          <input name="state" value={stateCode} onChange={(event) => setStateCode(event.target.value.toUpperCase().slice(0, 2))} placeholder="UF" className={inputClassName} />
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-white/84">Responsável</p>
        <div className="grid gap-3 xl:grid-cols-[minmax(320px,1fr)_320px]">
          <input name="owner_name" defaultValue={values?.owner_name ?? ""} placeholder="Nome do responsável" className={inputClassName} />
          <input name="representative_role" defaultValue={values?.representative_role ?? ""} placeholder="Cargo do responsável" className={inputClassName} />
        </div>
        <input name="owner_email" type="email" defaultValue={values?.owner_email ?? ""} placeholder="E-mail do responsável" className={inputClassName} spellCheck={false} />
        <div className="grid gap-3 xl:grid-cols-2">
          <PhoneInput name="representative_phone" defaultValue={values?.representative_phone ?? ""} placeholder="Telefone do responsável" className={inputClassName} />
          <PhoneInput name="representative_phone_secondary" defaultValue={values?.representative_phone_secondary ?? ""} placeholder="Telefone adicional do responsável" className={inputClassName} />
        </div>
        {includeOwnerPassword ? <input name="owner_password" type="text" placeholder="Senha inicial" className={inputClassName} /> : null}
      </div>

      <button className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_30px_rgba(0,245,212,0.24)]">
        {submitLabel}
      </button>
    </form>
  );
}
