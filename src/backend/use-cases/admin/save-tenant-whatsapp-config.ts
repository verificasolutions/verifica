import "server-only";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/backend/auth/guards";
import { createAuditLogAdmin, upsertTenantWhatsappConfigAdmin } from "@/backend/repos/admin-control-repo";
import { readCheckboxValue } from "@/backend/shared/tenant-whatsapp-messages";

export async function saveTenantWhatsappConfigUseCase(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const tenantId = String(formData.get("tenant_id") ?? "").trim();

  if (!tenantId) {
    redirect("/admin?error=Tenant inválido.");
  }

  const error = await upsertTenantWhatsappConfigAdmin({
    tenantId,
    evolutionBaseUrl: String(formData.get("evolution_base_url") ?? "").trim() || null,
    evolutionInstance: String(formData.get("evolution_instance") ?? "").trim() || null,
    evolutionApiKey: String(formData.get("evolution_api_key") ?? "").trim() || null,
    evolutionEnabled: readCheckboxValue(formData, "evolution_enabled"),
    customerMessagesEnabled: readCheckboxValue(formData, "customer_messages_enabled"),
  });

  if (error) {
    redirect(`/admin/tenants/${tenantId}/workspace?error=${encodeURIComponent(error.message)}`);
  }

  await createAuditLogAdmin({
    actor_user_id: admin.userId,
    actor_email: admin.email,
    actor_role: admin.role,
    tenant_id: tenantId,
    action: "tenant_whatsapp_config.saved",
    entity_type: "tenant_settings",
    entity_id: tenantId,
    message: `${admin.email ?? "admin"} atualizou a conexão de WhatsApp do tenant.`,
  });
}
