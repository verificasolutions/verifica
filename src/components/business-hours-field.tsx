"use client";

import { useMemo, useState } from "react";

type BusinessHoursFieldProps = {
  name: string;
  defaultValue?: string | null;
};

type DayEntry = {
  key: string;
  label: string;
  enabled: boolean;
  from: string;
  to: string;
};

const DAY_DEFS = [
  { key: "monday", label: "Segunda" },
  { key: "tuesday", label: "Terça" },
  { key: "wednesday", label: "Quarta" },
  { key: "thursday", label: "Quinta" },
  { key: "friday", label: "Sexta" },
  { key: "saturday", label: "Sábado" },
  { key: "sunday", label: "Domingo" },
] as const;

function buildDefaultDays(): DayEntry[] {
  return DAY_DEFS.map((day) => ({
    ...day,
    enabled: false,
    from: "",
    to: "",
  }));
}

function cloneDays(days: DayEntry[]) {
  return days.map((day) => ({ ...day }));
}

function parseOpeningHours(value?: string | null) {
  const days = buildDefaultDays();
  const source = (value ?? "").trim();

  if (!source) return days;

  for (const day of days) {
    const escaped = day.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = source.match(new RegExp(`${escaped}:\\s*(\\d{2}:\\d{2})\\s*às\\s*(\\d{2}:\\d{2})`, "i"));
    if (match) {
      day.enabled = true;
      day.from = match[1] ?? "";
      day.to = match[2] ?? "";
    }
  }

  return days;
}

function serializeOpeningHours(days: DayEntry[]) {
  return days
    .filter((day) => day.enabled && day.from && day.to)
    .map((day) => `${day.label}: ${day.from} às ${day.to}`)
    .join(" | ");
}

function buildSummary(days: DayEntry[]) {
  const enabledDays = days.filter((day) => day.enabled && day.from && day.to);

  if (enabledDays.length === 0) {
    return "Nenhum horário configurado.";
  }

  if (enabledDays.length === 1) {
    const [day] = enabledDays;
    return `${day.label}: ${day.from} às ${day.to}`;
  }

  return `${enabledDays.length} dias configurados`;
}

export function BusinessHoursField({ name, defaultValue }: BusinessHoursFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [days, setDays] = useState<DayEntry[]>(() => parseOpeningHours(defaultValue));
  const [draftDays, setDraftDays] = useState<DayEntry[]>(() => parseOpeningHours(defaultValue));

  const serialized = useMemo(() => serializeOpeningHours(days), [days]);
  const summary = useMemo(() => buildSummary(days), [days]);

  function openDrawer() {
    setDraftDays(cloneDays(days));
    setIsOpen(true);
  }

  function closeDrawer() {
    setIsOpen(false);
  }

  function saveDrawer() {
    setDays(cloneDays(draftDays));
    setIsOpen(false);
  }

  function updateDay(index: number, patch: Partial<DayEntry>) {
    setDraftDays((current) => current.map((day, currentIndex) => (currentIndex === index ? { ...day, ...patch } : day)));
  }

  function applySameHoursToEnabledDays() {
    const reference = draftDays.find((day) => day.enabled && day.from && day.to);
    if (!reference) return;

    setDraftDays((current) =>
      current.map((day) =>
        day.enabled
          ? {
              ...day,
              from: reference.from,
              to: reference.to,
            }
          : day,
      ),
    );
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={serialized} />

      <button
        type="button"
        onClick={openDrawer}
        className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/84 transition hover:border-white/20 hover:bg-white/8"
      >
        Configurar horários de funcionamento
      </button>

      <p className="text-xs text-white/48">{summary}</p>

      {isOpen ? (
        <>
          <button
            type="button"
            aria-label="Fechar horários"
            onClick={closeDrawer}
            className="fixed inset-0 z-40 bg-[color:var(--overlay-strong)]"
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="relative max-h-[92vh] w-full max-w-[920px] overflow-y-auto rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,20,27,0.98),rgba(9,12,18,1))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.48)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-white/42">Horário de funcionamento</p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">Dias e horários</h3>
                  <p className="mt-2 text-sm text-white/56">Marque os dias em que a operação atende e defina os horários.</p>
                </div>

                <button
                  type="button"
                  onClick={applySameHoursToEnabledDays}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/76 transition hover:border-white/20 hover:bg-white/8"
                >
                  Usar mesmo horário nos dias ativos
                </button>
              </div>

              <div className="mt-6 space-y-3">
                {draftDays.map((day, index) => (
                  <div
                    key={day.key}
                    className="grid gap-3 rounded-2xl border border-white/10 bg-black/15 p-4 md:grid-cols-[1.1fr_0.7fr_0.7fr]"
                  >
                    <label className="flex items-center gap-3 text-sm text-white/84">
                      <input
                        type="checkbox"
                        checked={day.enabled}
                        onChange={(event) =>
                          updateDay(index, {
                            enabled: event.target.checked,
                            from: event.target.checked ? day.from : "",
                            to: event.target.checked ? day.to : "",
                          })
                        }
                        className="size-4"
                      />
                      {day.label}
                    </label>

                    <input
                      type="time"
                      value={day.from}
                      onChange={(event) => updateDay(index, { from: event.target.value, enabled: true })}
                      disabled={!day.enabled}
                      className="h-11 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-45"
                    />

                    <input
                      type="time"
                      value={day.to}
                      onChange={(event) => updateDay(index, { to: event.target.value, enabled: true })}
                      disabled={!day.enabled}
                      className="h-11 rounded-2xl border border-white/10 bg-[#0f141b] px-4 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-45"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={saveDrawer}
                  className="flex min-h-12 items-center justify-center rounded-2xl border border-transparent bg-[var(--accent)] px-5 text-sm font-semibold text-slate-950 transition hover:brightness-105"
                >
                  Salvar horários
                </button>

                <button
                  type="button"
                  onClick={closeDrawer}
                  className="flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/6 px-5 text-sm text-white/82 transition hover:border-white/20 hover:bg-white/8"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
