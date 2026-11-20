import { describe, expect, it } from "vitest";
import { GUESSES, MAX_CELL, MIN_CELL, OWN_KINDS, cell, cellPoints, dayGrid, gridData } from "@/lib/core/grid";
import { TRASH } from "@/lib/extras";

const data = gridData(TRASH);
const addDays = (d: string, k: number) => new Date(Date.parse(`${d}T12:00:00Z`) + k * 86_400_000).toISOString().slice(0, 10);

describe("Starting Nine", () => {
  it("finds a full grid every day for a month, every square answerable from finished seasons", () => {
    for (let k = 0; k < 30; k++) {
      const g = dayGrid(data, addDays("2026-11-21", k))!;
      expect(g, addDays("2026-11-21", k)).not.toBeNull();
      expect(g.rows.length).toBe(3);
      expect(g.cols.length).toBe(3);
      const six = [...g.rows, ...g.cols];
      expect(six.filter((c) => OWN_KINDS.includes(c.kind)).length).toBeLessThanOrEqual(1);
      expect(new Set(six.map((c) => c.kind)).size).toBe(6);
      for (const a of g.rows) for (const b of g.cols) { expect(cell(a, b).gate).toBeGreaterThanOrEqual(MIN_CELL); expect(cell(a, b).gate).toBeLessThanOrEqual(MAX_CELL); }
    }
    expect(GUESSES).toBe(9);
  });
  it("mostly broad categories: most grids have no 'whose team' square at all", () => {
    let none = 0;
    for (let k = 0; k < 40; k++) if (![...dayGrid(data, addDays("2026-11-21", k))!.rows, ...dayGrid(data, addDays("2026-11-21", k))!.cols].some((c) => OWN_KINDS.includes(c.kind))) none++;
    expect(none).toBeGreaterThanOrEqual(20);
  });
  it("is the same grid all day, and changes between days", () => {
    const a = dayGrid(data, "2026-11-25")!;
    expect(dayGrid(data, "2026-11-25")).toEqual(a);
    const ids = (g: NonNullable<typeof a>) => [...g.rows, ...g.cols].map((c) => c.id).join();
    expect(ids(dayGrid(data, "2026-11-26")!)).not.toBe(ids(a));
  });
  it("this season's new answers can't change the day's grid", () => {
    // Everything this season added removed from the answers (keeping finished seasons): same pick.
    const shrunk = { ...data, criteria: data.criteria.map((c) => ({ ...c, ids: c.gateIds })) };
    for (let k = 0; k < 10; k++) {
      const day = addDays("2026-11-21", k);
      const ids = (g: ReturnType<typeof dayGrid>) => [...g!.rows, ...g!.cols].map((c) => c.id).join();
      expect(ids(dayGrid(shrunk, day))).toBe(ids(dayGrid(data, day)));
    }
  });
  it("deeper answers score more: 10 for the most obvious, 100 for the deepest", () => {
    const fame = { a: 0.9, b: 0.5, c: 0.1 };
    expect(cellPoints(["a", "b", "c"], fame, "a")).toBe(10);
    expect(cellPoints(["a", "b", "c"], fame, "c")).toBe(100);
    expect(cellPoints(["a", "b", "c"], fame, "zzz")).toBe(0);
  });
  it("stays a reasonable size to send to the page", () => {
    expect(JSON.stringify(data).length).toBeLessThan(250_000);
  });
});
