import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { count, eq } from "drizzle-orm";
import { setupTestDb, type TestDb } from "../helpers/db";
import { fixture } from "../helpers/fixtures";
import { FakeDriveClient, type FakeFile } from "@/lib/drive/fake-client";
import { runSync } from "@/lib/sync/run-sync";
import { classify } from "@/lib/sync/classify";
import { documents, projects, scheduleActivities, scheduleVersions } from "@/lib/db/schema";
import type { DriveFile } from "@/lib/drive/types";

const ROOT = "root";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function file(id: string, name: string, folderPath: string, content: Uint8Array, mimeType: string, md5 = `md5-${id}`): FakeFile {
  return { id, name, folderPath, mimeType, modifiedTime: "2026-10-01T10:00:00Z", md5Checksum: md5, trashed: false, content };
}

const schedule = () => file("s1", "XX99 Tidplan sep.pdf", "Tidplaner", fixture("p6-synthetic.pdf"), "application/pdf");
const minutes = () => file("m1", "Protokoll byggmöte 3.docx", "Möten", fixture("protokoll.docx"), DOCX);

let t: TestDb;
beforeEach(async () => {
  t = await setupTestDb();
});
afterEach(async () => {
  await t.cleanup();
});

const counts = async () => ({
  docs: (await t.db.select({ n: count() }).from(documents))[0].n,
  projects: (await t.db.select({ n: count() }).from(projects))[0].n,
  versions: (await t.db.select({ n: count() }).from(scheduleVersions))[0].n,
  activities: (await t.db.select({ n: count() }).from(scheduleActivities))[0].n,
});

