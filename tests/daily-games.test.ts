import { describe, expect, it } from "vitest";
import { dailyPrompts, promptText } from "@/lib/core/dive";
import { cleanState, STATE_NAME } from "@/lib/core/game-state";
import { divePool } from "@/lib/dive";

const pool = divePool();

describe("Dumpster Dive", () => {
  it("every prompt has answers, deepest first, scored 1-100 (only a miss scores 0)", () => {
    expect(pool.length).toBeGreaterThan(20);
    for (const q of pool) {
      expect(q.answers.length).toBeGreaterThan(0);
      for (const [, s] of q.answers) expect(s >= 1 && s <= 100).toBe(true);
      expect(q.answers[q.answers.length - 1][1]).toBe(1);
      expect(q.answers[0][1]).toBe(100);
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
    // From the restart (Nov 18), when every device agrees; earlier days depended on the browser.
    let prev = new Set(dailyPrompts(pool, "2026-11-18").map((q) => q.prompt));
    for (const day of ["2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"]) {
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

describe("Dumpster Dive wording follows the league's lineups", () => {
  it("lock-in leagues (Trash) say locked in; daily say lineup; football keeps started", () => {
    const p = "Name a player who started a playoff game in 2024–25.";
    const m = "Name a player Green Bean has started.";
    expect(promptText(p, undefined)).toBe("Name a player who was locked in for a playoff game in 2024–25.");
    expect(promptText(m, "lock-in")).toBe("Name a player Green Bean has locked in.");
    expect(promptText(m, "daily")).toBe("Name a player Green Bean has had in the lineup.");
    expect(promptText(p, "daily")).toBe("Name a player who was in a playoff lineup in 2024–25.");
    expect(promptText(p, "weekly")).toBe(p);
    expect(promptText("Name a player who was traded in 2024–25.", "lock-in")).toBe("Name a player who was traded in 2024–25.");
  });

  it("every 'started' prompt in Trash's pool gets reworded", () => {
    for (const q of pool) expect(promptText(q.prompt, "lock-in")).not.toMatch(/started/);
  });
});

describe("Dumpster Dive: the same prompts on every device", () => {
  // Engines may sort differently (that's how Chrome and Node disagreed). A different, still valid
  // stable sort must give exactly the same days from the restart on.
  const insertionSort = function <T>(this: T[], cmp?: (a: T, b: T) => number) {
    const c = cmp ?? ((a: T, b: T) => (String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0));
    for (let i = 1; i < this.length; i++) {
      const x = this[i];
      let j = i - 1;
      while (j >= 0 && c(this[j], x) > 0) {
        this[j + 1] = this[j];
        j--;
      }
      this[j + 1] = x;
    }
    return this;
  };
  it("doesn't depend on how the engine sorts", () => {
    const days = ["2026-11-18", "2026-11-19", "2026-11-25", "2026-12-25", "2027-02-01"];
    const normal = days.map((d) => dailyPrompts(pool, d).map((q) => q.prompt));
    const orig = Array.prototype.sort;
    try {
      Array.prototype.sort = insertionSort as typeof orig;
      const other = days.map((d) => dailyPrompts(pool, d).map((q) => q.prompt));
      expect(other).toEqual(normal);
    } finally {
      Array.prototype.sort = orig;
    }
  });
});

describe("Rosterdle names", () => {
  it("from Nov 18 the daily player's last name is always 5-7 letters; earlier days keep theirs", async () => {
    const { trashle } = await import("@/lib/trashle");
    const { sharedPick, FIVE_FROM } = await import("@/lib/core/trashle");
    const { sharedDay } = await import("@/lib/core/daily-pool");
    const { shared } = trashle();
    expect(shared.some((w) => w.word.length === 4)).toBe(true);
    for (let k = 0; k < 400; k++) {
      const day = new Date(Date.parse(`${FIVE_FROM}T12:00:00Z`) + k * 86_400_000).toISOString().slice(0, 10);
      const w = sharedPick(shared, sharedDay(day)!, day)!;
      expect(w.word.length).toBeGreaterThanOrEqual(5);
      expect(w.word.length).toBeLessThanOrEqual(7);
    }
    for (const day of ["2026-11-16", "2026-11-17"]) expect(sharedPick(shared, sharedDay(day)!, day)).toBe(shared[sharedDay(day)! % shared.length]);
  });
});

describe("Dumpster Dive variety", () => {
  const shape = (p: { t?: string; kind: string }) => p.t ?? p.kind;
  it("never asks the same kind of question twice in a day, or the same question within 10 days", () => {
    const last = new Map<string, number>();
    for (let k = 0; k < 90; k++) {
      const day = new Date(Date.parse("2026-11-18T12:00:00Z") + k * 864e5).toISOString().slice(0, 10);
      const qs = dailyPrompts(pool, day);
      expect(qs).toHaveLength(5);
      expect(new Set(qs.map(shape)).size).toBe(5);
      // ...and never two of the same category (what players see, e.g. "Waiver wire").
      expect(new Set(qs.map((q) => q.kind)).size).toBe(5);
      expect(new Set(qs.filter((q) => q.who).map((q) => q.who)).size).toBe(qs.filter((q) => q.who).length);
      for (const q of qs) {
        const l = last.get(q.prompt);
        if (l !== undefined) expect(k - l).toBeGreaterThan(10);
        last.set(q.prompt, k);
      }
    }
  });
});
