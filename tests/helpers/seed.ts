import type { Db } from "@/lib/db/client";
import { documents, projects, scheduleActivities, scheduleVersions } from "@/lib/db/schema";

let n = 0;

export async function seedProject(db: Db, code = "XX99") {
  const [p] = await db.insert(projects).values({ code, name: `Projekt ${code}` }).returning();
  return p;
}

export async function seedDoc(db: Db, over: Partial<typeof documents.$inferInsert> = {}) {
  n++;
  const [d] = await db
    .insert(documents)
    .values({
      driveFileId: `f${n}`,
      name: `Dokument ${n}.pdf`,
      mimeType: "application/pdf",
      folderPath: "Tidplaner",
      driveModifiedTime: new Date("2026-10-01T00:00:00Z"),
      docType: "schedule",
      convertStatus: "ok",
      lastSyncedAt: new Date(Date.UTC(2026, 9, 1, 0, n)),
      ...over,
    })
    .returning();
  return d;
}

export type SeedActivity = Partial<typeof scheduleActivities.$inferInsert> & { activityCode: string };

export async function seedVersion(
  db: Db,
  projectId: number,
  dataDate: string,
  activities: SeedActivity[],
  docOver: Partial<typeof documents.$inferInsert> = {},
) {
  const d = await seedDoc(db, docOver);
  const [v] = await db
    .insert(scheduleVersions)
    .values({ projectId, documentId: d.id, sourceFormat: "p6_pdf", dataDate, contentHash: `h${++n}` })
    .returning();
  if (activities.length) {
    await db.insert(scheduleActivities).values(
      activities.map((a) => ({ name: a.activityCode, ...a, versionId: v.id })),
    );
  }
  return { version: v, document: d };
}

export const milestone = (activityCode: string, finishDate: string, extra: Partial<SeedActivity> = {}): SeedActivity => ({
  activityCode,
  name: `Milstolpe ${activityCode}`,
  remainingDays: 0,
  finishDate,
  isMilestone: true,
  ...extra,
});
