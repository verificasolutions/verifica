import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { getInstagramMetaAppSecret, getInstagramTokenSecret } from "@/lib/env";
import { getAppUrl } from "@/backend/shared/app-url";

export const INSTAGRAM_OAUTH_COOKIE = "vw_instagram_oauth_state";

type InstagramOAuthStatePayload = {
  tenantId: string;
  userId: string;
  returnPath: string;
  expiresAt: number;
};

function toBase64Url(value: Buffer | string) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}

function fromBase64UrlToUtf8(value: string) {
  return fromBase64Url(value).toString("utf8");
}

function getInstagramSecretKey() {
  return createHash("sha256").update(getInstagramTokenSecret()).digest();
}

function getInstagramRedirectBaseUrl() {
  const appUrl = getAppUrl();

  if (!appUrl) {
    throw new Error("URL pública do app não configurada para Instagram.");
  }

  return appUrl;
}

export function getInstagramRedirectUri() {
  return `${getInstagramRedirectBaseUrl()}/api/integrations/instagram/callback`;
}

export function encryptInstagramSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getInstagramSecretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${toBase64Url(iv)}.${toBase64Url(tag)}.${toBase64Url(encrypted)}`;
}

export function decryptInstagramSecret(value: string) {
  const [ivEncoded, tagEncoded, encryptedEncoded] = value.split(".");

  if (!ivEncoded || !tagEncoded || !encryptedEncoded) {
    throw new Error("Token do Instagram inválido.");
  }

  const decipher = createDecipheriv("aes-256-gcm", getInstagramSecretKey(), fromBase64Url(ivEncoded));
  decipher.setAuthTag(fromBase64Url(tagEncoded));
  const decrypted = Buffer.concat([decipher.update(fromBase64Url(encryptedEncoded)), decipher.final()]);
  return decrypted.toString("utf8");
}

export function createInstagramOAuthState(input: {
  tenantId: string;
  userId: string;
  returnPath?: string;
}) {
  const payload: InstagramOAuthStatePayload = {
    tenantId: input.tenantId,
    userId: input.userId,
    returnPath: input.returnPath ?? "/app/dashboard?section=adm&panel=social",
    expiresAt: Date.now() + 10 * 60 * 1000,
  };
  const body = toBase64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", getInstagramTokenSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function parseInstagramOAuthState(token: string) {
  const [body, signature] = token.split(".");

  if (!body || !signature) {
    throw new Error("State do Instagram inválido.");
  }

  const expectedSignature = createHmac("sha256", getInstagramTokenSecret()).update(body).digest("base64url");
  if (signature !== expectedSignature) {
    throw new Error("State do Instagram inválido.");
  }

  const payload = JSON.parse(fromBase64UrlToUtf8(body)) as InstagramOAuthStatePayload;
  if (!payload.tenantId || !payload.userId || !payload.returnPath) {
    throw new Error("State do Instagram inválido.");
  }

  if (payload.expiresAt < Date.now()) {
    throw new Error("State do Instagram expirado.");
  }

  return payload;
}

export function parseInstagramSignedRequest<T extends Record<string, unknown> = Record<string, unknown>>(signedRequest: string) {
  const [signature, payload] = signedRequest.split(".");

  if (!signature || !payload) {
    throw new Error("signed_request inválido.");
  }

  const expectedSignature = createHmac("sha256", getInstagramMetaAppSecret()).update(payload).digest();
  const receivedSignature = fromBase64Url(signature);

  if (expectedSignature.length !== receivedSignature.length || !timingSafeEqual(expectedSignature, receivedSignature)) {
    throw new Error("Assinatura do Instagram inválida.");
  }

  const parsed = JSON.parse(fromBase64UrlToUtf8(payload)) as T & { algorithm?: string };
  if (parsed.algorithm && parsed.algorithm.toUpperCase() !== "HMAC-SHA256") {
    throw new Error("Algoritmo do Instagram inválido.");
  }

  return parsed;
}
