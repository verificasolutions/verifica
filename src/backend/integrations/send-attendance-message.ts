import "server-only";
import { sendEvolutionMediaMessage, sendEvolutionTextMessage } from "@/backend/integrations/evolution";

export async function sendAttendanceMessage(input: {
  tenantId: string;
  whatsapp: string | null;
  text: string;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  mediaFileName?: string | null;
}) {
  if (!input.whatsapp?.trim() || !input.text.trim()) {
    return { ok: false, message: "WhatsApp ou texto ausente." };
  }

  try {
    if (input.mediaUrl?.trim() && input.mediaMimeType?.trim()) {
      const mediaResult = await sendEvolutionMediaMessage({
        tenantId: input.tenantId,
        number: input.whatsapp.trim(),
        mediaUrl: input.mediaUrl.trim(),
        mimeType: input.mediaMimeType.trim(),
        fileName: input.mediaFileName?.trim() || "carro-pronto",
        caption: input.text.trim(),
      });

      if (mediaResult.ok) {
        return mediaResult;
      }
    }

    return await sendEvolutionTextMessage({
      tenantId: input.tenantId,
      number: input.whatsapp.trim(),
      text: input.text.trim(),
    });
  } catch (error) {
    console.error("Falha ao disparar mensagem do atendimento", {
      tenantId: input.tenantId,
      whatsapp: input.whatsapp,
      error,
    });
    return { ok: false, message: "Falha inesperada ao disparar mensagem." };
  }
}
