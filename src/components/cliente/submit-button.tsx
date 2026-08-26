"use client";

import { useFormStatus } from "react-dom";

/**
 * Botão de submit com estado de loading nativo (useFormStatus) — feedback imediato,
 * touch target >= 44px (min-h-11).
 */
export function SubmitButton({
  children,
  pendingLabel = "Processando...",
  className = "",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`min-h-11 w-full rounded-2xl border border-[color:var(--surface-border)] bg-[linear-gradient(135deg,rgba(0,245,212,0.22),rgba(56,189,248,0.1))] px-4 text-sm font-semibold text-[color:var(--text-primary)] transition enabled:hover:brightness-110 disabled:opacity-60 ${className}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
