import { describe, expect, it } from "vitest";
import { TRAP_CONFIG, classify, inside, needed, thresholdsFrom, trapezoidViews } from "@/lib/core/trapezoid";
import { TRASH } from "@/lib/extras";

const champ = (code: string, index: number, win: number) => ({ code, years: code, id: code, index, win, avg: 0, games: 14, seed: 1 });

describe("Trapezoid of Excellence", () => {
  it("uses the provisional window with fewer than 3 champions", () => {
    const th = thresholdsFrom([champ("s1", 120, 0.8)]);
    expect(th.basis).toBe("provisional");
    expect(th.floor).toBe(TRAP_CONFIG.provisionalFloor);
    expect(th.base).toBe(TRAP_CONFIG.provisionalBase);
  });

  it("uses the lowest champion with 3-7 champions, never below the safeguards", () => {
    const th = thresholdsFrom([champ("a", 110, 0.6), champ("b", 104, 0.7), champ("c", 115, 0.55)]);
    expect(th.basis).toBe("lowest");
    expect(th.floor).toBe(104);
    expect(th.base).toBe(0.55);
    const low = thresholdsFrom([champ("a", 95, 0.4), champ("b", 97, 0.42), champ("c", 99, 0.43)]);
    expect(low.floor).toBe(TRAP_CONFIG.minFloor);
    expect(low.base).toBe(TRAP_CONFIG.minBase);
  });

  it("needs less winning the more you score, and nothing below the floor counts", () => {
    const th = thresholdsFrom([]);
    expect(needed(th, th.floor - 1)).toBeNull();
    expect(needed(th, th.floor + 10)!).toBeLessThan(needed(th, th.floor)!);
    expect(inside(th, th.floor, th.base)).toBe(true);
    expect(inside(th, th.floor - 0.1, 1)).toBe(false);
  });

  it("classifies each corner of the chart", () => {
    const th = thresholdsFrom([]);
    expect(classify(th, th.floor + 5, 0.9, false)).toBe("Elite Contender");
    expect(classify(th, th.floor + 20, 0.2, false)).toBe("Sleeping Giant");
    expect(classify(th, 80, 0.9, false)).toBe("Record Merchant");
    expect(classify(th, 80, 0.2, false)).toBe("Outside the Window");
    expect(classify(th, th.floor - 1, th.base, false)).toBe("On the Bubble");
    expect(classify(th, 200, 1, true)).toBe("Small Sample");
  });

  it("a season's window only uses champions from seasons before it (no peeking)", () => {
    const order = TRASH.league.seasons.map((s) => s.code);
    for (const v of trapezoidViews(TRASH).filter((x) => x.kind !== "all")) {
      const at = order.indexOf(v.key.replace(/^(season|current)[:-]?/, "")) ;
      if (at < 0) continue;
      for (const code of v.th.from) expect(order.indexOf(code)).toBeLessThan(at);
    }
  });
});
