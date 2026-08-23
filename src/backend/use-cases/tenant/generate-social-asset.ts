import "server-only";
import { redirect } from "next/navigation";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { createMarketingAssetForTenant } from "@/backend/repos/marketing-assets-repo";
import { listAttendanceMediaByAttendances } from "@/backend/repos/attendance-media-repo";
import { listQueueForTodayByTenant } from "@/backend/repos/attendances-operations-repo";

function buildSocialCopy(input: {
  tenantName: string;
  vehicleLabel: string;
  vehicleColor: string | null;
  serviceName: string;
  kind: "post" | "story" | "promo";
  mediaKind: "entry" | "step" | "ready" | "damage_note" | "marketing";
}) {
  const title =
    input.kind === "story"
      ? "Story pronto"
      : input.kind === "promo"
        ? "Chamada promocional"
        : "Post pronto para publicar";

  const vehicleLine = `${input.vehicleLabel}${input.vehicleColor ? ` ${input.vehicleColor}` : ""}`.trim();
  const stageLabel =
    input.mediaKind === "ready"
      ? "etapa final"
      : input.mediaKind === "entry"
        ? "entrada do atendimento"
        : input.mediaKind === "damage_note"
          ? "registro técnico"
          : input.mediaKind === "marketing"
            ? "mídia promocional"
            : "etapa em andamento";
  const generatedText =
    input.kind === "story"
      ? `Mais um serviço registrado por aqui. ${vehicleLine} passou por ${input.serviceName.toLowerCase()} e a ${input.tenantName} já capturou a ${stageLabel}.`
      : input.kind === "promo"
        ? `Quer mostrar seu serviço com mais presença? Hoje tivemos ${input.serviceName.toLowerCase()} em ${vehicleLine}. A ${input.tenantName} já registrou a ${stageLabel}.`
        : `Resultado do dia na ${input.tenantName}: ${vehicleLine} em ${input.serviceName.toLowerCase()}, com foto real da ${stageLabel} pronta para virar conteúdo.`;

  const cta =
    input.kind === "story"
      ? "Chame no WhatsApp e reserve seu horário."
      : "Fale com a equipe e peça seu orçamento.";

  const hashtags = ["#servico", "#atendimento", "#resultado", `#${input.tenantName.replace(/\s+/g, "")}`];

  return { title, generatedText, cta, hashtags };
}

export async function generateSocialAssetUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const attendanceId = String(formData.get("attendance_id") ?? "").trim();
  const mediaId = String(formData.get("media_id") ?? "").trim();
  const kind = String(formData.get("kind") ?? "post").trim() as "post" | "story" | "promo";

  if (!attendanceId || !["post", "story", "promo"].includes(kind)) {
    redirect("/app/dashboard?section=adm&panel=social&error=Selecione uma foto válida para gerar a peça.");
  }

  const queue = await listQueueForTodayByTenant(context.tenantId);
  const attendance = queue.find((item) => item.id === attendanceId);

  if (!attendance) {
    redirect("/app/dashboard?section=adm&panel=social&error=Atendimento não encontrado para gerar o conteúdo.");
  }

  const mediaByAttendance = await listAttendanceMediaByAttendances([attendanceId]);
  const media = mediaId
    ? (mediaByAttendance.get(attendanceId) ?? []).find((item) => item.id === mediaId) ?? null
    : (mediaByAttendance.get(attendanceId) ?? [])[0] ?? null;

  if (!media) {
    redirect("/app/dashboard?section=adm&panel=social&error=Esse atendimento ainda não tem foto registrada.");
  }

  const copy = buildSocialCopy({
    tenantName: context.tenant.name,
    vehicleLabel: attendance.vehicles?.model ?? "Atendimento",
    vehicleColor: attendance.vehicles?.color ?? null,
    serviceName: attendance.services?.name ?? "Serviço",
    kind,
    mediaKind: media.kind,
  });

  const error = await createMarketingAssetForTenant({
    tenantId: context.tenantId,
    attendanceId,
    mediaId: media.id,
    kind,
    title: copy.title,
    generatedText: copy.generatedText,
    cta: copy.cta,
    hashtags: copy.hashtags,
    promptSnapshot: {
      source: "verificwash-social-engine",
      vehicle: attendance.vehicles?.model ?? null,
      color: attendance.vehicles?.color ?? null,
      service: attendance.services?.name ?? null,
      media_kind: media.kind,
      kind,
    },
  });

  if (error) {
    redirect(`/app/dashboard?section=adm&panel=social&error=${encodeURIComponent(error.message)}`);
  }
}
