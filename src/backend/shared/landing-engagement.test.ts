import { describe, expect, it } from "vitest";
import { hashVisitorIdentity, sanitizeAuthorName, sanitizeCommentText } from "./landing-engagement";

describe("sanitização de comentários", () => {
  it("remove tags HTML e script", () => {
    expect(sanitizeCommentText("<script>alert(1)</script>Olá, ótimo serviço!")).toBe("Olá, ótimo serviço!");
    expect(sanitizeCommentText('<a href="x">link</a> texto')).toBe("link texto");
  });

  it("colapsa espaços, limita tamanho e remove branco", () => {
    expect(sanitizeCommentText("  Muito    bom!  ")).toBe("Muito bom!");
    expect(sanitizeCommentText("a".repeat(700)).length).toBeLessThanOrEqual(500);
    expect(sanitizeCommentText("   ")).toBe("");
  });

  it("sanitiza nome do autor", () => {
    expect(sanitizeAuthorName("<b>João</b>")).toBe("João");
    expect(sanitizeAuthorName("  Maria  Silva  ")).toBe("Maria Silva");
  });
});

describe("hashVisitorIdentity", () => {
  it("gera hash estável por (ip, user-agent) e diferente para entradas distintas", () => {
    const a = hashVisitorIdentity("1.2.3.4", "Mozilla/5.0");
    const b = hashVisitorIdentity("1.2.3.4", "Mozilla/5.0");
    const c = hashVisitorIdentity("1.2.3.4", "Chrome/120");

    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("não expõe o IP bruto no hash", () => {
    const hash = hashVisitorIdentity("203.0.113.99", "UA");
    expect(hash).not.toContain("203.0.113.99");
  });
});
