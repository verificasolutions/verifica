import { NextRequest, NextResponse } from "next/server";
import { resolveAccessContext } from "@/backend/auth/access-context";
import { processLeadEmailSequencesUseCase } from "@/backend/use-cases/admin/process-lead-email-sequences";

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
  return context.kind === "platform_admin";
}

async function processQueue() {
  const result = await processLeadEmailSequencesUseCase();
  return NextResponse.json({
    ok: true,
    ...result,
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
