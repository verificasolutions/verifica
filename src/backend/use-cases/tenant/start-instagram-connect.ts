import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { buildInstagramAuthorizationUrl } from "@/backend/integrations/instagram";
import { getTenantSettings } from "@/backend/repos/tenant-settings-repo";
import { createInstagramOAuthState, INSTAGRAM_OAUTH_COOKIE } from "@/backend/shared/instagram-auth";

export async function startInstagramConnectUseCase() {
  const context = await requireOwnerOrManager();
  const settings = await getTenantSettings(context.tenantId);

  if (!settings?.instagram_enabled) {
    redirect("/app/dashboard?section=adm&panel=social&error=Instagram não liberado para este tenant.");
  }

  const state = createInstagramOAuthState({
    tenantId: context.tenantId,
    userId: context.userId,
  });
  const cookieStore = await cookies();

  cookieStore.set(INSTAGRAM_OAUTH_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });

  try {
    redirect(buildInstagramAuthorizationUrl(state));
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Instagram indisponível no momento.";
    redirect(`/app/dashboard?section=adm&panel=social&error=${encodeURIComponent(message)}`);
  }
}
