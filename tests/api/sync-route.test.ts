import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { setupTestDb, type TestDb } from "../helpers/db";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";

let t: TestDb;
let POST: (req: NextRequest) => Promise<Response>;

beforeAll(async () => {
  t = await setupTestDb();
  process.env.DATABASE_URL = t.url;
  process.env.DRIVE_CLIENT = "fake";
  process.env.DRIVE_FAKE_DIR = "tests/fixtures/out";
  process.env.SYNC_TOKEN = "test-sync-token-123";
  process.env.SESSION_SECRET = "test-secret-that-is-long-enough-123456";
  ({ POST } = await import("@/app/api/sync/route"));
});
afterAll(async () => {
  const { closeDb } = await import("@/lib/db/client");
  await closeDb();
  await t.cleanup();
});

const req = (headers: Record<string, string> = {}) =>
  new NextRequest("http://localhost:3000/api/sync", { method: "POST", headers });

describe("POST /api/sync", () => {
  it("sync route rejects without auth", async () => {
    expect((await POST(req())).status).toBe(401);
    expect((await POST(req({ authorization: "Bearer fel" }))).status).toBe(401);
  });

  it("sync route accepts bearer token", async () => {
    const res = await POST(req({ authorization: "Bearer test-sync-token-123" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scanned).toBeGreaterThan(0);
    expect(body.newScheduleVersions).toBe(1);
  });

  it("sync route accepts session cookie", async () => {
    const token = await createSessionToken();
    const res = await POST(req({ cookie: `${SESSION_COOKIE}=${token}` }));
    expect(res.status).toBe(200);
    expect((await res.json()).changed).toBe(0);
  });
});
