import "server-only";
import { redirect } from "next/navigation";
import { requireTenantUser } from "@/backend/auth/guards";
import { updateAttendanceServiceItemStatusForTenant } from "@/backend/repos/attendance-service-items-repo";
import { getTenantSettings } from "@/backend/repos/tenant-settings-repo";

function resolveErrorTarget(formData: FormData, message: string) {
  const requestedTarget = String(formData.get("redirect_to") ?? "").trim();
  const target =
    requestedTarget.startsWith("/app/dashboard") || requestedTarget.startsWith("/operador/dashboard")
      ? requestedTarget
      : "/app/dashboard";
  const separator = target.includes("?") ? "&" : "?";
  return `${target}${separator}error=${encodeURIComponent(message)}`;
}

export async function toggleAttendanceServiceItemUseCase(formData: FormData) {
  const context = await requireTenantUser();
  const attendanceId = String(formData.get("attendance_id") ?? "").trim();
  const itemId = String(formData.get("item_id") ?? "").trim();
  const nextStatus = String(formData.get("next_status") ?? "").trim() as "pending" | "completed";

  if (!attendanceId || !itemId || (nextStatus !== "pending" && nextStatus !== "completed")) {
    redirect(resolveErrorTarget(formData, "Servico do atendimento invalido."));
  }

  const settings = await getTenantSettings(context.tenantId);
  if (context.role === "operator" && settings?.operator_can_edit_status === false) {
    redirect(resolveErrorTarget(formData, "Seu perfil nao pode alterar servicos do atendimento."));
  }

  const updated = await updateAttendanceServiceItemStatusForTenant({
    tenantId: context.tenantId,
    attendanceId,
    itemId,
    status: nextStatus,
    completedBy: context.userId,
  });

  if (updated.error || !updated.data) {
    redirect(resolveErrorTarget(formData, updated.error?.message ?? "Falha ao atualizar o servico do atendimento."));
  }
}
