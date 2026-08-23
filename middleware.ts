import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const BASE_PATH = "/verifica";

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  const path = request.nextUrl.pathname;
  const appPath = path.startsWith(BASE_PATH) ? path.slice(BASE_PATH.length) || "/" : path;
  const protectedPath =
    appPath.startsWith("/app") || appPath.startsWith("/operador") || appPath.startsWith("/setup") || appPath.startsWith("/admin");

  const hasSessionCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.endsWith("-auth-token"));

  if (protectedPath && !hasSessionCookie) {
    return NextResponse.redirect(new URL(`${BASE_PATH}/login`, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
