import "server-only";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/backend/auth/guards";
import { createAuditLogAdmin, upsertSubscriptionAdmin } from "@/backend/repos/admin-control-repo";
import { parseCurrencyInput } from "@/backend/shared/input-normalizers";

export async function saveSubscriptionUseCase(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const tenantId = String(formData.get("tenant_id") ?? "").trim();
  const planId = String(formData.get("plan_id") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "trialing").trim() as
    | "trialing"
    | "active"
    | "past_due"
    | "canceled"
    | "suspended";
  const amount = parseCurrencyInput(formData.get("amount"));
  const currentPeriodEnd = String(formData.get("current_period_end") ?? "").trim() || null;
  const trialEndsAt = String(formData.get("trial_ends_at") ?? "").trim() || null;

  if (!tenantId) {
    redirect("/admin?error=Tenant inválido.");
  }

  const error = await upsertSubscriptionAdmin({
    tenant_id: tenantId,
    plan_id: planId,
    status,
    amount: Number.isFinite(amount) ? amount : 0,
    current_period_end: currentPeriodEnd,
    trial_ends_at: trialEndsAt,
  });

  if (error) {
    redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  }

  await createAuditLogAdmin({
    actor_user_id: admin.userId,
    actor_email: admin.email,
    actor_role: admin.role,
    tenant_id: tenantId,
    action: "subscription.saved",
    entity_type: "subscription",
    entity_id: tenantId,
    message: `${admin.email ?? "admin"} atualizou a assinatura de um tenant.`,
    metadata: { planId, status, amount },
  });
}
