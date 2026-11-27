import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { actions, projects, scheduleActivities, type ActionRow } from "@/lib/db/schema";

export type NewActionInput = {
  projectId: number;
  title: string;
  description?: string | null;
  owner?: string | null;
  priority?: ActionRow["priority"];
  dueDate?: string | null;
  subproject?: string | null;
};

export type ActionPatch = Partial<
  Pick<ActionRow, "title" | "description" | "owner" | "status" | "priority" | "dueDate" | "subproject">
>;

export type ActionFilters = {
  projectId: number;
  owner?: string;
  status?: ActionRow["status"];
  subproject?: string;
};

export async function createAction(db: Db, input: NewActionInput): Promise<ActionRow> {
  const [a] = await db
    .insert(actions)
    .values({ ...input, status: "oppen", source: "manuell" })
    .returning();
  return a;
}

export async function updateAction(db: Db, id: number, patch: ActionPatch): Promise<ActionRow> {
  const [a] = await db
    .update(actions)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(actions.id, id))
    .returning();
  if (!a) throw new Error(`Action ${id} finns inte`);
  return a;
}

/** Skapar en action från en tidplanaktivitet. Finns den redan returneras den befintliga. */
export async function createActionFromActivity(
  db: Db,
  args: { projectId: number; versionId: number; activityCode: string },
): Promise<ActionRow> {
  const [project] = await db.select().from(projects).where(eq(projects.id, args.projectId));
  if (!project) throw new Error(`Projekt ${args.projectId} finns inte`);
  const sourceKey = `tidplan:${project.code}:${args.activityCode}`;
  const [activity] = await db
    .select()
    .from(scheduleActivities)
    .where(and(eq(scheduleActivities.versionId, args.versionId), eq(scheduleActivities.activityCode, args.activityCode)));
  if (!activity) throw new Error(`Aktivitet ${args.activityCode} finns inte i versionen`);
  await db
    .insert(actions)
    .values({
      projectId: project.id,
      title: activity.name,
      dueDate: activity.finishDate ?? activity.startDate,
      subproject: activity.wbsPath.at(-1) ?? null,
      source: "tidplan",
      status: "oppen",
      activityCode: activity.activityCode,
      sourceKey,
    })
    .onConflictDoNothing({ target: actions.sourceKey });
  const [a] = await db.select().from(actions).where(eq(actions.sourceKey, sourceKey));
  return a;
}

export const approveProposal = (db: Db, id: number) => updateAction(db, id, { status: "oppen" });
export const rejectProposal = (db: Db, id: number) => updateAction(db, id, { status: "avvisad" });

export async function listActions(db: Db, f: ActionFilters): Promise<ActionRow[]> {
  return db
    .select()
    .from(actions)
    .where(
      and(
        eq(actions.projectId, f.projectId),
        f.owner ? eq(actions.owner, f.owner) : undefined,
        f.status ? eq(actions.status, f.status) : sql`${actions.status} <> 'avvisad'`,
        f.subproject ? eq(actions.subproject, f.subproject) : undefined,
      ),
    )
    .orderBy(sql`${actions.dueDate} asc nulls last`, asc(actions.id));
}
