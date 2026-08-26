"use client";

import { useState } from "react";

type ServiceOption = { id: string; name: string; short_description: string | null; kind: "main" | "extra"; customerPrice: number };

export function ServiceSelection({ services, selectedIds = [] }: { services: ServiceOption[]; selectedIds?: string[] }) {
  const [selected, setSelected] = useState(selectedIds);
  const mains = services.filter((service) => service.kind === "main");
  const extras = services.filter((service) => service.kind === "extra");
  const selectedServices = services.filter((service) => selected.includes(service.id));

  function toggle(id: string, kind: ServiceOption["kind"]) {
    setSelected((current) => {
      if (kind === "main") return current.filter((item) => !mains.some((main) => main.id === item)).concat(id);
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.filter((item) => extras.some((extra) => extra.id === item)).length >= 3) return current;
      return [...current, id];
    });
  }

  const group = (title: string, items: ServiceOption[], type: ServiceOption["kind"]) => (
    <section className="rounded-3xl border border-[color:var(--surface-border)] bg-[color:var(--card)] p-4">
      <p className="text-sm font-semibold text-[color:var(--text-primary)]">{title}</p>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? <p className="text-sm text-[color:var(--text-muted)]">Nenhum serviço disponível no momento.</p> : items.map((service) => (
          <label key={service.id} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] p-3">
            <input type={type === "main" ? "radio" : "checkbox"} name="service_id" value={service.id} checked={selected.includes(service.id)} onChange={() => toggle(service.id, type)} required={type === "main"} className="mt-1 size-4 accent-[var(--accent)]" />
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[color:var(--text-primary)]">{service.name}</span>{service.short_description ? <span className="mt-0.5 block text-xs text-[color:var(--text-muted)]">{service.short_description}</span> : null}</span>
            <span className="shrink-0 text-sm font-semibold text-[color:var(--text-primary)]">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(service.customerPrice)}</span>
          </label>
        ))}
      </div>
    </section>
  );

  return <>{group("Serviços principais", mains, "main")}{group("Complementos (até 3)", extras, "extra")}<section className="rounded-3xl border border-[var(--accent)]/40 bg-[linear-gradient(135deg,rgba(0,245,212,.18),rgba(15,23,42,.72))] p-4"><p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Resumo da escolha</p><div className="mt-2 space-y-1">{selectedServices.length === 0 ? <p className="text-sm text-[color:var(--text-muted)]">Selecione um serviço principal.</p> : selectedServices.map((service) => <div key={service.id} className="flex justify-between gap-3 text-sm"><span className="text-[color:var(--text-primary)]">{service.name}</span><span className="font-semibold text-[color:var(--text-primary)]">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(service.customerPrice)}</span></div>)}</div><div className="mt-3 flex justify-between border-t border-[color:var(--surface-border)] pt-3 font-semibold text-[color:var(--text-primary)]"><span>Total estimado</span><span>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(selectedServices.reduce((sum, service) => sum + service.customerPrice, 0))}</span></div></section></>;
}
