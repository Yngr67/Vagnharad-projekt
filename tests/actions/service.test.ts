import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestDb, type TestDb } from "../helpers/db";
import { seedProject, seedVersion, milestone } from "../helpers/seed";
import {
  approveProposal,
  createAction,
  createActionFromActivity,
  listActions,
  rejectProposal,
  updateAction,
} from "@/lib/actions/service";
import { actions } from "@/lib/db/schema";

let t: TestDb;
beforeEach(async () => {
  t = await setupTestDb();
});
afterEach(async () => {
  await t.cleanup();
});

describe("actions service", () => {
  it("createAction makes an open manual action", async () => {
    const p = await seedProject(t.db);
    const a = await createAction(t.db, { projectId: p.id, title: "Ring beställaren", owner: "Peter" });
    expect(a).toMatchObject({ status: "oppen", source: "manuell", priority: "medel", sourceKey: null });
  });

  it("updateAction changes fields and updatedAt", async () => {
    const p = await seedProject(t.db);
    const a = await createAction(t.db, { projectId: p.id, title: "X" });
    const u = await updateAction(t.db, a.id, { status: "klar", owner: "Bo" });
    expect(u).toMatchObject({ status: "klar", owner: "Bo" });
    expect(u.updatedAt.getTime()).toBeGreaterThanOrEqual(a.updatedAt.getTime());
  });

  it("createActionFromActivity twice returns same row", async () => {
    const p = await seedProject(t.db);
    const { version } = await seedVersion(t.db, p.id, "2026-10-01", [
      milestone("Prv120", "2026-12-10", { name: "Underlag klart", wbsPath: ["Bana", "Upphandling"] }),
    ]);
    const a = await createActionFromActivity(t.db, { projectId: p.id, versionId: version.id, activityCode: "Prv120" });
    expect(a).toMatchObject({
      title: "Underlag klart",
      dueDate: "2026-12-10",
      subproject: "Upphandling",
      source: "tidplan",
      sourceKey: "tidplan:XX99:Prv120",
      activityCode: "Prv120",
      status: "oppen",
    });
    const b = await createActionFromActivity(t.db, { projectId: p.id, versionId: version.id, activityCode: "Prv120" });
    expect(b.id).toBe(a.id);
    expect(await t.db.$count(actions)).toBe(1);
  });

  it("approve/reject transitions", async () => {
    const p = await seedProject(t.db);
    const [f1, f2] = await t.db
      .insert(actions)
      .values([
        { projectId: p.id, title: "F1", status: "foreslagen", source: "protokoll", sourceKey: "k1" },
        { projectId: p.id, title: "F2", status: "foreslagen", source: "protokoll", sourceKey: "k2" },
      ])
      .returning();
    expect((await approveProposal(t.db, f1.id)).status).toBe("oppen");
    expect((await rejectProposal(t.db, f2.id)).status).toBe("avvisad");
  });

  it("listActions filters and orders by due date", async () => {
    const p = await seedProject(t.db);
    await createAction(t.db, { projectId: p.id, title: "Sen", dueDate: "2026-12-20", owner: "Anna" });
    await createAction(t.db, { projectId: p.id, title: "Tidig", dueDate: "2026-12-01", owner: "Anna" });
    await createAction(t.db, { projectId: p.id, title: "Annan", owner: "Bo" });
    const list = await listActions(t.db, { projectId: p.id, owner: "Anna" });
    expect(list.map((a) => a.title)).toEqual(["Tidig", "Sen"]);
    expect(await listActions(t.db, { projectId: p.id, status: "foreslagen" })).toEqual([]);
  });
});
