import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { upsertTenantGrowthProgress } from "@/backend/repos/tenant-growth-repo";
import { TENANT_GROWTH_STEP_KEYS } from "@/backend/shared/tenant-growth-roadmap";
import { buildDashboardRedirectTarget } from "@/backend/shared/dashboard-redirect";

export async function saveTenantGrowthStepUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const fallbackTarget = "/app/dashboard?section=crescendo";
  const stepKey = String(formData.get("step_key") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const completed = formData.get("completed") === "on";

  if (!TENANT_GROWTH_STEP_KEYS.has(stepKey)) {
    redirect(buildDashboardRedirectTarget(formData, fallbackTarget, "error", "Etapa de crescimento inválida."));
  }

  const error = await upsertTenantGrowthProgress({
    tenantId: context.tenantId,
    stepKey,
    notes: notes || null,
    completed,
    updatedBy: context.userId,
  });

  if (error) {
    redirect(buildDashboardRedirectTarget(formData, fallbackTarget, "error", error.message));
  }
}
