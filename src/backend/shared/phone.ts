import "server-only";

export function digitsOnly(value: string) {
  return value.replace(/\D+/g, "");
}

/**
 * Normaliza telefone para o formato nacional armazenado: 10/11 dígitos, sem +55,
 * sem espaços/hífens. Ex.: "+55 (11) 99999-9999" -> "11999999999".
 * Retorna "" para entradas inválidas.
 */
export function normalizeNationalPhone(value: string | null | undefined): string {
  const digits = digitsOnly(String(value ?? ""));
  if (digits.length === 10 || digits.length === 11) return digits;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    return digits.slice(2);
  }
  return "";
}
