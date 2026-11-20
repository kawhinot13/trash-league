import { describe, expect, it } from "vitest";
import { bracketOrder, forecast, lineupIndex, titleLine } from "@/lib/core/forecast";
import { TRASH } from "@/lib/extras";
import type { Standing } from "@/lib/core/types";

const team = (manager: string, w: number, l: number, pf: number): Standing => ({ manager, team: manager, w, l, t: 0, pf, seed: 0 });
const line = { line: 105, lineupLine: 105, champs: [], cv: 0.1 };

describe("The Forecast", () => {
  it("builds a standard bracket (1 v 8, 4 v 5, 2 v 7, 3 v 6)", () => {
    expect(bracketOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(bracketOrder(4)).toEqual([1, 4, 2, 3]);
  });
  it("lineup index is 100 at the league average", () => {
    const idx = lineupIndex({ a: [[1, 90, 120]], b: [[1, 80, 80]] });
    expect(idx.get("a")).toBeCloseTo(120, 5);
    expect(idx.get("b")).toBeCloseTo(80, 5);
  });
  it("chances add up: one champion per run, playoff spots filled every run", () => {
    const ids = ["a", "b", "c", "d", "e", "f"];
    const table = ids.map((m, i) => team(m, 3 - (i % 3), i % 3, 1000 - i * 20));
    const lineup = new Map(ids.map((m, i) => [m, 300 - i * 15]));
    const schedule: [number, string, string][] = [];
    for (let w = 5; w <= 10; w++) for (let k = 0; k < 3; k++) schedule.push([w, ids[(k + w) % 6], ids[(k + w + 3) % 6]]);
    const f = forecast({ table, lineup, schedule, regWeeks: 10, playoffTeams: 4, line, runs: 2000 });
    expect(f.rows.reduce((s, r) => s + r.title, 0)).toBeCloseTo(1, 5);
    expect(f.rows.reduce((s, r) => s + r.playoffs, 0)).toBeCloseTo(4, 5);
    // The strongest roster with the best results is the favorite.
    expect(f.rows[0].id).toBe("a");
    expect(f.rows.find((r) => r.id === "a")!.clears).toBe(true);
  });
  it("is deterministic", () => {
    const table = ["a", "b"].map((m) => team(m, 1, 1, 200));
    const args = { table, lineup: new Map([["a", 110], ["b", 90]]), schedule: [[3, "a", "b"]] as [number, string, string][], regWeeks: 3, playoffTeams: 2, line, runs: 500 };
    expect(forecast(args)).toEqual(forecast(args));
  });
  it("Trash's title line comes from its champions", () => {
    const t = titleLine(TRASH);
    expect(t.champs.length).toBeGreaterThan(0);
    expect(t.line).toBe(Math.min(...t.champs.map((c) => c.scoring)));
    expect(t.cv).toBeGreaterThan(0.04);
  });
});