describe("runSync", () => {
  it("first sync imports documents and one schedule version", async () => {
    const drive = new FakeDriveClient([schedule(), minutes()]);
    const r = await runSync(t.db, drive, { rootFolderId: ROOT });
    expect(r).toMatchObject({ scanned: 2, changed: 2, skipped: 0, removed: 0, errors: [], newScheduleVersions: 1 });
    expect(await counts()).toEqual({ docs: 2, projects: 1, versions: 1, activities: 8 });
    const [p] = await t.db.select().from(projects);
    expect(p.code).toBe("XX99");
    const [d] = await t.db.select().from(documents).where(eq(documents.driveFileId, "m1"));
    expect(d.docType).toBe("minutes");
    expect(d.markdown).toContain("Mötesprotokoll testmöte");
  });

  it("unparsed schedule lines are kept as a warning on the document", async () => {
    const drive = new FakeDriveClient([schedule()]);
    await runSync(t.db, drive, { rootFolderId: ROOT });
    const [d] = await t.db.select().from(documents);
    expect(d.importError).toContain("1 rad kunde inte tolkas");
    expect(d.importError).toContain("?? oläsbar rad utan datum");
  });

  it("second sync on unchanged tree changes nothing", async () => {
    const drive = new FakeDriveClient([schedule(), minutes()]);
    await runSync(t.db, drive, { rootFolderId: ROOT });
    const before = await counts();
    const r = await runSync(t.db, drive, { rootFolderId: ROOT });
    expect(r).toMatchObject({ changed: 0, skipped: 2, newScheduleVersions: 0 });
    expect(await counts()).toEqual(before);
  });

  it("changed file creates a new version", async () => {
    const drive = new FakeDriveClient([schedule()]);
    await runSync(t.db, drive, { rootFolderId: ROOT });
    drive.setFiles([{ ...schedule(), content: fixture("p6-synthetic-v2.pdf"), md5Checksum: "md5-new" }]);
    const r = await runSync(t.db, drive, { rootFolderId: ROOT });
    expect(r.newScheduleVersions).toBe(1);
    expect((await counts()).versions).toBe(2);
  });

  it("new file with same project ID joins the same project", async () => {
    const drive = new FakeDriveClient([schedule()]);
    await runSync(t.db, drive, { rootFolderId: ROOT });
    drive.setFiles([schedule(), file("s2", "XX99 Tidplan okt.pdf", "Tidplaner", fixture("p6-synthetic-v2.pdf"), "application/pdf")]);
    await runSync(t.db, drive, { rootFolderId: ROOT });
    const c = await counts();
    expect(c.projects).toBe(1);
    expect(c.versions).toBe(2);
    const dates = (await t.db.select().from(scheduleVersions)).map((v) => v.dataDate).sort();
    expect(dates).toEqual(["2026-09-15", "2026-10-15"]);
  });

  it("same project and data date under new file name is deduplicated", async () => {
    const drive = new FakeDriveClient([schedule()]);
    await runSync(t.db, drive, { rootFolderId: ROOT });
    drive.setFiles([schedule(), { ...schedule(), id: "s1-copy", name: "Kopia av tidplan.pdf", md5Checksum: "md5-copy" }]);
    const r = await runSync(t.db, drive, { rootFolderId: ROOT });
    expect(r.newScheduleVersions).toBe(0);
    expect((await counts()).versions).toBe(1);
  });

  it("broken pdf records importError and others still import", async () => {
    const broken = file("b1", "Trasig.pdf", "Tidplaner", new TextEncoder().encode("inte en pdf"), "application/pdf");
    const drive = new FakeDriveClient([broken, minutes()]);
    const r = await runSync(t.db, drive, { rootFolderId: ROOT });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].fileId).toBe("b1");
    const docs = await t.db.select().from(documents);
    expect(docs.find((d) => d.driveFileId === "b1")).toMatchObject({ convertStatus: "error" });
    expect(docs.find((d) => d.driveFileId === "b1")?.importError).toBeTruthy();
    expect(docs.find((d) => d.driveFileId === "m1")).toMatchObject({ convertStatus: "ok" });
  });

  it("schedule pdf without Project ID is stored without version or error", async () => {
    const graphic = file("g1", "Programplan.pdf", "Tidplaner", fixture("protokoll-as-pdf.pdf"), "application/pdf");
    const drive = new FakeDriveClient([graphic]);
    const r = await runSync(t.db, drive, { rootFolderId: ROOT });
    expect(r.errors).toEqual([]);
    expect(r.newScheduleVersions).toBe(0);
    const [d] = await t.db.select().from(documents);
    expect(d).toMatchObject({ docType: "schedule", convertStatus: "ok", importError: null });
  });

  it("trashed file is marked removed", async () => {
    const drive = new FakeDriveClient([schedule(), minutes()]);
    await runSync(t.db, drive, { rootFolderId: ROOT });
    drive.setFiles([{ ...schedule(), trashed: true }]);
    const r = await runSync(t.db, drive, { rootFolderId: ROOT });
    expect(r.removed).toBe(2);
    const docs = await t.db.select().from(documents);
    expect(docs.every((d) => d.removed)).toBe(true);
    expect((await counts()).versions).toBe(1);
  });

  it("scanned pdf stored with needs_ocr", async () => {
    const drive = new FakeDriveClient([file("o1", "Skannad.pdf", "Övrigt", fixture("scanned.pdf"), "application/pdf")]);
    await runSync(t.db, drive, { rootFolderId: ROOT });
    const [d] = await t.db.select().from(documents);
    expect(d.convertStatus).toBe("needs_ocr");
  });

  it("calls onMinutes for changed minutes only", async () => {
    const drive = new FakeDriveClient([schedule(), minutes()]);
    const seen: string[] = [];
    const onMinutes = async (d: { driveFileId: string }) => {
      seen.push(d.driveFileId);
    };
    await runSync(t.db, drive, { rootFolderId: ROOT, onMinutes });
    await runSync(t.db, drive, { rootFolderId: ROOT, onMinutes });
    expect(seen).toEqual(["m1"]);
  });
});

describe("classify", () => {
  const f = (name: string, folderPath: string): DriveFile => ({
    id: "x", name, folderPath, mimeType: "application/pdf", modifiedTime: "", md5Checksum: null, trashed: false,
  });
  it.each([
    ["Tidplan.pdf", "Tidplaner", "schedule"],
    ["Tidplan.pdf", "Tidplaner/Arkiv", "schedule"],
    ["Protokoll styrgrupp.docx", "Möten", "minutes"],
    ["Minnesanteckningar 12 nov.pdf", "", "minutes"],
    ["AKJ.docx", "Projekt och kontrakt krav", "requirements"],
    ["PM 07.docx", "Kostnadsbesparingar", "other"],
  ])("%s in %s → %s", (name, folder, expected) => {
    expect(classify(f(name, folder))).toBe(expected);
  });
});
