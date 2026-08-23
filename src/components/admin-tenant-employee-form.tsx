"use client";

import { useEffect, useState } from "react";

function digitsOnly(value: string) {
  return value.replace(/\D+/g, "");
}

function formatPhone(value: string) {
  const digits = digitsOnly(value).slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCpf(value: string) {
  const digits = digitsOnly(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatPostalCode(value: string) {
  const digits = digitsOnly(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

type EmployeeFormData = {
  id?: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  contact_phone?: string | null;
  cpf?: string | null;
  birth_date?: string | null;
  postal_code?: string | null;
  street?: string | null;
  street_number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  internal_code?: string | null;
  role_label?: string | null;
  can_access_system?: boolean;
  payment_type?: "daily" | "commission" | "fixed" | null;
  payment_value?: number | null;
};

type Props = {
  tenantId: string;
  employee?: EmployeeFormData | null;
  formAction: (formData: FormData) => void;
};

type ViaCepResponse = {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

const inputClassName = "h-12 w-full rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none";

export function AdminTenantEmployeeForm({ tenantId, employee, formAction }: Props) {
  const [phone, setPhone] = useState(formatPhone(employee?.phone ?? ""));
  const [contactPhone, setContactPhone] = useState(formatPhone(employee?.contact_phone ?? ""));
  const [cpf, setCpf] = useState(formatCpf(employee?.cpf ?? ""));
  const [postalCode, setPostalCode] = useState(formatPostalCode(employee?.postal_code ?? ""));
  const [street, setStreet] = useState(employee?.street ?? "");
  const [neighborhood, setNeighborhood] = useState(employee?.neighborhood ?? "");
  const [city, setCity] = useState(employee?.city ?? "");
  const [stateCode, setStateCode] = useState(employee?.state ?? "");
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
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="employee_id" value={employee?.id ?? ""} />

      <div className="grid gap-3 xl:grid-cols-2">
        <input name="name" defaultValue={employee?.name ?? ""} placeholder="Nome completo" className={inputClassName} />
        <input name="role_label" defaultValue={employee?.role_label ?? ""} placeholder="Função/cargo" className={inputClassName} />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <input name="email" type="email" defaultValue={employee?.email ?? ""} placeholder="E-mail" className={inputClassName} />
        <input name="phone" value={phone} onChange={(event) => setPhone(formatPhone(event.target.value))} placeholder="Telefone" className={inputClassName} />
        <input name="contact_phone" value={contactPhone} onChange={(event) => setContactPhone(formatPhone(event.target.value))} placeholder="Telefone de contato" className={inputClassName} />
      </div>

      <div className="grid gap-3 xl:grid-cols-4">
        <input name="cpf" value={cpf} onChange={(event) => setCpf(formatCpf(event.target.value))} placeholder="CPF" className={inputClassName} />
        <input name="birth_date" type="date" defaultValue={employee?.birth_date ?? ""} className={inputClassName} />
        <input name="internal_code" defaultValue={employee?.internal_code ?? ""} placeholder="Identificação interna" className={inputClassName} />
        <select name="can_access_system" defaultValue={employee?.can_access_system ? "true" : "false"} className={inputClassName}>
          <option value="false">Sem acesso ao sistema</option>
          <option value="true">Com acesso ao sistema</option>
        </select>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <select name="payment_type" defaultValue={employee?.payment_type ?? "daily"} className={inputClassName}>
          <option value="daily">Diária</option>
          <option value="commission">Comissão</option>
          <option value="fixed">Fixo</option>
        </select>
        <input name="payment_value" defaultValue={employee?.payment_value ?? 0} placeholder="Valor" className={inputClassName} />
        <input name="password" type="text" placeholder={employee ? "Nova senha opcional" : "Senha inicial"} className={inputClassName} />
      </div>

      <div className="grid gap-3 xl:grid-cols-[0.45fr_1fr_0.35fr_0.45fr]">
        <input name="postal_code" value={postalCode} onChange={(event) => setPostalCode(formatPostalCode(event.target.value))} placeholder="CEP" className={inputClassName} />
        <input
          name="street"
          value={street}
          onChange={(event) => setStreet(event.target.value)}
          placeholder={`Endereço${loadingAddress ? " • buscando CEP" : ""}`}
          className={inputClassName}
        />
        <input name="street_number" defaultValue={employee?.street_number ?? ""} placeholder="Número" className={inputClassName} />
        <input name="complement" defaultValue={employee?.complement ?? ""} placeholder="Complemento" className={inputClassName} />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <input name="neighborhood" value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} placeholder="Bairro" className={inputClassName} />
        <input name="city" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Cidade" className={inputClassName} />
        <input name="state" value={stateCode} onChange={(event) => setStateCode(event.target.value.toUpperCase().slice(0, 2))} placeholder="UF" className={inputClassName} />
      </div>

      <button className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_30px_rgba(0,245,212,0.24)]">
        {employee ? "Salvar usuário" : "Adicionar usuário"}
      </button>
    </form>
  );
}
