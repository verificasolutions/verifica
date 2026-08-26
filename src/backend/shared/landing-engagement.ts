import "server-only";
import { createHash } from "node:crypto";

/** Sanitização de texto de comentário: remove blocos script/style e tags, colapsa espaços e limita tamanho. */
export function sanitizeCommentText(value: string | null | undefined, maxLength = 500): string {
  const raw = String(value ?? "")
    // remove blocos script/style inteiros (conteúdo incluído)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    // remove tags HTML
    .replace(/<[^>]*>/g, " ")
    .replace(/[^\S\r\n]+/g, " ")
    .trim();

  return raw.slice(0, maxLength);
}

export function sanitizeAuthorName(value: string | null | undefined, maxLength = 60): string {
  const raw = String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return raw.slice(0, maxLength);
}

/**
 * Identidade do visitante (likes/comentários anônimos): hash server-side de IP + User-Agent.
 * Nunca é enviada ao navegador; apenas o hash é persistido (sem PII reversível).
 */
export function hashVisitorIdentity(ip: string | null | undefined, userAgent: string | null | undefined): string {
  return createHash("sha256")
    .update(`${String(ip ?? "unknown")}|${String(userAgent ?? "unknown")}`)
    .digest("hex");
}
