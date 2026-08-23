import "server-only";
import { redirect } from "next/navigation";
import { requireOperator } from "@/backend/auth/guards";
import { triggerMessageDispatchProcessing } from "@/backend/integrations/message-dispatch-trigger";
import { buildFinishingMessage, buildReadyMessage, buildWashStartMessage } from "@/backend/integrations/whatsapp-templates";
import { getLatestAttendanceMediaByKind } from "@/backend/repos/attendance-media-repo";
import { getAttendanceDetailById } from "@/backend/repos/attendances-details-repo";
import { hasQueuedOrSentMessageForAttendanceStage, enqueueMessageDispatch } from "@/backend/repos/message-dispatch-queue-repo";
import { listOperationBoxesByTenant, moveAttendanceToBoxForTenant } from "@/backend/repos/operation-boxes-repo";
import { getTenantSettings } from "@/backend/repos/tenant-settings-repo";
import { getTrackingUrl } from "@/backend/shared/app-url";
import { resolveAttendanceServiceDisplayName } from "@/backend/shared/attendance-service-summary";
import { isTenantMessageStageEnabled } from "@/backend/shared/tenant-whatsapp-messages";
import { formatVehicleDisplayLabel } from "@/backend/shared/vehicle-catalog";

export async function moveAttendanceToBoxUseCase(formData: FormData) {
  const context = await requireOperator();
  const attendanceId = String(formData.get("attendance_id") ?? "").trim();
  const boxId = String(formData.get("box_id") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!attendanceId || !boxId) {
    redirect("/operador/dashboard?error=Movimentacao invalida.");
  }

  const settings = await getTenantSettings(context.tenantId);
  if (settings?.operator_can_edit_status === false) {
    redirect("/operador/dashboard?error=Seu perfil nao pode mover servicos no fluxo.");
  }

  const error = await moveAttendanceToBoxForTenant({
    attendanceId,
    boxId,
    note,
  });

  if (error) {
    redirect(`/operador/dashboard?error=${encodeURIComponent(error.message)}`);
  }

  const [detail, boxes] = await Promise.all([
    getAttendanceDetailById(attendanceId),
    listOperationBoxesByTenant(context.tenantId),
  ]);

  const destinationBox = boxes.find((item) => item.id === boxId) ?? null;
  if (!detail || !destinationBox || !detail.customers?.whatsapp) {
    return;
  }

  const messageInput = {
    tenantName: context.tenant.name,
    customerName: detail.customers.name,
    vehicleModel: context.tenant.operational_profile === "automotive" ? formatVehicleDisplayLabel(detail.vehicles ?? {}) : "",
    vehiclePlate: context.tenant.operational_profile === "automotive" ? detail.vehicles?.plate ?? "-" : "",
    serviceName: resolveAttendanceServiceDisplayName(detail),
    etaMinutes: detail.estimated_minutes ?? 0,
    trackingUrl: getTrackingUrl(detail.public_code),
    operationalProfile: context.tenant.operational_profile,
  };

  if (destinationBox.kind === "wash" && isTenantMessageStageEnabled(settings, "washing")) {
    const alreadyQueued = await hasQueuedOrSentMessageForAttendanceStage({ attendanceId, stage: "washing" });
    if (!alreadyQueued) {
      const dispatch = await enqueueMessageDispatch({
        tenantId: context.tenantId,
        attendanceId,
        customerId: detail.customer_id,
        stage: "washing",
        whatsapp: detail.customers.whatsapp,
        text: buildWashStartMessage(settings, messageInput),
      });
      if (!dispatch.error) {
        void triggerMessageDispatchProcessing();
      }
    }
    return;
  }

  if ((destinationBox.kind === "dry" || destinationBox.kind === "finish") && isTenantMessageStageEnabled(settings, "finishing")) {
    const alreadyQueued = await hasQueuedOrSentMessageForAttendanceStage({ attendanceId, stage: "finishing" });
    if (!alreadyQueued) {
      const dispatch = await enqueueMessageDispatch({
        tenantId: context.tenantId,
        attendanceId,
        customerId: detail.customer_id,
        stage: "finishing",
        whatsapp: detail.customers.whatsapp,
        text: buildFinishingMessage(settings, messageInput),
      });
      if (!dispatch.error) {
        void triggerMessageDispatchProcessing();
      }
    }
    return;
  }

  if (destinationBox.kind === "ready" && isTenantMessageStageEnabled(settings, "ready")) {
    const alreadyQueued = await hasQueuedOrSentMessageForAttendanceStage({ attendanceId, stage: "ready" });
    if (!alreadyQueued) {
      const readyMedia = await getLatestAttendanceMediaByKind(attendanceId, "ready");
      const dispatch = await enqueueMessageDispatch({
        tenantId: context.tenantId,
        attendanceId,
        customerId: detail.customer_id,
        stage: "ready",
        whatsapp: detail.customers.whatsapp,
        text: buildReadyMessage(settings, messageInput),
        mediaUrl: readyMedia?.signed_url ?? null,
        mediaMimeType: readyMedia?.mime_type ?? null,
        mediaFileName: readyMedia?.file_path?.split("/").pop() ?? null,
      });
      if (!dispatch.error) {
        void triggerMessageDispatchProcessing();
      }
    }
  }
}
