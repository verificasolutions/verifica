import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        message: "Unauthorized",
      },
      { status: 401 },
    );
  }

  return NextResponse.json({
    ok: true,
    projectUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    checkedAt: new Date().toISOString(),
  });
}
