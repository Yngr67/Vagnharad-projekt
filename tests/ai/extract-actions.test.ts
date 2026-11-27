import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { setupTestDb, type TestDb } from "../helpers/db";
import { seedDoc, seedProject } from "../helpers/seed";
import { actionKey, buildMinutesHook, proposeActionsFromMinutes, type ActionExtractor, type ProposedAction } from "@/lib/ai/extract-actions";
import { actions } from "@/lib/db/schema";

const fake = (items: ProposedAction[]): ActionExtractor & { calls: number } => ({
  calls: 0,
  async extract() {
    this.calls++;
    return items;
  },
});

const ITEMS: ProposedAction[] = [
  { title: "Boka möte med kommunen", owner: "Anna", dueDate: "2026-12-01", description: null },
  { title: "Skicka PQ-underlag", owner: null, dueDate: null, description: "Till upphandlaren" },
];

let t: TestDb;
beforeEach(async () => {
  t = await setupTestDb();
});
afterEach(async () => {
  await t.cleanup();
});

describe("proposeActionsFromMinutes", () => {
  it("creates proposals with status foreslagen", async () => {
    const p = await seedProject(t.db);
    const doc = await seedDoc(t.db, { docType: "minutes", markdown: "# Protokoll\n- Anna bokar möte" });
    const r = await proposeActionsFromMinutes(t.db, fake(ITEMS), doc);
    expect(r).toEqual({ created: 2, skipped: 0 });
    const rows = await t.db.select().from(actions);
    expect(rows.every((a) => a.status === "foreslagen" && a.source === "protokoll" && a.documentId === doc.id && a.projectId === p.id)).toBe(true);
    expect(rows.find((a) => a.title === "Boka möte med kommunen")).toMatchObject({ owner: "Anna", dueDate: "2026-12-01" });
  });

  it("re-running on same minutes creates nothing", async () => {
    await seedProject(t.db);
    const doc = await seedDoc(t.db, { docType: "minutes", markdown: "x" });
    await proposeActionsFromMinutes(t.db, fake(ITEMS), doc);
    expect(await proposeActionsFromMinutes(t.db, fake(ITEMS), doc)).toEqual({ created: 0, skipped: 2 });
    expect(await t.db.$count(actions)).toBe(2);
  });

  it("rejected proposal is not recreated", async () => {
    await seedProject(t.db);
    const doc = await seedDoc(t.db, { docType: "minutes", markdown: "x" });
    await proposeActionsFromMinutes(t.db, fake(ITEMS), doc);
    await t.db.update(actions).set({ status: "avvisad" }).where(eq(actions.title, "Skicka PQ-underlag"));
    await t.db.delete(actions).where(eq(actions.title, "Boka möte med kommunen"));
    const r = await proposeActionsFromMinutes(t.db, fake(ITEMS), doc);
    expect(r).toEqual({ created: 1, skipped: 1 });
  });

  it("reworded whitespace/punctuation maps to same key", () => {
    expect(actionKey("f1", { title: "Boka möte, med kommunen!", owner: "Anna" })).toBe(
      actionKey("f1", { title: "  boka   möte med KOMMUNEN ", owner: "Anna" }),
    );
    expect(actionKey("f1", { title: "Boka möte", owner: "Anna" })).not.toBe(actionKey("f2", { title: "Boka möte", owner: "Anna" }));
  });

  it("skips when no project or no markdown", async () => {
    const doc = await seedDoc(t.db, { docType: "minutes", markdown: "x" });
    const ex = fake(ITEMS);
    expect(await proposeActionsFromMinutes(t.db, ex, doc)).toEqual({ created: 0, skipped: 0 });
    expect(ex.calls).toBe(0);
  });
});

describe("buildMinutesHook", () => {
  it("when AI_ENABLED=false sync never constructs extractor", () => {
    const factory = vi.fn();
    expect(buildMinutesHook(t.db, { AI_ENABLED: "false", ANTHROPIC_API_KEY: "x" }, factory)).toBeUndefined();
    expect(buildMinutesHook(t.db, {}, factory)).toBeUndefined();
    expect(factory).not.toHaveBeenCalled();
  });

  it("when AI_ENABLED=true constructs extractor with configured model", () => {
    const factory = vi.fn().mockReturnValue(fake([]));
    const hook = buildMinutesHook(t.db, { AI_ENABLED: "true", ANTHROPIC_API_KEY: "k" }, factory);
    expect(typeof hook).toBe("function");
    expect(factory).toHaveBeenCalledWith("k", "claude-opus-5-5");
  });

  it("AI_ENABLED=true without key throws a clear error", () => {
    expect(() => buildMinutesHook(t.db, { AI_ENABLED: "true" }, vi.fn())).toThrow(/ANTHROPIC_API_KEY/);
  });
});
