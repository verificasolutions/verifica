import "server-only";
import { redirect } from "next/navigation";
import { requireOperator } from "@/backend/auth/guards";
import { listAttendanceMediaByAttendance, createAttendanceMediaRecord, ensureAttendanceMediaBucket, uploadAttendanceMediaFile } from "@/backend/repos/attendance-media-repo";
import { getAttendanceDetailById } from "@/backend/repos/attendances-details-repo";
import { getTenantSettings } from "@/backend/repos/tenant-settings-repo";

function extensionFromMime(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

export async function uploadAttendanceMediaUseCase(formData: FormData, options?: { requiredKind?: "ready" | "step" }) {
  const context = await requireOperator();
  const attendanceId = String(formData.get("attendance_id") ?? "").trim();
  const kind = String(formData.get("kind") ?? options?.requiredKind ?? "step").trim() as "step" | "ready";
  const caption = String(formData.get("caption") ?? "").trim() || null;
  const file = formData.get("photo");

  if (!attendanceId || !(file instanceof File) || file.size === 0) {
    redirect("/operador/dashboard?error=Selecione uma foto válida.");
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    redirect("/operador/dashboard?error=Formato de imagem inválido. Use JPG, PNG ou WebP.");
  }

  if (file.size > 8 * 1024 * 1024) {
    redirect("/operador/dashboard?error=A imagem ultrapassa 8 MB.");
  }

  const attendance = await getAttendanceDetailById(attendanceId);
  if (!attendance || attendance.tenant_id !== context.tenantId || attendance.employee_id == null) {
    redirect("/operador/dashboard?error=Atendimento inválido para upload.");
  }

  const settings = await getTenantSettings(context.tenantId);
  if (kind === "step" && settings?.allow_step_photos === false) {
    redirect("/operador/dashboard?error=O tenant não permite foto por etapa.");
  }

  const ensureError = await ensureAttendanceMediaBucket();
  if (ensureError) {
    redirect(`/operador/dashboard?error=${encodeURIComponent(ensureError.message)}`);
  }

  const extension = extensionFromMime(file.type);
  const bytes = Buffer.from(await file.arrayBuffer());
  const path = `tenant/${context.tenantId}/attendances/${attendanceId}/${kind}-${Date.now()}.${extension}`;

  const uploadError = await uploadAttendanceMediaFile({
    path,
    contentType: file.type,
    bytes,
  });

  if (uploadError) {
    redirect(`/operador/dashboard?error=${encodeURIComponent(uploadError.message)}`);
  }

  const recordError = await createAttendanceMediaRecord({
    tenantId: context.tenantId,
    attendanceId,
    boxId: attendance.current_box_id ?? null,
    kind,
    filePath: path,
    mimeType: file.type,
    caption,
  });

  if (recordError) {
    redirect(`/operador/dashboard?error=${encodeURIComponent(recordError.message)}`);
  }
}

export async function ensureReadyPhotoIfRequired(attendanceId: string) {
  const context = await requireOperator();
  const attendance = await getAttendanceDetailById(attendanceId);
  if (!attendance || attendance.tenant_id !== context.tenantId) {
    redirect("/operador/dashboard?error=Atendimento inválido para validação.");
  }

  const settings = await getTenantSettings(context.tenantId);
  if (!settings?.require_ready_photo) {
    return;
  }

  const media = await listAttendanceMediaByAttendance(attendanceId);
  if (!media.some((item) => item.kind === "ready")) {
    redirect("/operador/dashboard?error=É obrigatório enviar a foto final antes de marcar como pronto.");
  }
}
