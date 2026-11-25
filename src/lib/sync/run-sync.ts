import { createHash } from "node:crypto";
import { and, eq, inArray, not } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { documents, projects, scheduleActivities, scheduleVersions, type DocumentRow } from "@/lib/db/schema";
import { GOOGLE_DOC, type DriveClient, type DriveFile } from "@/lib/drive/types";
import { toMarkdown } from "@/lib/convert/to-markdown";
import { pdfToLines } from "@/lib/convert/pdf-lines";
import { parseP6Pdf } from "@/lib/schedule/p6-pdf";
import type { ParsedSchedule } from "@/lib/schedule/types";
import { classify } from "./classify";

export type SyncReport = {
  scanned: number;
  changed: number;
  skipped: number;
  removed: number;
  errors: { fileId: string; message: string }[];
  newScheduleVersions: number;
};

export type SyncOptions = {
  rootFolderId: string;
  onMinutes?: (doc: DocumentRow) => Promise<void>;
};

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Synkar Drive-mappen till databasen. Idempotent: oförändrade filer hoppas över. */
export async function runSync(db: Db, drive: DriveClient, opts: SyncOptions): Promise<SyncReport> {
  const report: SyncReport = { scanned: 0, changed: 0, skipped: 0, removed: 0, errors: [], newScheduleVersions: 0 };
  const listed = await drive.listTree(opts.rootFolderId);
  const live = listed.filter((f) => !f.trashed);
  report.scanned = live.length;

  const existing = new Map((await db.select().from(documents)).map((d) => [d.driveFileId, d]));

  for (const file of live) {
    const prev = existing.get(file.id);
    if (prev && !prev.removed && isUnchanged(prev, file)) {
      report.skipped++;
      continue;
    }
    report.changed++;
    try {
      const doc = await importFile(db, drive, file, report);
      if (doc.docType === "minutes" && doc.convertStatus === "ok" && opts.onMinutes) await opts.onMinutes(doc);
    } catch (e) {
      report.errors.push({ fileId: file.id, message: message(e) });
    }
  }

  const liveIds = live.map((f) => f.id);
  const gone = await db
    .update(documents)
    .set({ removed: true, lastSyncedAt: new Date() })
    .where(
      and(
        eq(documents.removed, false),
        liveIds.length ? not(inArray(documents.driveFileId, liveIds)) : undefined,
      ),
    )
    .returning({ id: documents.id });
  report.removed = gone.length;
  return report;
}

function isUnchanged(prev: DocumentRow, file: DriveFile): boolean {
  if (file.md5Checksum) return prev.md5Checksum === file.md5Checksum;
  return prev.driveModifiedTime.toISOString() === new Date(file.modifiedTime).toISOString();
}

async function importFile(db: Db, drive: DriveClient, file: DriveFile, report: SyncReport): Promise<DocumentRow> {
  const docType = classify(file);
  let markdown: string | null = null;
  let convertStatus: DocumentRow["convertStatus"] = "ok";
  let importError: string | null = null;
  let schedule: ParsedSchedule | null = null;

  try {
    if (file.mimeType === GOOGLE_DOC) {
      markdown = await drive.exportMarkdown(file.id);
    } else {
      const buf = await drive.download(file.id);
      const conv = await toMarkdown(buf, file.mimeType);
      convertStatus = conv.status;
      markdown = conv.markdown || null;
      if (docType === "schedule" && file.mimeType === "application/pdf" && conv.status === "ok" && markdown?.includes("Project ID:")) {
        schedule = parseP6Pdf(await pdfToLines(buf));
        importError = unparsedWarning(schedule.unparsedLines);
      }
    }
  } catch (e) {
    convertStatus = schedule || markdown ? convertStatus : "error";
    importError = message(e);
  }

  const values = {
    driveFileId: file.id,
    name: file.name,
    mimeType: file.mimeType,
    folderPath: file.folderPath,
    driveModifiedTime: new Date(file.modifiedTime || Date.now()),
    md5Checksum: file.md5Checksum,
    docType,
    convertStatus,
    importError,
    markdown,
    removed: false,
    lastSyncedAt: new Date(),
  };

  const doc = await db.transaction(async (tx) => {
    const [d] = await tx
      .insert(documents)
      .values(values)
      .onConflictDoUpdate({ target: documents.driveFileId, set: values })
      .returning();
    if (schedule) {
      if (await insertSchedule(tx as unknown as Db, d.id, schedule)) report.newScheduleVersions++;
    }
    return d;
  });

  if (importError && !importError.startsWith(WARNING_PREFIX)) report.errors.push({ fileId: file.id, message: importError });
  return doc;
}

const WARNING_PREFIX = "Varning:";

function unparsedWarning(lines: string[]): string | null {
  if (lines.length === 0) return null;
  const n = lines.length === 1 ? "1 rad" : `${lines.length} rader`;
  return `${WARNING_PREFIX} ${n} kunde inte tolkas:\n${lines.join("\n")}`;
}

/** Sparar en tidplanversion. Returnerar false om exakt samma version redan finns. */
async function insertSchedule(db: Db, documentId: number, s: ParsedSchedule): Promise<boolean> {
  await db.insert(projects).values({ code: s.projectCode, name: s.projectCode }).onConflictDoNothing();
  const [project] = await db.select().from(projects).where(eq(projects.code, s.projectCode));
  const contentHash = createHash("sha256").update(JSON.stringify(s.activities)).digest("hex");
  const [version] = await db
    .insert(scheduleVersions)
    .values({
      projectId: project.id,
      documentId,
      sourceFormat: "p6_pdf",
      dataDate: s.dataDate,
      baselineName: s.baselineName,
      printDate: s.printDate,
      contentHash,
    })
    .onConflictDoNothing()
    .returning();
  if (!version) return false;
  if (s.activities.length) {
    await db.insert(scheduleActivities).values(s.activities.map((a) => ({ ...a, versionId: version.id })));
  }
  return true;
}
