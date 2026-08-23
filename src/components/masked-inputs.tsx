"use client";

import { useMemo, useState } from "react";

type BaseInputProps = {
  name: string;
  className?: string;
  placeholder?: string;
  defaultValue?: string | number | null;
  type?: string;
  autoComplete?: string;
  spellCheck?: boolean;
};

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

function normalizeCurrencyInput(value: string) {
  const digits = digitsOnly(value);
  if (!digits) return "";

  const integer = Number(digits) / 100;
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(integer);
}

function currencyDefaultValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  const numeric = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(numeric)) return "";

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

function formatDuration(value: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  if (raw.includes(":")) {
    const digits = raw.replace(/\D+/g, "");
    if (!digits) return "";
    if (digits.length <= 2) return digits;

    const hours = digits.slice(0, -2);
    const minutes = digits.slice(-2);
    return `${Number(hours)}:${minutes.padStart(2, "0")}`;
  }

  const digits = digitsOnly(raw);
  if (!digits) return "";
  if (digits.length <= 2) return digits;

  const hours = digits.slice(0, -2);
  const minutes = digits.slice(-2);
  return `${Number(hours)}:${minutes}`;
}

export function PhoneInput({ defaultValue, type, ...props }: BaseInputProps) {
  const [value, setValue] = useState(() => formatPhone(String(defaultValue ?? "")));

  return (
    <input
      {...props}
      type={type ?? "tel"}
      inputMode="numeric"
      autoComplete={props.autoComplete ?? "tel-national"}
      maxLength={16}
      value={value}
      onChange={(event) => setValue(formatPhone(event.target.value))}
    />
  );
}

export function CurrencyInput({ defaultValue, type, ...props }: BaseInputProps) {
  const formattedDefault = useMemo(() => currencyDefaultValue(defaultValue), [defaultValue]);
  const [value, setValue] = useState(formattedDefault);

  return (
    <input
      {...props}
      type={type ?? "text"}
      inputMode="decimal"
      autoComplete="off"
      value={value}
      onChange={(event) => setValue(normalizeCurrencyInput(event.target.value))}
    />
  );
}

export function DurationInput({ defaultValue, type, ...props }: BaseInputProps) {
  const [value, setValue] = useState(() => formatDuration(String(defaultValue ?? "")));

  return (
    <input
      {...props}
      type={type ?? "text"}
      inputMode="numeric"
      autoComplete="off"
      value={value}
      onChange={(event) => setValue(formatDuration(event.target.value))}
    />
  );
}

export function DocumentInput({ defaultValue, type, ...props }: BaseInputProps) {
  const [value, setValue] = useState(() => formatDocument(String(defaultValue ?? "")));

  return (
    <input
      {...props}
      type={type ?? "text"}
      inputMode="numeric"
      autoComplete="off"
      maxLength={18}
      value={value}
      onChange={(event) => setValue(formatDocument(event.target.value))}
    />
  );
}
