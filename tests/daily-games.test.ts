import { describe, expect, it } from "vitest";
import { dailyPrompts } from "@/lib/core/dive";
import { cleanState, STATE_NAME } from "@/lib/core/game-state";
import { divePool } from "@/lib/dive";

const pool = divePool();

describe("Dumpster Dive", () => {
  it("every prompt has answers, deepest first, scored 0-100", () => {
    expect(pool.length).toBeGreaterThan(20);
    for (const q of pool) {
      expect(q.answers.length).toBeGreaterThan(0);
      for (const [, s] of q.answers) expect(s >= 0 && s <= 100).toBe(true);
      for (let i = 1; i < q.answers.length; i++) expect(q.answers[i - 1][1]).toBeGreaterThanOrEqual(q.answers[i][1]);
      expect(new Set(q.answers.map(([pid]) => pid)).size).toBe(q.answers.length);
    }
  });

  it("everyone gets the same five different prompts on a given day", () => {
    for (const day of ["2026-11-16", "2026-11-17", "2026-12-25", "2027-01-31"]) {
      const a = dailyPrompts(pool, day).map((q) => q.prompt);
      expect(a).toHaveLength(5);
      expect(new Set(a).size).toBe(5);
      expect(dailyPrompts(pool, day).map((q) => q.prompt)).toEqual(a);
    }
  });

  it("back-to-back days don't repeat a prompt", () => {
    let prev = new Set(dailyPrompts(pool, "2026-11-16").map((q) => q.prompt));
    for (const day of ["2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"]) {
      const cur = dailyPrompts(pool, day).map((q) => q.prompt);
      for (const p of cur) expect(prev.has(p)).toBe(false);
      prev = new Set(cur);
    }
  });
});

describe("saved daily games (one try a day on every device)", () => {
  it("keeps only the games' own storage names", () => {
    expect(cleanState({ "dive3:2026-11-17": { picks: [] }, "evil:2026-11-17": 1 })).toEqual({ "dive3:2026-11-17": { picks: [] } });
    expect(cleanState({ "trashle:2026-11-17": ["A"], "trashle-hints:2026-11-17": [1] })).not.toBeNull();
    expect(STATE_NAME.test("lineup:2026-11-17")).toBe(true);
    expect(STATE_NAME.test("rl:123:lineup:2026-11-17")).toBe(false);
  });

  it("rejects junk and anything too big", () => {
    expect(cleanState(null)).toBeNull();
    expect(cleanState([1, 2])).toBeNull();
    expect(cleanState({ "other": 1 })).toBeNull();
    expect(cleanState({ "dive3:2026-11-17": "x".repeat(20_000) })).toBeNull();
  });
});
