import "server-only";

type EvolutionAdminConfig = {
  baseUrl: string;
  masterApiKey: string;
};

const EVOLUTION_TIMEOUT_MS = 45000;

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

async function readEvolutionResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return { text: "", json: null as Record<string, unknown> | null };
  }

  try {
    return { text, json: JSON.parse(text) as Record<string, unknown> };
  } catch {
    return { text, json: null as Record<string, unknown> | null };
  }
}

async function evolutionAdminRequest(input: {
  config: EvolutionAdminConfig;
  path: string;
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EVOLUTION_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${normalizeBaseUrl(input.config.baseUrl)}${input.path}`, {
      method: input.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        apikey: input.config.masterApiKey,
      },
      body: input.body ? JSON.stringify(input.body) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("A Evolution demorou demais para responder.");
    }

    throw error;
  }
  clearTimeout(timeout);

  const payload = await readEvolutionResponse(response);
  return { response, ...payload };
}

function messageContainsAlreadyExists(text: string, json: Record<string, unknown> | null) {
  const joinedJson = json ? JSON.stringify(json).toLowerCase() : "";
  const source = `${text.toLowerCase()} ${joinedJson}`;
  return source.includes("already exists") || source.includes("already in use") || source.includes("já existe");
}

export async function provisionEvolutionInstance(input: {
  config: EvolutionAdminConfig;
  instanceName: string;
  instanceToken: string;
  number?: string | null;
}) {
  let response: Response;
  let text: string;
  let json: Record<string, unknown> | null;
  try {
    ({ response, text, json } = await evolutionAdminRequest({
      config: input.config,
      path: "/instance/create",
      method: "POST",
      body: {
        instanceName: input.instanceName,
        token: input.instanceToken,
        qrcode: false,
        integration: "WHATSAPP-BAILEYS",
        ...(input.number ? { number: input.number } : {}),
      },
    }));
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Falha ao falar com a Evolution." };
  }

  if (response.ok) {
    return { ok: true, message: "Instância provisionada.", data: json };
  }

  if (messageContainsAlreadyExists(text, json)) {
    return { ok: true, message: "Instância já existia.", data: json };
  }

  return { ok: false, message: text || `Falha HTTP ${response.status}` };
}

export async function getEvolutionConnectionState(input: {
  config: EvolutionAdminConfig;
  instanceName: string;
}) {
  let response: Response;
  let text: string;
  let json: Record<string, unknown> | null;
  try {
    ({ response, text, json } = await evolutionAdminRequest({
      config: input.config,
      path: `/instance/connectionState/${encodeURIComponent(input.instanceName)}`,
    }));
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Falha ao consultar a Evolution." };
  }

  if (!response.ok) {
    return { ok: false, message: text || `Falha HTTP ${response.status}` };
  }

  const state = typeof json?.instance === "object" && json?.instance && typeof (json.instance as { state?: unknown }).state === "string"
    ? String((json.instance as { state: string }).state)
    : "unknown";

  return { ok: true, state, data: json };
}

export async function requestEvolutionConnectionCode(input: {
  config: EvolutionAdminConfig;
  instanceName: string;
  number?: string | null;
}) {
  const query = input.number ? `?number=${encodeURIComponent(input.number)}` : "";
  let response: Response;
  let text: string;
  let json: Record<string, unknown> | null;
  try {
    ({ response, text, json } = await evolutionAdminRequest({
      config: input.config,
      path: `/instance/connect/${encodeURIComponent(input.instanceName)}${query}`,
    }));
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Falha ao pedir o pareamento." };
  }

  if (!response.ok) {
    return { ok: false, message: text || `Falha HTTP ${response.status}` };
  }

  return {
    ok: true,
    pairingCode: typeof json?.pairingCode === "string" ? json.pairingCode : null,
    qrCode: typeof json?.base64 === "string" ? json.base64 : typeof json?.code === "string" ? json.code : null,
    data: json,
  };
}
