import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { sql } from "drizzle-orm";
import { setupTestDb, type TestDb } from "../helpers/db";

describe("database harness", () => {
  let t: TestDb;
  beforeAll(async () => {
    t = await setupTestDb();
  });
  afterAll(async () => {
    await t?.cleanup();
  });

  it("connects and runs migrations", async () => {
    const rows = await t.db.execute<{ one: number }>(sql`select 1 as one`);
    expect(Number(rows[0].one)).toBe(1);
  });
});
