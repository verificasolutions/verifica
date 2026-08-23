import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const confirmationCode = url.searchParams.get("code")?.trim() ?? "";

  return NextResponse.json({
    status: "completed",
    confirmation_code: confirmationCode || null,
    message: "Os dados vinculados ao Instagram foram removidos ou desativados para esta solicitação.",
  });
}
