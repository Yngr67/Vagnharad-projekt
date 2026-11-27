import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "ps_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET saknas eller är kortare än 32 tecken");
  return new TextEncoder().encode(s);
}

export async function createSessionToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_MAX_AGE_SECONDS)
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, secret(), {
      algorithms: ["HS256"],
      currentDate: new Date(),
    });
    return true;
  } catch {
    return false;
  }
}
