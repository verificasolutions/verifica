import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveAccessContext } from "@/backend/auth/access-context";
import { exchangeInstagramCodeForToken, exchangeInstagramTokenForLongLived, listInstagramAccounts } from "@/backend/integrations/instagram";
import { createAuditLogAdmin } from "@/backend/repos/admin-control-repo";
import { getTenantSettings } from "@/backend/repos/tenant-settings-repo";
import { saveTenantInstagramConnection } from "@/backend/repos/tenant-instagram-repo";
import { withAppBasePath } from "@/backend/shared/app-url";
import { encryptInstagramSecret, INSTAGRAM_OAUTH_COOKIE, parseInstagramOAuthState } from "@/backend/shared/instagram-auth";

function redirectToSocial(request: Request, search: string) {
  const url = new URL(withAppBasePath("/app/dashboard"), request.url);
  url.search = search;
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code")?.trim() ?? "";
    const state = url.searchParams.get("state")?.trim() ?? "";
    const errorReason = url.searchParams.get("error_message")?.trim() || url.searchParams.get("error_description")?.trim() || "";
    const cookieStore = await cookies();
    const storedState = cookieStore.get(INSTAGRAM_OAUTH_COOKIE)?.value ?? "";

    const clearCookie = () => cookieStore.delete(INSTAGRAM_OAUTH_COOKIE);

    if (errorReason) {
      clearCookie();
      return redirectToSocial(request, `section=adm&panel=social&error=${encodeURIComponent(errorReason)}`);
    }

    if (!code || !state || !storedState || storedState !== state) {
      clearCookie();
      return redirectToSocial(request, "section=adm&panel=social&error=Retorno inválido do Instagram.");
    }

    const parsedState = parseInstagramOAuthState(state);
    const context = await resolveAccessContext();
    if (
      context.kind !== "tenant_user" ||
      context.role === "operator" ||
      context.tenantId !== parsedState.tenantId ||
      context.userId !== parsedState.userId
    ) {
      clearCookie();
      return redirectToSocial(request, "section=adm&panel=social&error=Sessão inválida para conectar o Instagram.");
    }

    const settings = await getTenantSettings(context.tenantId);
    if (!settings?.instagram_enabled) {
      clearCookie();
      return redirectToSocial(request, "section=adm&panel=social&error=Instagram não liberado para este tenant.");
    }

    const shortToken = await exchangeInstagramCodeForToken(code);
    const longLivedToken = await exchangeInstagramTokenForLongLived(shortToken.access_token);
    const accounts = await listInstagramAccounts(longLivedToken.access_token);

    if (accounts.length === 0) {
      clearCookie();
      return redirectToSocial(request, "section=adm&panel=social&error=Nenhuma conta profissional do Instagram foi encontrada.");
    }

    const chosenAccount = accounts[0];
    const tokenExpiresAt =
      typeof longLivedToken.expires_in === "number"
        ? new Date(Date.now() + longLivedToken.expires_in * 1000).toISOString()
        : null;

    const saved = await saveTenantInstagramConnection({
      tenantId: context.tenantId,
      instagramAccountId: chosenAccount.instagramAccountId,
      facebookPageId: chosenAccount.facebookPageId,
      accountName: chosenAccount.accountName,
      accessToken: encryptInstagramSecret(longLivedToken.access_token),
      refreshToken: null,
      tokenExpiresAt,
      connectedBy: context.userId,
    });

    if (saved.error) {
      throw new Error(saved.error.message);
    }

    await createAuditLogAdmin({
      actor_user_id: context.userId,
      actor_email: context.email,
      actor_role: context.role,
      tenant_id: context.tenantId,
      action: "tenant_instagram.connected",
      entity_type: "tenant_instagram_accounts",
      entity_id: saved.data?.id ?? context.tenantId,
      message: `${context.email ?? "tenant"} conectou o Instagram do tenant.`,
      metadata: {
        instagram_account_id: chosenAccount.instagramAccountId,
        facebook_page_id: chosenAccount.facebookPageId,
      },
    });

    clearCookie();
    return redirectToSocial(request, "section=adm&panel=social&message=Instagram conectado.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao conectar o Instagram.";
    return redirectToSocial(request, `section=adm&panel=social&error=${encodeURIComponent(message)}`);
  }
}
