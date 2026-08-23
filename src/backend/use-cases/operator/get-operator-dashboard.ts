import "server-only";
import { requireOperator } from "@/backend/auth/guards";
import { listAttendanceMediaByAttendances } from "@/backend/repos/attendance-media-repo";
import { listQueueForTodayByTenant } from "@/backend/repos/attendances-operations-repo";
import { ensureEmployeeWorkSessionOpen } from "@/backend/repos/employee-work-sessions-repo";
import { getEmployeeByAuthUser } from "@/backend/repos/employees-repo";
import { listOperationBoxesByTenant } from "@/backend/repos/operation-boxes-repo";
import { getTenantSettings } from "@/backend/repos/tenant-settings-repo";

function firstName(value: string | null | undefined, email: string | null | undefined) {
  if (value?.trim()) {
    return value.trim().split(" ")[0];
  }
  return email?.split("@")[0] ?? "Operador";
}

export async function getOperatorDashboardUseCase() {
  const context = await requireOperator();
  await ensureEmployeeWorkSessionOpen({
    tenantId: context.tenantId,
    authUserId: context.userId,
  });
  const employee = await getEmployeeByAuthUser(context.tenantId, context.userId);
  const [queue, settings, operationBoxes] = await Promise.all([
    listQueueForTodayByTenant(context.tenantId),
    getTenantSettings(context.tenantId),
    listOperationBoxesByTenant(context.tenantId),
  ]);
  const mediaByAttendance = await listAttendanceMediaByAttendances(queue.map((item) => item.id));
  const queueWithMedia = queue.map((item) => ({
    ...item,
    media: mediaByAttendance.get(item.id) ?? [],
  }));

  const mine = employee
    ? queueWithMedia
        .filter((item) => item.employee_id === employee.id && (item.status === "waiting" || item.status === "washing" || item.status === "finishing"))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    : [];
  const finished = queueWithMedia.filter((item) => item.status === "ready" || item.status === "delivered");
  const inProgress = queueWithMedia.filter((item) => item.status === "washing" || item.status === "finishing");
  const available = (settings?.operator_can_view_all_cars ?? true)
    ? queueWithMedia
        .filter((item) => !item.employee_id && item.status === "waiting")
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    : [];

  return {
    actor: {
      firstName: firstName(context.profile?.full_name, context.email),
    },
    tenantId: context.tenantId,
    tenant: context.tenant,
    employee,
    settings,
    operationBoxes,
    stats: {
      assignedToday: mine.length,
      myQueue: queue.filter((item) => item.status === "waiting").length,
      inProgress: inProgress.length,
      ready: queue.filter((item) => item.status === "ready").length,
      finished: finished.length,
    },
    queue: queueWithMedia,
    mine,
    available,
  };
}
