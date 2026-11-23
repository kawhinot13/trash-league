import { describe, expect, it } from "vitest";
import { evenMargin, replacementLevel, weekValue } from "@/lib/core/trade-value";

describe("trade value over replacement", () => {
  it("replacement is the Nth best average, N = every roster spot league-wide", () => {
    const players = Array.from({ length: 30 }, (_, i) => ({ avg: 100 - i, n: 5 }));
    expect(replacementLevel(players, 10)).toBe(91); // 10th best
  });
  it("ignores one-week wonders when enough players have 2+ lock-ins", () => {
    const players = [{ avg: 200, n: 1 }, ...Array.from({ length: 12 }, (_, i) => ({ avg: 60 - i, n: 4 }))];
    expect(replacementLevel(players, 3)).toBe(58);
  });
  it("early in a season (too few players to fill every roster spot) uses last season's line", () => {
    const few = [{ avg: 60, n: 3 }, { avg: 20, n: 2 }];
    expect(replacementLevel(few, 5, 41)).toBe(41);
    expect(replacementLevel(few, 5)).toBe(20); // no prior: the lowest qualifying average
    expect(replacementLevel([], 5)).toBe(0);
  });
  it("a star beats two depth pieces just above the waiver line", () => {
    const repl = 45;
    const depth = weekValue(50, repl) + weekValue(50, repl);
    const star = weekValue(65, repl);
    expect(depth).toBe(10);
    expect(star).toBe(20);
    expect(star).toBeGreaterThan(depth);
  });
  it("a player below the waiver line is worth zero, not negative", () => {
    expect(weekValue(30, 45)).toBe(0);
  });
  it("even is 1.5 weeks of an average starter's edge, at least 5", () => {
    expect(evenMargin(58, 45)).toBe(20);
    expect(evenMargin(46, 45)).toBe(5);
  });
});
