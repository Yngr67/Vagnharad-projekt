import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { documents, scheduleActivities, scheduleVersions, type ScheduleActivityRow } from "@/lib/db/schema";

export type VersionListItem = { id: number; dataDate: string; documentName: string; baselineName: string | null };

export type ActivityFilters = {
  milestonesOnly?: boolean;
  wbs?: string;
  from?: string;
  to?: string;
  q?: string;
};

/** Projektets tidplanversioner, nyast först (borttagna dokument utesluts). */
export async function listVersions(db: Db, projectId: number): Promise<VersionListItem[]> {
  return db
    .select({
      id: scheduleVersions.id,
      dataDate: scheduleVersions.dataDate,
      documentName: documents.name,
      baselineName: scheduleVersions.baselineName,
    })
    .from(scheduleVersions)
    .innerJoin(documents, eq(documents.id, scheduleVersions.documentId))
    .where(and(eq(scheduleVersions.projectId, projectId), eq(documents.removed, false)))
    .orderBy(desc(scheduleVersions.dataDate), desc(scheduleVersions.importedAt), desc(scheduleVersions.id));
}

/** Aktiviteter i en version, sorterade på datum. Tidsfönstret matchar aktiviteter som överlappar det. */
export async function listActivities(db: Db, versionId: number, f: ActivityFilters): Promise<ScheduleActivityRow[]> {
  const a = scheduleActivities;
  const first = sql`coalesce(${a.startDate}, ${a.finishDate})`;
  const last = sql`coalesce(${a.finishDate}, ${a.startDate})`;
  return db
    .select()
    .from(a)
    .where(
      and(
        eq(a.versionId, versionId),
        f.milestonesOnly ? eq(a.isMilestone, true) : undefined,
        f.wbs ? sql`${f.wbs} = any(${a.wbsPath})` : undefined,
        f.from ? sql`${last} >= ${f.from}` : undefined,
        f.to ? sql`${first} <= ${f.to}` : undefined,
        f.q ? ilike(a.name, `%${f.q.replace(/[%_\\]/g, "\\$&")}%`) : undefined,
      ),
    )
    .orderBy(sql`${first} asc nulls last`, asc(a.activityCode));
}

/** Alla WBS-namn som förekommer i versionen (för filtret). */
export async function listWbsNames(db: Db, versionId: number): Promise<string[]> {
  const rows = await db.execute<{ name: string }>(
    sql`select distinct unnest(wbs_path) as name from schedule_activities where version_id = ${versionId} order by 1`,
  );
  return rows.map((r) => r.name);
}
