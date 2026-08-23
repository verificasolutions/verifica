"use client";

import { useState } from "react";

type ShowcaseItem = {
  label: string;
  imageSrc?: string;
};

function ShowcaseButton({
  item,
  active,
  onActivate,
}: {
  item: ShowcaseItem;
  active: boolean;
  onActivate: () => void;
}) {
  return (
    <button
      type="button"
      onMouseEnter={onActivate}
      onFocus={onActivate}
      onClick={onActivate}
      className={`h-18 rounded-[24px] border px-5 text-left text-lg font-semibold transition ${
        active
          ? "border-[var(--accent)]/60 bg-[var(--accent)]/12 text-white shadow-[0_0_28px_rgba(0,245,212,0.10)]"
          : "border-white/10 bg-white/[0.03] text-white/92 hover:border-white/20 hover:bg-white/[0.05]"
      }`}
    >
      {item.label}
    </button>
  );
}

export function SaasEcosystemShowcase({ items }: { items: ShowcaseItem[] }) {
  const firstWithImage = items.find((item) => item.imageSrc)?.label ?? items[0]?.label ?? "";
  const [activeLabel, setActiveLabel] = useState(firstWithImage);
  const activeItem = items.find((item) => item.label === activeLabel) ?? items[0] ?? null;
  const hasActiveImage = Boolean(activeItem?.imageSrc);
  const leftItems = items.slice(0, 5);
  const rightItems = items.slice(5);

  return (
    <div className="mt-12 grid gap-6 xl:grid-cols-[210px_minmax(0,1fr)_210px]">
      <div className="grid content-center gap-4 xl:pr-3">
        {leftItems.map((item) => (
          <ShowcaseButton key={item.label} item={item} active={activeLabel === item.label} onActivate={() => setActiveLabel(item.label)} />
        ))}
      </div>

      <div className="relative min-w-0">
        <div className="rounded-[40px] border border-[var(--accent)]/22 bg-[radial-gradient(circle_at_50%_50%,rgba(0,245,212,0.14),rgba(0,245,212,0.02)_58%,transparent)] p-4 shadow-[0_0_90px_rgba(0,245,212,0.10)]">
          <div className="relative aspect-[16/9] overflow-hidden rounded-[34px] border border-white/10 bg-[#111922] shadow-[0_24px_80px_rgba(0,0,0,0.34)]">
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center bg-[#111922] text-center transition duration-300 ${
                hasActiveImage ? "scale-[0.985] opacity-0" : "scale-100 opacity-100"
              }`}
            >
              <img
                src="/verifica/verifica-logo.png"
                alt="Verifica"
                className="h-28 w-28 rounded-[24px] bg-white p-2 object-contain shadow-[0_16px_48px_rgba(0,0,0,0.28)]"
              />
              <p className="mt-5 text-3xl font-semibold text-white">VERIFICA</p>
              <p className="mt-3 text-sm text-white/54">Passe o mouse nos cards para abrir a prévia.</p>
            </div>

            <div className={`absolute inset-0 transition duration-300 ${hasActiveImage ? "opacity-100" : "opacity-0"}`}>
              {activeItem?.imageSrc ? (
                <div className="relative h-full w-full overflow-hidden">
                  <div
                    className="absolute inset-0 bg-cover bg-center opacity-20 blur-2xl scale-110"
                    style={{ backgroundImage: `url(${activeItem.imageSrc})` }}
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,15,22,0.08),rgba(10,15,22,0.24))]" />
                  <div className="relative flex h-full w-full items-center justify-center p-5 xl:p-6">
                    <img src={activeItem.imageSrc} alt={activeItem.label} className="max-h-full max-w-full object-contain" />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="grid content-center gap-4 xl:pl-3">
        {rightItems.map((item) => (
          <ShowcaseButton key={item.label} item={item} active={activeLabel === item.label} onActivate={() => setActiveLabel(item.label)} />
        ))}
      </div>
    </div>
  );
}
