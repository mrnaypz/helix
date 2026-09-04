import { NextRequest, NextResponse } from "next/server";
import { cookieUnlocks, pinEnabled } from "@/lib/auth/pin";

export async function middleware(request: NextRequest) {
  if (!pinEnabled()) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/unlock") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/apple-icon") ||
    pathname.startsWith("/manifest")
  ) {
    return NextResponse.next();
  }

  const unlocked = await cookieUnlocks(request.cookies.get("helix_unlock")?.value);
  if (unlocked) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unlock this desk from your phone first." }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/unlock";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
