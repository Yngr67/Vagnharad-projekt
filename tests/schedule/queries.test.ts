import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestDb, type TestDb } from "../helpers/db";
import { seedProject, seedVersion, milestone } from "../helpers/seed";
import { listActivities, listVersions } from "@/lib/schedule/queries";

let t: TestDb;
beforeEach(async () => {
  t = await setupTestDb();
});
afterEach(async () => {
  await t.cleanup();
});

describe("schedule queries", () => {
  it("listVersions newest first with document name, excluding removed", async () => {
    const p = await seedProject(t.db);
    await seedVersion(t.db, p.id, "2026-09-15", [], { name: "sep.pdf" });
    await seedVersion(t.db, p.id, "2026-10-15", [], { name: "okt.pdf" });
    await seedVersion(t.db, p.id, "2026-11-15", [], { name: "nov.pdf", removed: true });
    const v = await listVersions(t.db, p.id);
    expect(v.map((x) => [x.dataDate, x.documentName])).toEqual([
      ["2026-10-15", "okt.pdf"],
      ["2026-09-15", "sep.pdf"],
    ]);
  });

  it("listActivities filters by milestone, wbs, window and text", async () => {
    const p = await seedProject(t.db);
    const { version } = await seedVersion(t.db, p.id, "2026-10-01", [
      milestone("M1", "2026-11-01", { name: "Anbudsdag", wbsPath: ["Bana", "Upphandling"] }),
      { activityCode: "A1", name: "Bygga bro", startDate: "2026-10-01", finishDate: "2027-05-01", remainingDays: 100, wbsPath: ["Bana", "Produktion"] },
      milestone("M2", "2027-06-01", { name: "Byggstart", wbsPath: ["Bana", "Produktion"] }),
    ]);
    const all = await listActivities(t.db, version.id, {});
    expect(all.map((a) => a.activityCode)).toEqual(["A1", "M1", "M2"]);
    expect((await listActivities(t.db, version.id, { milestonesOnly: true })).map((a) => a.activityCode)).toEqual(["M1", "M2"]);
    expect((await listActivities(t.db, version.id, { wbs: "Produktion" })).map((a) => a.activityCode)).toEqual(["A1", "M2"]);
    expect((await listActivities(t.db, version.id, { from: "2026-12-01", to: "2027-12-31" })).map((a) => a.activityCode)).toEqual(["A1", "M2"]);
    expect((await listActivities(t.db, version.id, { q: "anbud" })).map((a) => a.activityCode)).toEqual(["M1"]);
  });
});
