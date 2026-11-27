import { asc, eq, isNotNull, and } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { actions, projects, type ProjectRow } from "@/lib/db/schema";

/** Projektet som visas: angivet via kod, annars det först skapade. */
export async function getActiveProject(db: Db, code?: string): Promise<ProjectRow | null> {
  if (code) {
    const [p] = await db.select().from(projects).where(eq(projects.code, code));
    if (p) return p;
  }
  const [first] = await db.select().from(projects).orderBy(asc(projects.id)).limit(1);
  return first ?? null;
}

export async function listProjects(db: Db): Promise<ProjectRow[]> {
  return db.select().from(projects).orderBy(asc(projects.code));
}

/** Värden att välja bland i filtren. */
export async function getFilterOptions(db: Db, projectId: number): Promise<{ owners: string[]; subprojects: string[] }> {
  const owners = await db
    .selectDistinct({ v: actions.owner })
    .from(actions)
    .where(and(eq(actions.projectId, projectId), isNotNull(actions.owner)))
    .orderBy(asc(actions.owner));
  const subs = await db
    .selectDistinct({ v: actions.subproject })
    .from(actions)
    .where(and(eq(actions.projectId, projectId), isNotNull(actions.subproject)))
    .orderBy(asc(actions.subproject));
  return { owners: owners.map((o) => o.v!), subprojects: subs.map((s) => s.v!) };
}
