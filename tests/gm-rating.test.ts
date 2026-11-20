import { describe, expect, it } from "vitest";
import { GM_SKILLS, GM_WEIGHTS, gmRatings, gradeOf } from "@/lib/core/gm-rating";
import { TRASH } from "@/lib/extras";

describe("GM rating", () => {
  const rows = gmRatings(TRASH);
  it("rates every active manager once, ranked 1..n by the blend", () => {
    expect(rows.length).toBe(TRASH.league.seasons[TRASH.league.seasons.length - 1].standings.length);
    expect(rows.map((r) => r.rank)).toEqual(rows.map((_, i) => i + 1));
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].rating).toBeGreaterThanOrEqual(rows[i].rating);
  });
  it("weights add to 1 and skill scores sit on 1..99 around 50", () => {
    expect(GM_SKILLS.reduce((t, k) => t + GM_WEIGHTS[k], 0)).toBeCloseTo(1, 9);
    for (const r of rows) for (const k of GM_SKILLS) expect(r.scores[k]).toBeGreaterThanOrEqual(1);
    const avg = (k: (typeof GM_SKILLS)[number]) => rows.reduce((t, r) => t + r.scores[k], 0) / rows.length;
    for (const k of GM_SKILLS) expect(Math.abs(avg(k) - 50)).toBeLessThan(6);
  });
  it("grades follow the rating", () => {
    expect(gradeOf(85)).toBe("A+");
    expect(gradeOf(50)).toBe("C+");
    expect(gradeOf(10)).toBe("F");
  });
});
