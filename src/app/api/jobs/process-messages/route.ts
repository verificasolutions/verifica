import { NextRequest, NextResponse } from "next/server";
import { resolveAccessContext } from "@/backend/auth/access-context";
import { sendAttendanceMessage } from "@/backend/integrations/send-attendance-message";
import {
  claimMessageDispatchBatch,
  markMessageDispatchResult,
} from "@/backend/repos/message-dispatch-queue-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function unauthorized() {
  return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
}

async function isAuthorizedRequest(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }

  const context = await resolveAccessContext();
  return context.kind === "platform_admin" || context.kind === "tenant_user";
}

async function processQueue() {
  const batch = await claimMessageDispatchBatch(10);
  if (batch.error) {
    return NextResponse.json({ ok: false, message: batch.error.message }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const item of batch.data) {
    const result = await sendAttendanceMessage({
      tenantId: item.tenant_id,
      whatsapp: item.whatsapp,
      text: item.text,
      mediaUrl: item.media_url,
      mediaMimeType: item.media_mime_type,
      mediaFileName: item.media_file_name,
    });

    const saveError = await markMessageDispatchResult({
      id: item.id,
      attempts: item.attempts,
      ok: result.ok,
      errorMessage: result.message,
    });

    if (saveError) {
      failed += 1;
      continue;
    }

    if (result.ok) {
      sent += 1;
    } else {
      failed += 1;
      console.error("Falha ao processar item da fila de mensagens", {
        queueId: item.id,
        tenantId: item.tenant_id,
        stage: item.stage,
        whatsapp: item.whatsapp,
        reason: result.message,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: batch.data.length,
    sent,
    failed,
    checkedAt: new Date().toISOString(),
  });
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorizedRequest(request))) {
    return unauthorized();
  }

  return processQueue();
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorizedRequest(request))) {
    return unauthorized();
  }

  return processQueue();
}
