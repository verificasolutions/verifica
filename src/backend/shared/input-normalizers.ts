import "server-only";

export function digitsOnly(value: string) {
  return value.replace(/\D+/g, "");
}

export function normalizeWhatsappForEvolution(value: string) {
  const digits = digitsOnly(value);

  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;

  return digits;
}

export function registrationOnly(value: string) {
  return value.replace(/[^A-Za-z0-9]+/g, "").toUpperCase();
}

export function normalizeDocumentType(value: string | null | undefined) {
  const digits = digitsOnly(String(value ?? ""));

  if (digits.length === 11) return "cpf";
  if (digits.length === 14) return "cnpj";

  return null;
}

export function parseCurrencyInput(value: FormDataEntryValue | null | undefined) {
  const raw = String(value ?? "").trim();
  const cleaned = raw.replace(/[^\d,.-]/g, "");

  if (!cleaned) return 0;

  if (cleaned.includes(",")) {
    const normalized = cleaned.replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function parseDurationInput(value: FormDataEntryValue | null | undefined) {
  const raw = String(value ?? "").trim();

  if (!raw) return 0;

  if (raw.includes(":")) {
    const [hoursRaw, minutesRaw, ...rest] = raw.split(":");
    if (rest.length > 0) return Number.NaN;

    const hours = Number(hoursRaw.trim());
    const minutes = Number(minutesRaw.trim());

    if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || minutes < 0 || minutes >= 60) {
      return Number.NaN;
    }

    return hours * 60 + minutes;
  }

  const digits = raw.replace(/\D+/g, "");
  if (!digits) return Number.NaN;

  if (digits.length >= 3) {
    const hours = Number(digits.slice(0, -2));
    const minutes = Number(digits.slice(-2));

    if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes >= 60) {
      return Number.NaN;
    }

    return hours * 60 + minutes;
  }

  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}
