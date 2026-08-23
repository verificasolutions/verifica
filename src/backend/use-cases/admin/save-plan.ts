import "server-only";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/backend/auth/guards";
import { createAuditLogAdmin, upsertPlanAdmin } from "@/backend/repos/admin-control-repo";
import { parseCurrencyInput } from "@/backend/shared/input-normalizers";
import { slugify } from "@/backend/shared/slug";

export async function savePlanUseCase(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const id = String(formData.get("plan_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const code = slugify(String(formData.get("code") ?? name).trim());
  const price = parseCurrencyInput(formData.get("price_monthly"));
  const operatorLimitRaw = String(formData.get("operator_limit") ?? "").trim();
  const appointmentLimitRaw = String(formData.get("appointment_limit") ?? "").trim();
  const whatsappLimitRaw = String(formData.get("whatsapp_limit") ?? "").trim();
  const features = String(formData.get("features") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const isActive = String(formData.get("is_active") ?? "true") === "true";

  if (!name || !code) {
    redirect("/admin?error=Plano inválido.");
  }

  const error = await upsertPlanAdmin({
    id: id || undefined,
    code,
    name,
    price_monthly: Number.isFinite(price) ? price : 0,
    operator_limit: operatorLimitRaw ? Number(operatorLimitRaw) : null,
    appointment_limit: appointmentLimitRaw ? Number(appointmentLimitRaw) : null,
    whatsapp_limit: whatsappLimitRaw ? Number(whatsappLimitRaw) : null,
    features,
    is_active: isActive,
  });

  if (error) {
    redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  }

  await createAuditLogAdmin({
    actor_user_id: admin.userId,
    actor_email: admin.email,
    actor_role: admin.role,
    action: id ? "plan.updated" : "plan.created",
    entity_type: "plan",
    entity_id: id || null,
    message: `${admin.email ?? "admin"} ${id ? "atualizou" : "criou"} o plano ${name}.`,
    metadata: { code, price },
  });
}
