import "server-only";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { listTenantGrowthProgressByTenant } from "@/backend/repos/tenant-growth-repo";
import { TENANT_GROWTH_ROADMAP } from "@/backend/shared/tenant-growth-roadmap";

export async function getTenantGrowthWorkspaceUseCase() {
  const context = await requireOwnerOrManager();
  const progressRows = await listTenantGrowthProgressByTenant(context.tenantId);
  const progressMap = new Map(progressRows.map((row) => [row.step_key, row]));

  const phases = TENANT_GROWTH_ROADMAP.map((phase) => {
    const steps = phase.steps.map((step) => {
      const saved = progressMap.get(step.key);

      return {
        ...step,
        notes: saved?.notes ?? "",
        completed: Boolean(saved?.completed),
        completedAt: saved?.completed_at ?? null,
      };
    });

    const completedCount = steps.filter((step) => step.completed).length;

    return {
      ...phase,
      steps,
      completedCount,
      totalSteps: steps.length,
      completionRate: steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0,
    };
  });

  const totalSteps = phases.reduce((sum, phase) => sum + phase.totalSteps, 0);
  const completedSteps = phases.reduce((sum, phase) => sum + phase.completedCount, 0);

  return {
    tenantId: context.tenantId,
    phases,
    stats: {
      totalSteps,
      completedSteps,
      pendingSteps: totalSteps - completedSteps,
      completionRate: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
    },
  };
}

export type TenantGrowthWorkspace = Awaited<ReturnType<typeof getTenantGrowthWorkspaceUseCase>>;
