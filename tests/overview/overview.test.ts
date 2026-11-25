import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestDb, type TestDb } from "../helpers/db";
import { seedDoc, seedProject, seedVersion, milestone } from "../helpers/seed";
import { todayInStockholm } from "@/lib/overview/today";
import { getCurrentVersion, getOverview } from "@/lib/overview/get-overview";
import { createAction } from "@/lib/actions/service";
import { actions } from "@/lib/db/schema";

let t: TestDb;
beforeEach(async () => {
  t = await setupTestDb();
});
afterEach(async () => {
  await t.cleanup();
});

describe("todayInStockholm", () => {
  it("today uses Europe/Stockholm", () => {
    expect(todayInStockholm(new Date("2026-11-30T23:30:00Z"))).toBe("2026-12-01");
    expect(todayInStockholm(new Date("2026-06-30T21:30:00Z"))).toBe("2026-06-30");
  });
});

describe("getCurrentVersion", () => {
  it("current version is latest data date", async () => {
    const p = await seedProject(t.db);
    await seedVersion(t.db, p.id, "2026-10-01", []);
    const { version: newer } = await seedVersion(t.db, p.id, "2026-11-01", []);
    await seedVersion(t.db, p.id, "2026-09-01", []);
    expect((await getCurrentVersion(t.db, p.id))?.id).toBe(newer.id);
  });

  it("ignores versions whose document is removed", async () => {
    const p = await seedProject(t.db);
    const { version: old } = await seedVersion(t.db, p.id, "2026-10-01", []);
    await seedVersion(t.db, p.id, "2026-11-01", [], { removed: true });
    expect((await getCurrentVersion(t.db, p.id))?.id).toBe(old.id);
  });
});

describe("getOverview", () => {
  const today = "2026-11-25";

  it("stale when data date older than 35 days", async () => {
    const p = await seedProject(t.db);
    await seedVersion(t.db, p.id, "2026-10-01", []);
    const o = await getOverview(t.db, { projectId: p.id, today });
    expect(o.version).toEqual({ id: expect.any(Number), dataDate: "2026-10-01", ageDays: 55, stale: true });
    const p2 = await seedProject(t.db, "YY01");
    await seedVersion(t.db, p2.id, "2026-10-21", []);
    expect((await getOverview(t.db, { projectId: p2.id, today })).version?.stale).toBe(false);
  });

  it("upcoming milestones within 14 days only", async () => {
    const p = await seedProject(t.db);
    await seedVersion(t.db, p.id, "2026-10-01", [
      milestone("M-today", "2026-11-25"),
      milestone("M-14", "2026-12-09"),
      milestone("M-15", "2026-12-10"),
      { activityCode: "NotMs", finishDate: "2026-11-30", remainingDays: 3 },
    ]);
    const o = await getOverview(t.db, { projectId: p.id, today });
    expect(o.upcomingMilestones.map((m) => m.activityCode)).toEqual(["M-today", "M-14"]);
  });

  it("passedWithoutActual excludes actual and dates before data date", async () => {
    const p = await seedProject(t.db);
    await seedVersion(t.db, p.id, "2026-10-01", [
      milestone("Before", "2026-09-20"),
      milestone("Passed", "2026-11-05"),
      milestone("Done", "2026-11-06", { finishActual: true }),
      milestone("Today", "2026-11-25"),
    ]);
    const o = await getOverview(t.db, { projectId: p.id, today });
    expect(o.passedWithoutActual.map((m) => m.activityCode)).toEqual(["Passed"]);
  });

  it("milestone with only start date appears correctly", async () => {
    const p = await seedProject(t.db);
    await seedVersion(t.db, p.id, "2026-10-01", [
      { activityCode: "S1", remainingDays: 0, startDate: "2026-11-27", isMilestone: true },
      { activityCode: "S2", remainingDays: 0, startDate: "2026-11-02", isMilestone: true },
      { activityCode: "S3", remainingDays: 0, startDate: "2026-11-03", startActual: true, isMilestone: true },
    ]);
    const o = await getOverview(t.db, { projectId: p.id, today });
    expect(o.upcomingMilestones).toEqual([
      expect.objectContaining({ activityCode: "S1", date: "2026-11-27", actual: false }),
    ]);
    expect(o.passedWithoutActual.map((m) => m.activityCode)).toEqual(["S2"]);
  });

  it("proposals not counted and overdue counts open actions past due", async () => {
    const p = await seedProject(t.db);
    await createAction(t.db, { projectId: p.id, title: "Öppen", dueDate: "2026-12-01" });
    await createAction(t.db, { projectId: p.id, title: "Sen", dueDate: "2026-11-20" });
    await createAction(t.db, { projectId: p.id, title: "Ingen deadline" });
    const klar = await createAction(t.db, { projectId: p.id, title: "Klar", dueDate: "2026-11-01" });
    await t.db.update(actions).set({ status: "klar" }).where((await import("drizzle-orm")).eq(actions.id, klar.id));
    await t.db.insert(actions).values({ projectId: p.id, title: "Förslag", status: "foreslagen", source: "protokoll", dueDate: "2026-11-01" });
    const o = await getOverview(t.db, { projectId: p.id, today });
    expect(o.actionCounts).toEqual({ open: 3, overdue: 1, done: 1 });
  });

  it("filters by owner, status and subproject", async () => {
    const p = await seedProject(t.db);
    await createAction(t.db, { projectId: p.id, title: "A", owner: "Anna", subproject: "Upphandling" });
    await createAction(t.db, { projectId: p.id, title: "B", owner: "Bo", subproject: "Produktion" });
    await seedVersion(t.db, p.id, "2026-11-20", [
      milestone("U1", "2026-11-28", { wbsPath: ["Bana", "Upphandling"] }),
      milestone("P1", "2026-11-29", { wbsPath: ["Bana", "Produktion"] }),
    ]);
    const byOwner = await getOverview(t.db, { projectId: p.id, today, owner: "Anna" });
    expect(byOwner.actionCounts.open).toBe(1);
    expect(byOwner.recentActions.map((a) => a.title)).toEqual(["A"]);
    const bySub = await getOverview(t.db, { projectId: p.id, today, subproject: "Produktion" });
    expect(bySub.recentActions.map((a) => a.title)).toEqual(["B"]);
    expect(bySub.upcomingMilestones.map((m) => m.activityCode)).toEqual(["P1"]);
    const byStatus = await getOverview(t.db, { projectId: p.id, today, status: "klar" });
    expect(byStatus.recentActions).toEqual([]);
  });

  it("recent documents exclude removed and are limited to 5", async () => {
    const p = await seedProject(t.db);
    for (let i = 0; i < 6; i++) await seedDoc(t.db);
    await seedDoc(t.db, { removed: true });
    const o = await getOverview(t.db, { projectId: p.id, today });
    expect(o.recentDocuments).toHaveLength(5);
    expect(o.recentDocuments.every((d) => !d.removed)).toBe(true);
  });

  it("no schedule yet gives null version and empty lists", async () => {
    const p = await seedProject(t.db);
    const o = await getOverview(t.db, { projectId: p.id, today });
    expect(o.version).toBeNull();
    expect(o.upcomingMilestones).toEqual([]);
  });
});
