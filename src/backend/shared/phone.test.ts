import { describe, expect, it } from "vitest";
import { digitsOnly, normalizeNationalPhone } from "./phone";

describe("normalizeNationalPhone", () => {
  it("normaliza formatos nacionais (10/11 dígitos)", () => {
    expect(normalizeNationalPhone("(11) 99999-9999")).toBe("11999999999");
    expect(normalizeNationalPhone("11 9999-9999")).toBe("1199999999");
    expect(normalizeNationalPhone("11999999999")).toBe("11999999999");
    expect(normalizeNationalPhone(" 11 98888-7777 ")).toBe("11988887777");
  });

  it("remove o +55 internacional", () => {
    expect(normalizeNationalPhone("+55 11 99999-9999")).toBe("11999999999");
    expect(normalizeNationalPhone("5511999999999")).toBe("11999999999");
    expect(normalizeNationalPhone("+5511988887777")).toBe("11988887777");
  });

  it("rejeita entradas inválidas (retorna vazio)", () => {
    expect(normalizeNationalPhone("123")).toBe("");
    expect(normalizeNationalPhone("")).toBe("");
    expect(normalizeNationalPhone(null)).toBe("");
    expect(normalizeNationalPhone(undefined)).toBe("");
  });

  it("digitsOnly extrai apenas dígitos", () => {
    expect(digitsOnly("(11) 9.9999-9999")).toBe("11999999999");
  });
});
