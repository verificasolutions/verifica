import "server-only";
import { getOptionalResendApiKey } from "@/lib/env";
import { getAppUrl } from "@/backend/shared/app-url";
import { getPlatformSettingsAdmin, patchPlatformSettingsAdmin } from "@/backend/repos/admin-control-repo";
import type { LeadCompanyRecord } from "@/backend/types";

type ResendEmailRequest = {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
  reply_to?: string;
  tags: Array<{ name: string; value: string }>;
};

type ResendBatchResponse = {
  data?: Array<{ id?: string }>;
  error?: { message?: string };
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildHtml(body: string, imageUrl?: string | null) {
  const paragraphs = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p style="margin:0 0 14px;line-height:1.65;color:#d7dee7;font-size:14px;">${escapeHtml(line)}</p>`)
    .join("");

  const imageBlock = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="Painel Verifica" style="display:block;width:100%;max-width:100%;height:auto;border-radius:18px;margin:0 0 22px;border:1px solid rgba(255,255,255,0.08);" />`
    : "";

  return `
    <div style="background:#0d1117;padding:32px;font-family:Arial,sans-serif;">
      <div style="max-width:640px;margin:0 auto;background:#141c24;border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:28px;">
        ${imageBlock}
        ${paragraphs}
      </div>
    </div>
  `;
}

function ensureApiKey() {
  const apiKey = getOptionalResendApiKey();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY nao configurada no ambiente.");
  }

  return apiKey;
}

async function getSendingConfig() {
  const settings = await getPlatformSettingsAdmin();
  return {
    settings,
    from: settings?.resend_from_email?.trim() || "Verifica Solutions <marketing.verifica@verificasolutions.com.br>",
    replyTo: settings?.resend_reply_to_email?.trim() || "marketing.verifica@verificasolutions.com.br",
  };
}

type LeadEmailContent = {
  subject: string;
  body: string;
  imageUrl?: string | null;
};

type PasswordRecoveryEmailInput = {
  to: string;
  recoveryUrl: string;
};

function buildRequestForLead(input: {
  lead: LeadCompanyRecord;
  content: LeadEmailContent;
  from: string;
  replyTo?: string;
}) {
  if (!input.lead.email?.trim()) {
    throw new Error("Lead sem e-mail valido.");
  }

  const subject = input.content.subject.trim() || `Ideia rapida para ${input.lead.business_name}`;

  return {
    subject,
    request: {
      from: input.from,
      to: [input.lead.email.trim().toLowerCase()],
      subject,
      text: input.content.body,
      html: buildHtml(input.content.body, input.content.imageUrl),
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      tags: [
        { name: "source", value: "lead_hunter" },
        { name: "lead_id", value: input.lead.id.replaceAll("-", "") },
      ],
    } satisfies ResendEmailRequest,
  };
}

async function resendRequest(path: string, init: RequestInit) {
  const apiKey = ensureApiKey();
  const response = await fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  return response;
}

function normalizeWebhookEvents() {
  return [
    "email.sent",
    "email.delivered",
    "email.delivery_delayed",
    "email.bounced",
    "email.complained",
    "email.opened",
    "email.clicked",
    "email.failed",
    "email.suppressed",
  ];
}

