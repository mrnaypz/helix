const COOKIE = "helix_unlock";

export function pinEnabled(): boolean {
  return Boolean(process.env.HELIX_PIN?.trim());
}

export async function pinToken(pin = process.env.HELIX_PIN?.trim() ?? ""): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`helix:${pin}`));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function cookieUnlocks(value: string | undefined): Promise<boolean> {
  if (!pinEnabled()) return true;
  if (!value) return false;
  return value === (await pinToken());
}

export function unlockCookie(token: string) {
  return {
    name: COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

export { COOKIE as UNLOCK_COOKIE };
