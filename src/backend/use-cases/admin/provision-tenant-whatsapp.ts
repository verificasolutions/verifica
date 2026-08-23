import "server-only";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/backend/auth/guards";
import { provisionEvolutionInstance } from "@/backend/integrations/evolution-admin";
import { createAuditLogAdmin, getPlatformSettingsAdmin, getTenantWorkspaceAdmin, upsertTenantWhatsappConfigAdmin } from "@/backend/repos/admin-control-repo";
import { digitsOnly } from "@/backend/shared/input-normalizers";
import { buildTenantEvolutionInstance, buildTenantEvolutionToken } from "@/backend/shared/tenant-whatsapp";

export async function provisionTenantWhatsappUseCase(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const tenantId = String(formData.get("tenant_id") ?? "").trim();

  if (!tenantId) {
    redirect("/admin?error=Tenant inválido.");
  }

  const [platformSettings, workspace] = await Promise.all([getPlatformSettingsAdmin(), getTenantWorkspaceAdmin(tenantId)]);

  if (!workspace) {
    redirect("/admin?error=Tenant não encontrado.");
  }

  if (!platformSettings?.whatsapp_base_url || !platformSettings.evolution_api_key || !platformSettings.evolution_enabled) {
    redirect(`/admin/tenants/${tenantId}/workspace?error=Configure a Evolution no Admin Master antes de provisionar o tenant.`);
  }

  const tenantPhone = digitsOnly(workspace.tenant.whatsapp ?? "");

  if (tenantPhone.length < 10) {
    redirect(`/admin/tenants/${tenantId}/workspace?error=Cadastre um WhatsApp vÃ¡lido no tenant antes de provisionar a conexÃ£o.`);
  }

  const evolutionInstance =
    workspace.tenantSettings?.evolution_instance ??
    buildTenantEvolutionInstance({
      tenantId,
      tenantSlug: workspace.tenant.slug,
      tenantName: workspace.tenant.name,
    });
  const evolutionToken = workspace.tenantSettings?.evolution_api_key ?? buildTenantEvolutionToken();

  const saveError = await upsertTenantWhatsappConfigAdmin({
    tenantId,
    evolutionBaseUrl: platformSettings.whatsapp_base_url,
    evolutionInstance,
    evolutionApiKey: evolutionToken,
    evolutionEnabled: true,
    customerMessagesEnabled: workspace.tenantSettings?.customer_messages_enabled ?? false,
  });

  if (saveError) {
    redirect(`/admin/tenants/${tenantId}/workspace?error=${encodeURIComponent(saveError.message)}`);
  }

  const provisionResult = await provisionEvolutionInstance({
    config: {
      baseUrl: platformSettings.whatsapp_base_url,
      masterApiKey: platformSettings.evolution_api_key,
    },
    instanceName: evolutionInstance,
    instanceToken: evolutionToken,
    number: tenantPhone,
  });

  if (!provisionResult.ok) {
    redirect(`/admin/tenants/${tenantId}/workspace?error=${encodeURIComponent(provisionResult.message)}`);
  }

  await createAuditLogAdmin({
    actor_user_id: admin.userId,
    actor_email: admin.email,
    actor_role: admin.role,
    tenant_id: tenantId,
    action: "tenant_whatsapp.provisioned",
    entity_type: "tenant_settings",
    entity_id: tenantId,
    message: `${admin.email ?? "admin"} provisionou a conexão de WhatsApp do tenant.`,
    metadata: {
      evolutionInstance,
    },
  });

  redirect(`/admin/tenants/${tenantId}/workspace?message=Conexão do WhatsApp provisionada.&connect=1`);
}
