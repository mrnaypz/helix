import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cookieUnlocks, pinEnabled, pinToken, unlockCookie, UNLOCK_COOKIE } from "@/lib/auth/pin";

export const runtime = "nodejs";

export async function GET() {
  const jar = await cookies();
  return NextResponse.json({
    required: pinEnabled(),
    unlocked: await cookieUnlocks(jar.get(UNLOCK_COOKIE)?.value),
  });
}

export async function POST(request: Request) {
  if (!pinEnabled()) {
    return NextResponse.json({ ok: true, required: false });
  }
  const body = (await request.json().catch(() => ({}))) as { pin?: string };
  const pin = String(body.pin ?? "");
  if (!pin || (await pinToken(pin)) !== (await pinToken())) {
    return NextResponse.json({ error: "Wrong PIN." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  const cookie = unlockCookie(await pinToken());
  res.cookies.set(cookie);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: UNLOCK_COOKIE, value: "", path: "/", maxAge: 0 });
  return res;
}
