import { describe, it, expect } from "vitest";
// @ts-expect-error – ren JavaScript-modul utan typer
import { shouldRun } from "../../docker/scheduler.mjs";

describe("scheduler.shouldRun", () => {
  it("runs at 02:xx Stockholm time once per day", () => {
    // 01:10 UTC = 02:10 i Stockholm (vintertid)
    expect(shouldRun(new Date("2026-11-26T01:10:00Z"), null)).toBe(true);
    expect(shouldRun(new Date("2026-11-26T01:10:00Z"), "2026-11-26")).toBe(false);
    expect(shouldRun(new Date("2026-11-27T01:05:00Z"), "2026-11-26")).toBe(true);
  });
  it("does not run outside the 02:00 hour", () => {
    expect(shouldRun(new Date("2026-11-26T12:00:00Z"), null)).toBe(false);
    // 02:30 UTC = 03:30 i Stockholm
    expect(shouldRun(new Date("2026-11-26T02:30:00Z"), null)).toBe(false);
  });
  it("handles summer time", () => {
    // 00:15 UTC = 02:15 i Stockholm (sommartid)
    expect(shouldRun(new Date("2026-06-10T00:15:00Z"), null)).toBe(true);
  });
});
