export const operationBoxTimeUnits = ["minutes", "hours_minutes", "days", "weeks", "months"] as const;
export const operationBoxTimeUnitOptions = [
  { value: "none", label: "Sem prazo" },
  { value: "minutes", label: "Minutos" },
  { value: "hours_minutes", label: "Horas e minutos" },
  { value: "days", label: "Dias" },
  { value: "weeks", label: "Semanas" },
  { value: "months", label: "Meses" },
] as const;

export type OperationBoxTimeUnit = (typeof operationBoxTimeUnits)[number];

const unitToMinutes: Record<Exclude<OperationBoxTimeUnit, "hours_minutes">, number> = {
  minutes: 1,
  days: 24 * 60,
  weeks: 7 * 24 * 60,
  months: 30 * 24 * 60,
};

export function normalizeOperationBoxTimeUnit(value: FormDataEntryValue | string | null | undefined): OperationBoxTimeUnit {
  const unit = String(value ?? "").trim();
  return operationBoxTimeUnits.includes(unit as OperationBoxTimeUnit) ? (unit as OperationBoxTimeUnit) : "minutes";
}

export function isOperationBoxWithoutDeadline(value: FormDataEntryValue | string | null | undefined) {
  return String(value ?? "").trim() === "none";
}

export function parseOperationBoxDurationToMinutes(value: FormDataEntryValue | string | null | undefined, unit: OperationBoxTimeUnit) {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;

  if (unit === "hours_minutes") {
    if (raw.includes(":")) {
      const [hoursRaw, minutesRaw = "0"] = raw.split(":");
      const hours = Number(hoursRaw);
      const minutes = Number(minutesRaw);
      if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || minutes < 0 || minutes >= 60) return null;
      const total = Math.floor(hours) * 60 + Math.floor(minutes);
      return total > 0 ? total : null;
    }

    const digits = raw.replace(/\D/g, "");
    if (!digits) return null;
    if (digits.length <= 2) {
      const hours = Number(digits);
      return Number.isFinite(hours) && hours > 0 ? hours * 60 : null;
    }

    const hours = Number(digits.slice(0, -2));
    const minutes = Number(digits.slice(-2));
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes >= 60) return null;
    const total = hours * 60 + minutes;
    return total > 0 ? total : null;
  }

  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.floor(amount * unitToMinutes[unit]);
}

export function formatOperationBoxDurationValue(minutes: number | null | undefined, unit: OperationBoxTimeUnit | null | undefined) {
  const total = Number(minutes ?? 0);
  const normalizedUnit = normalizeOperationBoxTimeUnit(unit);
  if (!Number.isFinite(total) || total <= 0) return "";

  if (normalizedUnit === "hours_minutes") {
    const hours = Math.floor(total / 60);
    const remainder = total % 60;
    return `${hours}:${String(remainder).padStart(2, "0")}`;
  }

  const divisor = unitToMinutes[normalizedUnit];
  return String(Math.max(1, Math.round(total / divisor)));
}

export function formatOperationBoxDurationLabel(minutes: number | null | undefined, unit: OperationBoxTimeUnit | null | undefined) {
  const total = Number(minutes ?? 0);
  const normalizedUnit = normalizeOperationBoxTimeUnit(unit);
  if (!Number.isFinite(total) || total <= 0) return "Livre";

  if (normalizedUnit === "hours_minutes") {
    const hours = Math.floor(total / 60);
    const remainder = total % 60;
    if (hours > 0 && remainder > 0) return `${hours}h ${remainder}min`;
    if (hours > 0) return `${hours}h`;
    return `${remainder}min`;
  }

  const amount = Math.max(1, Math.round(total / unitToMinutes[normalizedUnit]));
  if (normalizedUnit === "minutes") return `${amount} min`;
  if (normalizedUnit === "days") return `${amount} ${amount === 1 ? "dia" : "dias"}`;
  if (normalizedUnit === "weeks") return `${amount} ${amount === 1 ? "semana" : "semanas"}`;
  return `${amount} ${amount === 1 ? "mês" : "meses"}`;
}
