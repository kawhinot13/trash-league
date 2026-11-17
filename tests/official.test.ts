import { describe, expect, it } from "vitest";
import { earliestTotals, verifiedWeeks, type OfficialSnap } from "@/lib/core/official";

/** Two finished-week captures for a four-team league: A beat B 400-400ish, C beat D. */
const after3 = { A: [600, 500], B: [500, 600], C: [400, 400], D: [400, 400] } as Record<string, [number, number]>;
const after4 = { A: [1000, 900], B: [900, 1000], C: [800, 700], D: [700, 800] } as Record<string, [number, number]>;
const snaps = (before: Record<string, [number, number]>, day3 = "2026-11-09"): OfficialSnap[] => [
  ...Object.entries(before).map(([key, [pf, pa]]) => ({ key, weeksDone: 3, pf, pa, day: day3 })),
  ...Object.entries(after4).map(([key, [pf, pa]]) => ({ key, weeksDone: 4, pf, pa, day: "2026-11-16" })),
];

describe("official weekly scores", () => {
  it("keeps a week when points for match the opponent's points against", () => {
    const w = verifiedWeeks(snaps(after3)).get(4)!;
    expect(Object.fromEntries(w)).toEqual({ A: 400, B: 400, C: 400, D: 300 });
  });

  it("drops a team whose total was rewritten mid-week, and its opponent (the Junkyard Dog bug)", () => {
    const bad = { ...after3, A: [696, 500] as [number, number] }; // 96 of week 4's points already in "after week 3"
    const w = verifiedWeeks(snaps(bad)).get(4)!;
    expect(w.has("A")).toBe(false);
    expect(w.has("B")).toBe(false);
    expect(Object.fromEntries(w)).toEqual({ C: 400, D: 300 });
  });

  it("uses the earliest capture of a week, not a later polluted one", () => {
    const later: OfficialSnap = { key: "A", weeksDone: 3, pf: 696, pa: 500, day: "2026-11-15" };
    const w = verifiedWeeks([...snaps(after3), later]).get(4)!;
    expect(w.get("A")).toBe(400);
    expect(earliestTotals([...snaps(after3), later]).get(3)!.get("A")!.pf).toBe(600);
  });

  it("can't prove anything without points against", () => {
    const noPa = snaps(after3).map((s) => (s.weeksDone === 3 ? { ...s, pa: null } : s));
    expect(verifiedWeeks(noPa).get(4)).toBeUndefined();
  });

  it("week 1 needs no earlier capture", () => {
    const w1: OfficialSnap[] = [
      { key: "A", weeksDone: 1, pf: 120, pa: 100, day: "d" },
      { key: "B", weeksDone: 1, pf: 100, pa: 120, day: "d" },
    ];
    expect(Object.fromEntries(verifiedWeeks(w1).get(1)!)).toEqual({ A: 120, B: 100 });
  });

  it("never fills in a week with a missing earlier capture", () => {
    expect(verifiedWeeks(snaps(after3)).get(3)).toBeUndefined();
  });
});
