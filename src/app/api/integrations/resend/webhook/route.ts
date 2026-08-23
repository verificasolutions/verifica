import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getOptionalResendApiKey } from "@/lib/env";
import { getPlatformSettingsAdmin } from "@/backend/repos/admin-control-repo";
import {
  findLeadEmailDispatchByProviderIdAdmin,
  saveLeadCompanyActivityAdmin,
  updateLeadCompanyStatusAdmin,
  updateLeadEmailDispatchByProviderIdAdmin,
} from "@/backend/repos/lead-hunter-repo";

type ResendWebhookEvent = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    subject?: string;
    to?: string[];
    bounce?: {
      message?: string;
      type?: string;
      subType?: string;
    };
  };
};

function mapEventTypeToStatus(type: string) {
  switch (type) {
    case "email.delivered":
      return "delivered" as const;
    case "email.delivery_delayed":
      return "delivery_delayed" as const;
    case "email.bounced":
      return "bounced" as const;
    case "email.complained":
      return "complained" as const;
    case "email.opened":
      return "opened" as const;
    case "email.clicked":
      return "clicked" as const;
    case "email.failed":
      return "failed" as const;
    case "email.suppressed":
      return "suppressed" as const;
    case "email.received":
      return "received" as const;
    default:
      return "sent" as const;
  }
}

function labelForActivity(type: string) {
  switch (type) {
    case "email.delivered":
      return "email_delivered";
    case "email.delivery_delayed":
      return "email_delivery_delayed";
    case "email.bounced":
      return "email_bounced";
    case "email.complained":
      return "email_complained";
    case "email.opened":
      return "email_opened";
    case "email.clicked":
      return "email_clicked";
    case "email.failed":
      return "email_failed";
    case "email.suppressed":
      return "email_suppressed";
    case "email.received":
      return "email_received";
    default:
      return "email_provider_event";
  }
}

function buildActivityNote(event: ResendWebhookEvent) {
  const recipient = event.data?.to?.[0] ?? "destinatario nao informado";
  const subject = event.data?.subject ?? "sem assunto";

  switch (event.type) {
    case "email.delivered":
      return `Resend confirmou entrega para ${recipient}. Assunto: ${subject}.`;
    case "email.delivery_delayed":
      return `Resend informou atraso na entrega para ${recipient}. Assunto: ${subject}.`;
    case "email.bounced":
      return `Resend informou bounce para ${recipient}. Motivo: ${event.data?.bounce?.message ?? "nao informado"}.`;
    case "email.complained":
      return `Resend informou reclamacao de spam para ${recipient}.`;
    case "email.opened":
      return `Resend informou abertura do e-mail por ${recipient}.`;
    case "email.clicked":
      return `Resend informou clique no e-mail por ${recipient}.`;
    case "email.failed":
      return `Resend informou falha no envio para ${recipient}.`;
    case "email.suppressed":
      return `Resend suprimiu o envio para ${recipient}.`;
    case "email.received":
      return `Resend registrou e-mail recebido relacionado a ${recipient}.`;
    default:
      return `Resend registrou o evento ${event.type ?? "desconhecido"} para ${recipient}.`;
  }
}

export async function POST(request: NextRequest) {
  const apiKey = getOptionalResendApiKey();
  const settings = await getPlatformSettingsAdmin();
  const webhookSecret = settings?.resend_webhook_secret?.trim();

  if (!apiKey || !webhookSecret) {
    return NextResponse.json({ error: "Webhook do Resend nao configurado." }, { status: 500 });
  }

  const payload = await request.text();
  const resend = new Resend(apiKey);

  let event: ResendWebhookEvent;

  try {
    event = resend.webhooks.verify({
      payload,
      headers: {
        id: request.headers.get("svix-id") ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      },
      webhookSecret,
    }) as ResendWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Assinatura invalida." }, { status: 400 });
  }

  const providerEmailId = event.data?.email_id?.trim();
  if (!providerEmailId || !event.type) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const dispatch = await findLeadEmailDispatchByProviderIdAdmin(providerEmailId);
  if (!dispatch) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const isDuplicate = dispatch.raw_events.some((item) => item.type === event.type && item.created_at === event.created_at);
  if (isDuplicate) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const status = mapEventTypeToStatus(event.type);
  const lastError = event.type === "email.bounced"
    ? event.data?.bounce?.message ?? null
    : event.type === "email.failed" || event.type === "email.suppressed"
      ? buildActivityNote(event)
      : null;

  await updateLeadEmailDispatchByProviderIdAdmin({
    providerEmailId,
    status,
    lastEvent: event.type,
    lastError,
    rawEvent: event as Record<string, unknown>,
  });

  await saveLeadCompanyActivityAdmin({
    leadCompanyId: dispatch.lead_company_id,
    activityType: labelForActivity(event.type),
    channel: "email",
    note: buildActivityNote(event),
    createdByEmail: "resend-webhook",
  });

  if (event.type === "email.received") {
    await updateLeadCompanyStatusAdmin(dispatch.lead_company_id, "responded");
  }

  revalidatePath("/admin");
  return NextResponse.json({ ok: true });
}
