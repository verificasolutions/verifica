import "server-only";
import { getInstagramMetaAppId, getInstagramMetaAppSecret } from "@/lib/env";
import { getInstagramRedirectUri } from "@/backend/shared/instagram-auth";

type MetaGraphErrorPayload = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

export type InstagramAccountCandidate = {
  instagramAccountId: string;
  facebookPageId: string | null;
  accountName: string;
};

function getInstagramApiVersion() {
  return process.env.INSTAGRAM_META_API_VERSION?.trim() || "v23.0";
}

function getInstagramOauthBaseUrl() {
  return "https://www.instagram.com/oauth/authorize";
}

function getInstagramGraphApiBaseUrl() {
  return `https://graph.instagram.com/${getInstagramApiVersion()}`;
}

function getInstagramGraphApiRootUrl() {
  return "https://graph.instagram.com";
}

function buildScopes() {
  return [
    "instagram_business_basic",
    "instagram_business_content_publish",
  ].join(",");
}

async function readMetaResponse<T>(response: Response) {
  const data = (await response.json().catch(() => null)) as (T & MetaGraphErrorPayload) | null;

  if (!response.ok) {
    throw new Error(data?.error?.message ?? "Falha na integra\u00e7\u00e3o com a Meta.");
  }

  if (data?.error?.message) {
    throw new Error(data.error.message);
  }

  return data as T;
}

export function buildInstagramAuthorizationUrl(state: string) {
  const params = new URLSearchParams({
    force_reauth: "true",
    client_id: getInstagramMetaAppId(),
    redirect_uri: getInstagramRedirectUri(),
    response_type: "code",
    scope: buildScopes(),
    state,
  });

  return `${getInstagramOauthBaseUrl()}?${params.toString()}`;
}

export async function exchangeInstagramCodeForToken(code: string) {
  const body = new URLSearchParams({
    client_id: getInstagramMetaAppId(),
    client_secret: getInstagramMetaAppSecret(),
    grant_type: "authorization_code",
    redirect_uri: getInstagramRedirectUri(),
    code,
  });

  const response = await fetch(`${getInstagramGraphApiRootUrl()}/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  return readMetaResponse<{ access_token: string; token_type: string; expires_in?: number }>(response);
}

export async function exchangeInstagramTokenForLongLived(accessToken: string) {
  const tokenUrl = new URL(`${getInstagramGraphApiRootUrl()}/access_token`);
  tokenUrl.searchParams.set("grant_type", "ig_exchange_token");
  tokenUrl.searchParams.set("client_secret", getInstagramMetaAppSecret());
  tokenUrl.searchParams.set("access_token", accessToken);

  const response = await fetch(tokenUrl.toString(), {
    method: "GET",
    cache: "no-store",
  });

  return readMetaResponse<{ access_token: string; token_type: string; expires_in?: number }>(response);
}

export async function listInstagramAccounts(accessToken: string) {
  const url = new URL(`${getInstagramGraphApiRootUrl()}/me`);
  url.searchParams.set("fields", "user_id,username,name");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  const payload = await readMetaResponse<{
    id?: string;
    user_id?: string;
    username?: string;
    name?: string;
  }>(response);

  const instagramAccountId = payload.user_id?.trim() || payload.id?.trim() || "";
  if (!instagramAccountId) {
    return [];
  }

  return [
    {
      instagramAccountId,
      facebookPageId: null,
      accountName: payload.username?.trim() || payload.name?.trim() || "Instagram conectado",
    },
  ];
}

export async function createInstagramMediaContainer(input: {
  instagramAccountId: string;
  accessToken: string;
  imageUrl: string;
  caption: string;
}) {
  const body = new URLSearchParams({
    image_url: input.imageUrl,
    caption: input.caption,
    access_token: input.accessToken,
  });

  const response = await fetch(`${getInstagramGraphApiBaseUrl()}/${input.instagramAccountId}/media`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  return readMetaResponse<{ id: string }>(response);
}

export async function publishInstagramMedia(input: {
  instagramAccountId: string;
  accessToken: string;
  creationId: string;
}) {
  const body = new URLSearchParams({
    creation_id: input.creationId,
    access_token: input.accessToken,
  });

  const response = await fetch(`${getInstagramGraphApiBaseUrl()}/${input.instagramAccountId}/media_publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  return readMetaResponse<{ id: string }>(response);
}
