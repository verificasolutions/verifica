import "server-only";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/backend/auth/guards";
import { createAuditLogAdmin, getPlatformSettingsAdmin, upsertPlatformSettingsAdmin } from "@/backend/repos/admin-control-repo";

export async function savePlatformSettingsUseCase(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const platformName = String(formData.get("platform_name") ?? "").trim();
  const currentSettings = await getPlatformSettingsAdmin();

  if (!platformName) {
    redirect("/admin?error=Nome da plataforma é obrigatório.");
  }

  const error = await upsertPlatformSettingsAdmin({
    key: "default",
    platform_name: platformName,
    logo_url: String(formData.get("logo_url") ?? "").trim() || null,
    primary_domain: String(formData.get("primary_domain") ?? "").trim() || null,
    smtp_host: String(formData.get("smtp_host") ?? "").trim() || null,
    smtp_port: Number(formData.get("smtp_port") ?? 0) || null,
    smtp_username: String(formData.get("smtp_username") ?? "").trim() || null,
    smtp_password: String(formData.get("smtp_password") ?? "").trim() || null,
    smtp_from_email: String(formData.get("smtp_from_email") ?? "").trim() || null,
    resend_from_email: String(formData.get("resend_from_email") ?? "").trim() || null,
    resend_reply_to_email: String(formData.get("resend_reply_to_email") ?? "").trim() || null,
    resend_webhook_id: currentSettings?.resend_webhook_id ?? null,
    resend_webhook_secret: currentSettings?.resend_webhook_secret ?? null,
    whatsapp_provider: String(formData.get("whatsapp_provider") ?? "").trim() || null,
    whatsapp_base_url: String(formData.get("whatsapp_base_url") ?? "").trim() || null,
    evolution_instance: String(formData.get("evolution_instance") ?? "").trim() || null,
    evolution_api_key: String(formData.get("evolution_api_key") ?? "").trim() || null,
    evolution_enabled: String(formData.get("evolution_enabled") ?? "") === "true",
    default_return_reminder_enabled: String(formData.get("default_return_reminder_enabled") ?? "true") === "true",
    default_return_reminder_days: Number(formData.get("default_return_reminder_days") ?? 30) || 30,
    default_return_reminder_time: String(formData.get("default_return_reminder_time") ?? "").trim() || "09:00",
    default_queue_entry_message: String(formData.get("default_queue_entry_message") ?? "").trim() || null,
    default_wash_start_message: String(formData.get("default_wash_start_message") ?? "").trim() || null,
    default_ready_message: String(formData.get("default_ready_message") ?? "").trim() || null,
    default_return_reminder_message: String(formData.get("default_return_reminder_message") ?? "").trim() || null,
  });

  if (error) {
    redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  }

  await createAuditLogAdmin({
    actor_user_id: admin.userId,
    actor_email: admin.email,
    actor_role: admin.role,
    action: "platform_settings.saved",
    entity_type: "platform_settings",
    entity_id: "default",
    message: `${admin.email ?? "admin"} atualizou as configurações globais.`,
  });
}
