import "server-only";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/backend/auth/guards";
import { createAuditLogAdmin } from "@/backend/repos/admin-control-repo";
import { updateTenantStatusAdmin } from "@/backend/repos/tenants-admin-repo";

export async function toggleTenantStatusUseCase(formData: FormData) {
  const admin = await requirePlatformAdmin();

  const tenantId = String(formData.get("tenant_id") ?? "");
  const nextValue = String(formData.get("next_value") ?? "") === "true";
  const redirectTo = String(formData.get("redirect_to") ?? "").trim();

  const error = await updateTenantStatusAdmin(tenantId, nextValue);

  if (error) {
    redirect(redirectTo ? `${redirectTo}${redirectTo.includes("?") ? "&" : "?"}error=${encodeURIComponent(error.message)}` : `/admin?error=${encodeURIComponent(error.message)}`);
  }

  await createAuditLogAdmin({
    actor_user_id: admin.userId,
    actor_email: admin.email,
    actor_role: admin.role,
    tenant_id: tenantId,
    action: nextValue ? "tenant.activated" : "tenant.suspended",
    entity_type: "tenant",
    entity_id: tenantId,
    message: `${admin.email ?? "admin"} ${nextValue ? "ativou" : "suspendeu"} um tenant.`,
    metadata: {
      is_active: nextValue,
    },
  });
}
