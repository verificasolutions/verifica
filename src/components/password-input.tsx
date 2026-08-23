"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type PasswordInputProps = {
  name: string;
  placeholder?: string;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "name" | "placeholder" | "className">;

export function PasswordInput({ name, placeholder, className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input name={name} type={visible ? "text" : "password"} className={`${className ?? ""} pr-24`} placeholder={placeholder} {...props} />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        className="absolute right-3 top-1/2 inline-flex h-8 -translate-y-1/2 items-center gap-1 rounded-xl border border-slate-300/90 bg-slate-100 px-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-white hover:text-slate-900"
      >
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        <span>{visible ? "Ocultar" : "Ver"}</span>
      </button>
    </div>
  );
}
