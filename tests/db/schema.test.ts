import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { setupTestDb, type TestDb } from "../helpers/db";
import { documents, projects, actions, scheduleVersions } from "@/lib/db/schema";

let t: TestDb;
beforeAll(async () => {
  t = await setupTestDb();
});
afterAll(async () => {
  await t?.cleanup();
});

const doc = (id: string, markdown: string | null = null) => ({
  driveFileId: id,
  name: `${id}.pdf`,
  mimeType: "application/pdf",
  folderPath: "Tidplaner",
  driveModifiedTime: new Date("2026-10-01T10:00:00Z"),
  docType: "schedule" as const,
  convertStatus: "ok" as const,
  markdown,
  lastSyncedAt: new Date(),
});

describe("schema", () => {
  it("driveFileId is unique", async () => {
    await t.db.insert(documents).values(doc("f-unique"));
    await expect(t.db.insert(documents).values(doc("f-unique"))).rejects.toThrow();
  });

  it("actions.sourceKey is unique when set and nullable for manual actions", async () => {
    const [p] = await t.db.insert(projects).values({ code: "XX01", name: "Test" }).returning();
    const base = { projectId: p.id, title: "Ring", status: "oppen" as const, source: "manuell" as const };
    await t.db.insert(actions).values(base);
    await t.db.insert(actions).values(base);
    await t.db.insert(actions).values({ ...base, source: "tidplan", sourceKey: "tidplan:XX01:A1" });
    await expect(
      t.db.insert(actions).values({ ...base, source: "tidplan", sourceKey: "tidplan:XX01:A1" }),
    ).rejects.toThrow();
  });

  it("schedule version unique on project+dataDate+contentHash", async () => {
    const [p] = await t.db.insert(projects).values({ code: "XX02", name: "Test" }).returning();
    const [d] = await t.db.insert(documents).values(doc("f-ver")).returning();
    const v = {
      projectId: p.id,
      documentId: d.id,
      sourceFormat: "p6_pdf" as const,
      dataDate: "2026-10-01",
      contentHash: "abc",
    };
    await t.db.insert(scheduleVersions).values(v);
    await expect(t.db.insert(scheduleVersions).values(v)).rejects.toThrow();
  });

  it("search_vector matches Swedish stem", async () => {
    await t.db.insert(documents).values(doc("f-search", "Milstolparna försenades kraftigt"));
    const rows = await t.db.execute<{ hit: boolean }>(
      sql`select search_vector @@ plainto_tsquery('swedish', 'milstolpe') as hit from documents where drive_file_id = 'f-search'`,
    );
    expect(rows[0].hit).toBe(true);
  });
});
