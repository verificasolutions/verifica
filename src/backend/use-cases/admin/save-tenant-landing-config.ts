import "server-only";
import { requirePlatformAdmin } from "@/backend/auth/guards";
import { createAuditLogAdmin, upsertTenantLandingConfigAdmin } from "@/backend/repos/admin-control-repo";
import { readCheckboxValue } from "@/backend/shared/tenant-whatsapp-messages";

export async function saveTenantLandingConfigUseCase(formData: FormData) {
  const context = await requirePlatformAdmin();
  const tenantId = String(formData.get("tenant_id") ?? "").trim();

  const error = await upsertTenantLandingConfigAdmin({
    tenantId,
    landingEnabled: readCheckboxValue(formData, "landing_enabled"),
  });

  if (error) {
    throw new Error(error.message);
  }

  await createAuditLogAdmin({
    actor_user_id: context.userId,
    actor_email: context.email,
    actor_role: context.role,
    tenant_id: tenantId,
    action: "tenant_landing_config.saved",
    entity_type: "tenant_settings",
    entity_id: tenantId,
    message: `${context.email ?? "admin"} atualizou a liberação da landing pública.`,
    metadata: {
      landing_enabled: readCheckboxValue(formData, "landing_enabled"),
    },
  });
}
