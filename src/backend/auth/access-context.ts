import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentMembershipRecord } from "@/backend/repos/memberships-repo";
import { getCurrentPlatformAdminRecord } from "@/backend/repos/platform-admins-repo";
import { getCurrentProfile } from "@/backend/repos/profiles-repo";
import { getTenantSettings } from "@/backend/repos/tenant-settings-repo";
import type { AccessContext } from "@/backend/types";

function getSessionIssuedAt(accessToken: string | undefined) {
  if (!accessToken) return null;

  const parts = accessToken.split(".");
  if (parts.length < 2) return null;

  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { iat?: number };
    return typeof payload.iat === "number" ? payload.iat * 1000 : null;
  } catch {
    return null;
  }
}

export const resolveAccessContext = cache(async (): Promise<AccessContext> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { kind: "anonymous" };
  }

  const [platformAdmin, membership, profile] = await Promise.all([
    getCurrentPlatformAdminRecord(user.id),
    getCurrentMembershipRecord(user.id),
    getCurrentProfile(user.id),
  ]);

  if (platformAdmin) {
    return {
      kind: "platform_admin",
      userId: user.id,
      email: user.email ?? null,
      role: platformAdmin.role,
      profile,
    };
  }

  if (membership?.tenants) {
    const [{ data: sessionData }, settings] = await Promise.all([supabase.auth.getSession(), getTenantSettings(membership.tenant_id)]);
    const issuedAt = getSessionIssuedAt(sessionData.session?.access_token);
    const logoutBefore = settings?.logout_before ? new Date(settings.logout_before).getTime() : null;

    if (issuedAt && logoutBefore && issuedAt < logoutBefore) {
      await supabase.auth.signOut();
      return { kind: "anonymous" };
    }

    return {
      kind: "tenant_user",
      userId: user.id,
      email: user.email ?? null,
      role: membership.role,
      tenantId: membership.tenant_id,
      tenant: membership.tenants,
      profile,
    };
  }

  return {
    kind: "anonymous",
  };
});
