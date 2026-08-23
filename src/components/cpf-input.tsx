"use client";

import { useState } from "react";

function digitsOnly(value: string) {
  return value.replace(/\D+/g, "");
}

function formatCpf(value: string) {
  const digits = digitsOnly(value).slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

type CpfInputProps = {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
};

export function CpfInput({ name, defaultValue = "", placeholder, className }: CpfInputProps) {
  const [value, setValue] = useState(formatCpf(defaultValue));

  return (
    <input
      name={name}
      value={value}
      onChange={(event) => setValue(formatCpf(event.target.value))}
      placeholder={placeholder}
      className={className}
    />
  );
}
