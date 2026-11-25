import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSessionToken, verifySessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import { middleware } from "@/middleware";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-that-is-long-enough-123456";
});
afterEach(() => {
  vi.useRealTimers();
});

describe("password", () => {
  it("hash contains no $ so .env loaders cannot mangle it", async () => {
    const hash = await hashPassword("hemligt");
    expect(hash).toMatch(/^scrypt:[0-9a-f]+:[0-9a-f]+$/);
  });

  it("verifyPassword rejects malformed hash", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "$2a$04$garbage")).toBe(false);
  });

  it("verifyPassword accepts correct and rejects wrong", async () => {
    const hash = await hashPassword("hemligt");
    expect(await verifyPassword("hemligt", hash)).toBe(true);
    expect(await verifyPassword("fel", hash)).toBe(false);
  });
});

describe("session", () => {
  it("session token round-trips", async () => {
    const token = await createSessionToken();
    expect(await verifySessionToken(token)).toBe(true);
  });

  it("tampered token is rejected", async () => {
    const token = await createSessionToken();
    const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
    expect(await verifySessionToken(tampered)).toBe(false);
  });

  it("expired token is rejected", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = await createSessionToken();
    vi.setSystemTime(new Date("2026-02-15T00:00:00Z"));
    expect(await verifySessionToken(token)).toBe(false);
  });
});

describe("middleware", () => {
  it("unauthenticated GET / redirects to /login", async () => {
    const res = await middleware(new NextRequest("http://localhost:3000/"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("GET /api/health passes", async () => {
    const res = await middleware(new NextRequest("http://localhost:3000/api/health"));
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("valid session cookie passes", async () => {
    const token = await createSessionToken();
    const req = new NextRequest("http://localhost:3000/tidplan", {
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
    });
    const res = await middleware(req);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});
