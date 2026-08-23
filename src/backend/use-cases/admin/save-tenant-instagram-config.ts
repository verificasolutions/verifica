import "server-only";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/backend/auth/guards";
import { createAuditLogAdmin, upsertTenantInstagramConfigAdmin } from "@/backend/repos/admin-control-repo";
import { readCheckboxValue } from "@/backend/shared/tenant-whatsapp-messages";

export async function saveTenantInstagramConfigUseCase(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const tenantId = String(formData.get("tenant_id") ?? "").trim();

  if (!tenantId) {
    redirect("/admin?error=Tenant inválido.");
  }

  const error = await upsertTenantInstagramConfigAdmin({
    tenantId,
    instagramEnabled: readCheckboxValue(formData, "instagram_enabled"),
  });

  if (error) {
    redirect(`/admin/tenants/${tenantId}/workspace?error=${encodeURIComponent(error.message)}`);
  }

  await createAuditLogAdmin({
    actor_user_id: admin.userId,
    actor_email: admin.email,
    actor_role: admin.role,
    tenant_id: tenantId,
    action: "tenant_instagram_config.saved",
    entity_type: "tenant_settings",
    entity_id: tenantId,
    message: `${admin.email ?? "admin"} atualizou a liberação de Instagram do tenant.`,
  });
}
