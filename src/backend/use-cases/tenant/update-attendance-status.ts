import "server-only";
import { redirect } from "next/navigation";
import { requireTenantUser } from "@/backend/auth/guards";
import { triggerMessageDispatchProcessing } from "@/backend/integrations/message-dispatch-trigger";
import { buildFinishingMessage, buildReadyMessage, buildWashStartMessage } from "@/backend/integrations/whatsapp-templates";
import { getLatestAttendanceMediaByKind } from "@/backend/repos/attendance-media-repo";
import { getAttendanceDetailById } from "@/backend/repos/attendances-details-repo";
import { createAttendancePublicStatus, updateAttendanceStatusForTenant } from "@/backend/repos/attendances-operations-repo";
import { enqueueMessageDispatch } from "@/backend/repos/message-dispatch-queue-repo";
import { getTenantSettings } from "@/backend/repos/tenant-settings-repo";
import { getTrackingUrl } from "@/backend/shared/app-url";
import { resolveAttendancePrimaryServiceName } from "@/backend/shared/attendance-service-summary";
import { resolvePostWashStatus } from "@/backend/shared/service-flow";
import { isTenantMessageStageEnabled } from "@/backend/shared/tenant-whatsapp-messages";
import { formatVehicleDisplayLabel } from "@/backend/shared/vehicle-catalog";

const stepIndexByStatus = {
  waiting: 2,
  washing: 3,
  finishing: 4,
  ready: 5,
  delivered: 5,
  canceled: 1,
} as const;

export async function updateAttendanceStatusUseCase(formData: FormData) {
  const context = await requireTenantUser();
  const attendanceId = String(formData.get("attendance_id") ?? "").trim();
  let status = String(formData.get("status") ?? "").trim() as
    | "waiting"
    | "washing"
    | "finishing"
    | "ready"
    | "delivered"
    | "canceled";

  if (!attendanceId || !(status in stepIndexByStatus)) {
    redirect("/app/dashboard?error=Status invalido.");
  }

  const settings = await getTenantSettings(context.tenantId);

  if (context.role === "operator" && settings?.operator_can_edit_status === false) {
    redirect("/operador/dashboard?error=Seu perfil nao pode alterar status.");
  }

  if (status === "finishing") {
    const detail = await getAttendanceDetailById(attendanceId);
    if (detail && resolvePostWashStatus(resolveAttendancePrimaryServiceName(detail)) === "ready") {
      status = "ready";
    }
  }

  const updated = await updateAttendanceStatusForTenant({
    attendanceId,
    status,
  });

  if (updated.error || !updated.data) {
    redirect(`/app/dashboard?error=${encodeURIComponent(updated.error?.message ?? "Falha ao atualizar status.")}`);
  }

  await createAttendancePublicStatus({
    attendanceId: updated.data.id,
    publicCode: updated.data.public_code,
    vehicleLabel: `${formatVehicleDisplayLabel(updated.data.vehicles ?? {})}${updated.data.vehicles?.color ? ` ${updated.data.vehicles.color}` : ""}`.trim(),
    status,
    etaMinutes: updated.data.estimated_minutes ?? 0,
    stepIndex: stepIndexByStatus[status],
  });

  const detail = await getAttendanceDetailById(updated.data.id);
  if (!detail?.customers?.whatsapp) {
    return;
  }

  const messageInput = {
    tenantName: context.tenant.name,
    customerName: detail.customers.name,
    vehicleModel: context.tenant.operational_profile === "automotive" ? formatVehicleDisplayLabel(detail.vehicles ?? {}) : "",
    vehiclePlate: context.tenant.operational_profile === "automotive" ? detail.vehicles?.plate ?? "-" : "",
    serviceName: resolveAttendancePrimaryServiceName(detail),
    etaMinutes: detail.estimated_minutes ?? 0,
    trackingUrl: getTrackingUrl(detail.public_code),
    operationalProfile: context.tenant.operational_profile,
  };

  if (status === "washing" && isTenantMessageStageEnabled(settings, "washing")) {
    const text = buildWashStartMessage(settings, messageInput);
    const dispatch = await enqueueMessageDispatch({
      tenantId: context.tenantId,
      attendanceId: updated.data.id,
      customerId: detail.customer_id ?? null,
      stage: "washing",
      whatsapp: detail.customers?.whatsapp ?? null,
      text,
    });
    if (dispatch.error) {
      console.error("Falha ao enfileirar mensagem de lavagem", {
        tenantId: context.tenantId,
        attendanceId: updated.data.id,
        whatsapp: detail.customers?.whatsapp ?? null,
        reason: dispatch.error.message,
      });
    } else {
      void triggerMessageDispatchProcessing();
    }
    return;
  }

  if (status === "finishing" && isTenantMessageStageEnabled(settings, "finishing")) {
    const text = buildFinishingMessage(settings, messageInput);
    const dispatch = await enqueueMessageDispatch({
      tenantId: context.tenantId,
      attendanceId: updated.data.id,
      customerId: detail.customer_id ?? null,
      stage: "finishing",
      whatsapp: detail.customers?.whatsapp ?? null,
      text,
    });
    if (dispatch.error) {
      console.error("Falha ao enfileirar mensagem de finalizacao", {
        tenantId: context.tenantId,
        attendanceId: updated.data.id,
        whatsapp: detail.customers?.whatsapp ?? null,
        reason: dispatch.error.message,
      });
    } else {
      void triggerMessageDispatchProcessing();
    }
    return;
  }

  if (status !== "ready" || !isTenantMessageStageEnabled(settings, "ready")) {
    return;
  }

  const readyMedia = await getLatestAttendanceMediaByKind(updated.data.id, "ready");
  const text = buildReadyMessage(settings, messageInput);

  const dispatch = await enqueueMessageDispatch({
    tenantId: context.tenantId,
    attendanceId: updated.data.id,
    customerId: detail.customer_id ?? null,
    stage: "ready",
    whatsapp: detail.customers?.whatsapp ?? null,
    text,
    mediaUrl: readyMedia?.signed_url ?? null,
    mediaMimeType: readyMedia?.mime_type ?? null,
    mediaFileName: readyMedia?.file_path?.split("/").pop() ?? null,
  });

  if (dispatch.error) {
    console.error("Falha ao enfileirar mensagem de pronto para retirada", {
      tenantId: context.tenantId,
      attendanceId: updated.data.id,
      whatsapp: detail.customers?.whatsapp ?? null,
      reason: dispatch.error.message,
    });
  } else {
    void triggerMessageDispatchProcessing();
  }
}
