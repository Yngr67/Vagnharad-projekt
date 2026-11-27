import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  actions,
  documents,
  projects,
  scheduleActivities,
  scheduleVersions,
  type ActionRow,
  type DocumentRow,
  type ProjectRow,
  type ScheduleVersionRow,
} from "@/lib/db/schema";
import { addDays, daysBetween } from "./today";

export const UPCOMING_WINDOW_DAYS = 14;
export const STALE_AFTER_DAYS = 35;

export type ActionStatus = ActionRow["status"];

export type Milestone = {
  activityCode: string;
  name: string;
  date: string;
  actual: boolean;
  wbsPath: string[];
};

export type OverviewFilters = {
  projectId: number;
  today: string;
  owner?: string;
  status?: ActionStatus;
  subproject?: string;
};

export type Overview = {
  project: ProjectRow;
  version: { id: number; dataDate: string; ageDays: number; stale: boolean } | null;
  actionCounts: { open: number; overdue: number; done: number };
  upcomingMilestones: Milestone[];
  passedWithoutActual: Milestone[];
  recentDocuments: DocumentRow[];
  recentActions: ActionRow[];
};

/** Senaste tidplanversionen (senaste avstämningsdatum) vars dokument inte är borttaget. */
export async function getCurrentVersion(db: Db, projectId: number): Promise<ScheduleVersionRow | null> {
  const [row] = await db
    .select({ v: scheduleVersions })
    .from(scheduleVersions)
    .innerJoin(documents, eq(documents.id, scheduleVersions.documentId))
    .where(and(eq(scheduleVersions.projectId, projectId), eq(documents.removed, false)))
    .orderBy(desc(scheduleVersions.dataDate), desc(scheduleVersions.importedAt), desc(scheduleVersions.id))
    .limit(1);
  return row?.v ?? null;
}

/** Milstolpar i en version, med det datum som gäller (slut, annars start). */
export async function getMilestones(db: Db, versionId: number): Promise<Milestone[]> {
  const rows = await db
    .select()
    .from(scheduleActivities)
    .where(and(eq(scheduleActivities.versionId, versionId), eq(scheduleActivities.isMilestone, true)));
  return rows
    .map((a) => {
      const date = a.finishDate ?? a.startDate;
      if (!date) return null;
      return {
        activityCode: a.activityCode,
        name: a.name,
        date,
        actual: a.finishDate ? a.finishActual : a.startActual,
        wbsPath: a.wbsPath,
      };
    })
    .filter((m): m is Milestone => m !== null)
    .sort((a, b) => a.date.localeCompare(b.date) || a.activityCode.localeCompare(b.activityCode));
}

function actionFilter(f: OverviewFilters): SQL | undefined {
  return and(
    eq(actions.projectId, f.projectId),
    f.owner ? eq(actions.owner, f.owner) : undefined,
    f.subproject ? eq(actions.subproject, f.subproject) : undefined,
  );
}

export async function getOverview(db: Db, f: OverviewFilters): Promise<Overview> {
  const [project] = await db.select().from(projects).where(eq(projects.id, f.projectId));
  if (!project) throw new Error(`Projekt ${f.projectId} finns inte`);

  const current = await getCurrentVersion(db, f.projectId);
  const version = current
    ? (() => {
        const ageDays = daysBetween(current.dataDate, f.today);
        return { id: current.id, dataDate: current.dataDate, ageDays, stale: ageDays > STALE_AFTER_DAYS };
      })()
    : null;

  let milestones = current ? await getMilestones(db, current.id) : [];
  if (f.subproject) milestones = milestones.filter((m) => m.wbsPath.includes(f.subproject!));
  const horizon = addDays(f.today, UPCOMING_WINDOW_DAYS);
  const upcomingMilestones = milestones.filter((m) => m.date >= f.today && m.date <= horizon);
  const passedWithoutActual = current
    ? milestones.filter((m) => !m.actual && m.date > current.dataDate && m.date < f.today)
    : [];

  const [counts] = await db
    .select({
      open: sql<number>`count(*) filter (where ${actions.status} = 'oppen')`.mapWith(Number),
      overdue: sql<number>`count(*) filter (where ${actions.status} = 'oppen' and ${actions.dueDate} < ${f.today})`.mapWith(Number),
      done: sql<number>`count(*) filter (where ${actions.status} = 'klar')`.mapWith(Number),
    })
    .from(actions)
    .where(actionFilter(f));

  const recentActions = await db
    .select()
    .from(actions)
    .where(and(actionFilter(f), f.status ? eq(actions.status, f.status) : sql`${actions.status} in ('oppen','klar')`))
    .orderBy(desc(actions.createdAt), desc(actions.id))
    .limit(5);

  const recentDocuments = await db
    .select()
    .from(documents)
    .where(eq(documents.removed, false))
    .orderBy(desc(documents.lastSyncedAt), desc(documents.id))
    .limit(5);

  return {
    project,
    version,
    actionCounts: counts,
    upcomingMilestones,
    passedWithoutActual,
    recentDocuments,
    recentActions,
  };
}
