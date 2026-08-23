import "server-only";
import { getTenantSettingsAdmin } from "@/backend/repos/tenant-settings-repo";
import { normalizeWhatsappForEvolution } from "@/backend/shared/input-normalizers";

const EVOLUTION_TIMEOUT_MS = 20000;

export async function sendEvolutionTextMessage(input: {
  tenantId: string;
  number: string;
  text: string;
}) {
  const settings = await getTenantSettingsAdmin(input.tenantId);
  if (!settings?.evolution_enabled || !settings.evolution_base_url || !settings.evolution_instance || !settings.evolution_api_key) {
    return { ok: false, message: "Evolution API não configurada." };
  }

  const baseUrl = settings.evolution_base_url.replace(/\/+$/, "");
  const number = normalizeWhatsappForEvolution(input.number);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/message/sendText/${settings.evolution_instance}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: settings.evolution_api_key,
      },
      body: JSON.stringify({
        number,
        text: input.text,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(EVOLUTION_TIMEOUT_MS),
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Tempo excedido ao chamar Evolution.",
    };
  }

  if (!response.ok) {
    const body = await response.text();
    return { ok: false, message: body || `Falha HTTP ${response.status}` };
  }

  return { ok: true, message: "Mensagem enviada." };
}

export async function sendEvolutionMediaMessage(input: {
  tenantId: string;
  number: string;
  mediaUrl: string;
  mimeType: string;
  fileName: string;
  caption: string;
}) {
  const settings = await getTenantSettingsAdmin(input.tenantId);
  if (!settings?.evolution_enabled || !settings.evolution_base_url || !settings.evolution_instance || !settings.evolution_api_key) {
    return { ok: false, message: "Evolution API não configurada." };
  }

  const baseUrl = settings.evolution_base_url.replace(/\/+$/, "");
  const number = normalizeWhatsappForEvolution(input.number);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/message/sendMedia/${settings.evolution_instance}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: settings.evolution_api_key,
      },
      body: JSON.stringify({
        number,
        mediatype: "image",
        mimetype: input.mimeType,
        caption: input.caption,
        media: input.mediaUrl,
        fileName: input.fileName,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(EVOLUTION_TIMEOUT_MS),
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Tempo excedido ao chamar Evolution.",
    };
  }

  if (!response.ok) {
    const body = await response.text();
    return { ok: false, message: body || `Falha HTTP ${response.status}` };
  }

  return { ok: true, message: "Mídia enviada." };
}
