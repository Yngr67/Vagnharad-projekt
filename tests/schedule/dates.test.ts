import { describe, it, expect } from "vitest";
import { parseP6Date } from "@/lib/schedule/dates";

describe("parseP6Date", () => {
  it("parses 05-Nov-26 → 2026-11-05", () => {
    expect(parseP6Date("05-Nov-26")).toEqual({ date: "2026-11-05", actual: false, constrained: false });
  });
  it("parses '03-Dec-24 A' as actual", () => {
    expect(parseP6Date("03-Dec-24 A")).toEqual({ date: "2024-12-03", actual: true, constrained: false });
  });
  it("parses '03-May-27*' as constrained", () => {
    expect(parseP6Date("03-May-27*")).toEqual({ date: "2027-05-03", actual: false, constrained: true });
  });
  it("returns null for garbage", () => {
    expect(parseP6Date("32-Foo-26")).toBeNull();
    expect(parseP6Date("30-Feb-26")).toBeNull();
    expect(parseP6Date("hej")).toBeNull();
  });
});
