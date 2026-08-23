import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAppUrl, withAppBasePath } from "@/backend/shared/app-url";
import { parseInstagramSignedRequest } from "@/backend/shared/instagram-auth";

type InstagramSignedRequestPayload = {
  user_id?: string;
};

async function readSignedRequest(request: Request) {
  const formData = await request.formData();
  return String(formData.get("signed_request") ?? "").trim();
}

export async function POST(request: Request) {
  try {
    const signedRequest = await readSignedRequest(request);
    if (!signedRequest) {
      return NextResponse.json({ error: "signed_request ausente." }, { status: 400 });
    }

    const payload = parseInstagramSignedRequest<InstagramSignedRequestPayload>(signedRequest);
    const instagramAccountId = payload.user_id?.trim();

    if (instagramAccountId) {
      const admin = createSupabaseAdminClient() as any;
      const { error } = await admin
        .from("tenant_instagram_accounts")
        .update({
          is_active: false,
          refresh_token: null,
          token_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("instagram_account_id", instagramAccountId);

      if (error) {
        throw new Error(error.message);
      }
    }

    const confirmationCode = randomUUID();
    const statusUrl = new URL(withAppBasePath("/api/integrations/instagram/data-deletion/status"), getAppUrl());
    statusUrl.searchParams.set("code", confirmationCode);

    return NextResponse.json({
      url: statusUrl.toString(),
      confirmation_code: confirmationCode,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao processar exclusão de dados.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
