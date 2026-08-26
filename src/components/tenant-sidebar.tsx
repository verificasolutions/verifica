"use client";

import Link from "next/link";
import { useState } from "react";
import { signOutAction } from "@/app/login/actions";
import { ThemeToggle } from "@/components/theme-toggle";

type TenantSection = "dashboard" | "caixa" | "inteligencia" | "clientes" | "estoque" | "crescendo" | "suporte" | "adm";

type TenantSidebarProps = {
  actorName: string;
  cashStatus: string;
  currentSection: TenantSection;
  tenantName: string;
};

const items: Array<{ id: TenantSection; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "caixa", label: "Caixa" },
  { id: "inteligencia", label: "Inteligência" },
  { id: "clientes", label: "Clientes" },
  { id: "estoque", label: "Estoque" },
  { id: "crescendo", label: "Crescendo" },
  { id: "suporte", label: "Suporte" },
  { id: "adm", label: "ADM" },
];

export function TenantSidebar({ actorName, cashStatus, currentSection, tenantName }: TenantSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Fechar menu lateral" : "Abrir menu lateral"}
        onClick={() => setOpen((value) => !value)}
        className={`fixed z-50 flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-strong)]/92 text-[color:var(--text-primary)] shadow-[0_14px_32px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-[left,top,transform] duration-300 ${
          open ? "left-[258px] top-1/2 -translate-y-1/2" : "left-3 top-14"
        }`}
      >
        <span className={`text-lg transition ${open ? "rotate-180" : ""}`}>{">"}</span>
      </button>

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-[280px] flex-col overflow-hidden border-r border-[color:var(--surface-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--background)_95%,#000000_5%),color-mix(in_srgb,var(--surface-strong)_96%,#ffffff_4%))] px-4 py-4 shadow-[0_18px_56px_rgba(0,0,0,0.38)] backdrop-blur-xl transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mt-10 flex-1 overflow-y-auto pr-1">
          <div className="space-y-3">
            {items.map((item) => {
              const active = currentSection === item.id;

              return (
                <Link
                  key={item.id}
                  href={`/app/dashboard?section=${item.id}`}
                  onClick={() => setOpen(false)}
                  className={`flex min-h-12 items-center rounded-2xl border px-4 text-sm font-medium transition ${
                    active
                      ? "border-[var(--accent)] bg-[linear-gradient(135deg,rgba(0,245,212,0.16),rgba(56,189,248,0.08))] text-[color:var(--text-primary)] shadow-[0_12px_30px_rgba(0,245,212,0.16)]"
                      : "border-[color:var(--surface-border)] bg-[color:var(--surface-panel)] text-[color:var(--text-secondary)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-4 shrink-0 rounded-[22px] border border-[color:var(--surface-border)] bg-[color:var(--surface-panel)] p-3 shadow-[0_12px_36px_rgba(0,0,0,0.24)]">
          <p className="text-xs text-[color:var(--text-muted)]">Ola, {actorName}</p>
          <h2 className="mt-1 line-clamp-2 text-[1.05rem] font-semibold leading-tight text-[color:var(--text-primary)]">{tenantName}</h2>
          <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-200">
            <span className="size-2 rounded-full bg-emerald-300" />
            <span className="truncate">Caixa: {cashStatus}</span>
          </div>
          <ThemeToggle />
          <form action={signOutAction} className="mt-3">
            <button className="flex min-h-10 w-full items-center justify-center rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 text-sm text-[color:var(--text-secondary)]">
              Sair
            </button>
          </form>
        </div>
      </aside>

      {open ? (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-[color:var(--overlay-strong)]"
        />
      ) : null}
    </>
  );
}
