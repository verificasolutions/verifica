import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("hash de senha (scrypt nativo)", () => {
  it("gera hash autocontido com parâmetros versionados", async () => {
    const hash = await hashPassword("senha-forte-123");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash.split("$").length).toBe(6);
  });

  it("verifica senha correta e rejeita errada", async () => {
    const hash = await hashPassword("correta");
    expect(await verifyPassword("correta", hash)).toBe(true);
    expect(await verifyPassword("errada", hash)).toBe(false);
  });

  it("rejeita hashes malformados sem lançar", async () => {
    expect(await verifyPassword("x", "invalido")).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "scrypt$1$2$3$salt")).toBe(false);
  });
});
