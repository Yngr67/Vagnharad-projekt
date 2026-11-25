import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./session";

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Inloggad via cookie, eller anrop med "Authorization: Bearer <SYNC_TOKEN>". */
export async function isAuthorized(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token && (await verifySessionToken(token))) return true;
  const expected = process.env.SYNC_TOKEN;
  const header = req.headers.get("authorization") ?? "";
  const m = /^Bearer (.+)$/.exec(header);
  return Boolean(expected && expected.length >= 16 && m && safeEqual(m[1], expected));
}