export async function ensureLeadResendWebhookConfigured() {
  ensureApiKey();

  const endpoint = `${getAppUrl()}/api/integrations/resend/webhook`;
  const settings = await getPlatformSettingsAdmin();
  const events = normalizeWebhookEvents();

  const listResponse = await resendRequest("/webhooks", { method: "GET" });
  if (!listResponse.ok) {
    const errorText = await listResponse.text();
    throw new Error(`Falha ao listar webhooks do Resend (${listResponse.status}): ${errorText}`);
  }

  const listPayload = (await listResponse.json()) as {
    data?: Array<{ id?: string; endpoint?: string; signing_secret?: string; events?: string[] }>;
  };

  const existing = (listPayload.data ?? []).find((item) => item.endpoint === endpoint);

  if (existing?.id) {
    const needsPatch = JSON.stringify([...(existing.events ?? [])].sort()) !== JSON.stringify([...events].sort());

    if (needsPatch) {
      const patchResponse = await resendRequest(`/webhooks/${existing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          endpoint,
          events,
          status: "enabled",
        }),
      });

      if (!patchResponse.ok) {
        const errorText = await patchResponse.text();
        throw new Error(`Falha ao atualizar webhook do Resend (${patchResponse.status}): ${errorText}`);
      }
    }

    if (settings?.resend_webhook_id !== existing.id || settings?.resend_webhook_secret !== (existing.signing_secret ?? null)) {
      await patchPlatformSettingsAdmin({
        resend_webhook_id: existing.id,
        resend_webhook_secret: existing.signing_secret ?? null,
      });
    }

    return {
      id: existing.id,
      signingSecret: existing.signing_secret ?? null,
      endpoint,
    };
  }

  const createResponse = await resendRequest("/webhooks", {
    method: "POST",
    body: JSON.stringify({
      endpoint,
      events,
    }),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Falha ao criar webhook do Resend (${createResponse.status}): ${errorText}`);
  }

  const createPayload = (await createResponse.json()) as { id?: string; signing_secret?: string };
  if (!createPayload.id) {
    throw new Error("Resend nao retornou o id do webhook.");
  }

  await patchPlatformSettingsAdmin({
    resend_webhook_id: createPayload.id,
    resend_webhook_secret: createPayload.signing_secret ?? null,
  });

  return {
    id: createPayload.id,
    signingSecret: createPayload.signing_secret ?? null,
    endpoint,
  };
}

export async function sendLeadEmailWithResend(input: {
  lead: LeadCompanyRecord;
  content: LeadEmailContent;
  idempotencyKey?: string;
}) {
  const { from, replyTo } = await getSendingConfig();
  const built = buildRequestForLead({
    lead: input.lead,
    content: input.content,
    from,
    replyTo,
  });

  const response = await resendRequest("/emails", {
    method: "POST",
    headers: input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : undefined,
    body: JSON.stringify(built.request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao enviar e-mail pelo Resend (${response.status}): ${errorText}`);
  }

  return {
    subject: built.subject,
    ...(await response.json() as { id?: string }),
  };
}

export async function sendLeadEmailBatchWithResend(input: {
  items: Array<{
    lead: LeadCompanyRecord;
    content: LeadEmailContent;
  }>;
  idempotencyKey?: string;
}) {
  const { from, replyTo } = await getSendingConfig();
  const prepared = input.items.map((item) => ({
    ...item,
    ...buildRequestForLead({
      lead: item.lead,
      content: item.content,
      from,
      replyTo,
    }),
  }));

  const response = await resendRequest("/emails/batch", {
    method: "POST",
    headers: input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : undefined,
    body: JSON.stringify(prepared.map((item) => item.request)),
  });

  const payload = (await response.json()) as ResendBatchResponse;

  if (!response.ok || payload.error?.message) {
    throw new Error(payload.error?.message || `Falha ao enviar lote pelo Resend (${response.status}).`);
  }

  const ids = payload.data ?? [];
  if (ids.length !== prepared.length) {
    throw new Error("O Resend retornou um lote incompleto.");
  }

  return prepared.map((item, index) => ({
    lead: item.lead,
    subject: item.subject,
    content: item.content,
    id: ids[index]?.id ?? null,
  }));
}

export async function sendPasswordRecoveryEmailWithResend(input: PasswordRecoveryEmailInput) {
  const email = input.to.trim().toLowerCase();
  if (!email) {
    throw new Error("E-mail invalido para recuperacao de senha.");
  }

  const { from, replyTo } = await getSendingConfig();
  const subject = "Verifica | Redefinir senha";
  const text = [
    "Recebemos um pedido para redefinir sua senha no Verifica.",
    "",
    `Abra este link para criar uma nova senha: ${input.recoveryUrl}`,
    "",
    "Se voce nao fez esse pedido, ignore esta mensagem.",
  ].join("\n");

  const html = `
    <div style="background:#0d1117;padding:32px;font-family:Arial,sans-serif;">
      <div style="max-width:640px;margin:0 auto;background:#141c24;border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:28px;">
        <p style="margin:0 0 10px;color:#7dd3fc;font-size:12px;letter-spacing:0.24em;text-transform:uppercase;">Verifica</p>
        <h1 style="margin:0 0 18px;color:#f8fafc;font-size:28px;line-height:1.2;">Redefinir senha</h1>
        <p style="margin:0 0 14px;line-height:1.65;color:#d7dee7;font-size:14px;">Recebemos um pedido para redefinir sua senha no Verifica.</p>
        <p style="margin:0 0 24px;line-height:1.65;color:#d7dee7;font-size:14px;">Clique no botao abaixo para criar uma nova senha.</p>
        <a href="${escapeHtml(input.recoveryUrl)}" style="display:inline-block;padding:14px 22px;border-radius:16px;background:#00f5d4;color:#041316;font-weight:700;font-size:14px;text-decoration:none;">Redefinir minha senha</a>
        <p style="margin:24px 0 0;line-height:1.65;color:#8b9aaa;font-size:13px;">Se voce nao fez esse pedido, ignore esta mensagem.</p>
      </div>
    </div>
  `;

  const response = await resendRequest("/emails", {
    method: "POST",
    body: JSON.stringify({
      from,
      to: [email],
      subject,
      text,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
      tags: [
        { name: "source", value: "auth_password_recovery" },
        { name: "channel", value: "login" },
      ],
    } satisfies ResendEmailRequest),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao enviar e-mail de recuperacao pelo Resend (${response.status}): ${errorText}`);
  }

  return await response.json() as { id?: string };
}
