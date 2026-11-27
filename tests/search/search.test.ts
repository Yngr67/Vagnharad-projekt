import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestDb, type TestDb } from "../helpers/db";
import { seedDoc } from "../helpers/seed";
import { searchDocuments } from "@/lib/search/search";

let t: TestDb;
beforeEach(async () => {
  t = await setupTestDb();
});
afterEach(async () => {
  await t.cleanup();
});

describe("searchDocuments", () => {
  it("search finds Swedish inflection and excludes removed", async () => {
    const hit = await seedDoc(t.db, { name: "Protokoll 3.docx", markdown: "Beslut: milstolparna för upphandlingen flyttas." });
    await seedDoc(t.db, { name: "Gammalt.docx", markdown: "Milstolpen är borttagen.", removed: true });
    await seedDoc(t.db, { name: "Annat.docx", markdown: "Inget relevant här." });
    const r = await searchDocuments(t.db, "milstolpe");
    expect(r.map((x) => x.documentId)).toEqual([hit.id]);
    expect(r[0].snippet).toContain("<mark>");
    expect(r[0]).toMatchObject({ name: "Protokoll 3.docx", driveFileId: hit.driveFileId });
  });

  it("snippet escapes HTML from documents", async () => {
    await seedDoc(t.db, { markdown: "Milstolpe <script>alert(1)</script> & annat" });
    const [r] = await searchDocuments(t.db, "milstolpe");
    expect(r.snippet).not.toContain("<script>");
    expect(r.snippet).toContain("&amp; annat");
    expect(r.snippet).toContain("<mark>Milstolpe</mark>");
  });

  it("empty query returns nothing", async () => {
    await seedDoc(t.db, { markdown: "text" });
    expect(await searchDocuments(t.db, "   ")).toEqual([]);
  });
});
