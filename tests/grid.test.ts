import { describe, expect, it } from "vitest";
import { EMPTY_RARITY, cellRarity, rarityToScore, scoreToRarity, GUESSES, MAX_CELL, MIN_CELL, OWN_KINDS, cell, cellPoints, dayGrid, gridData } from "@/lib/core/grid";
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
    // An answer outside the finished-season list ranks among them without moving anyone else.
    expect(cellPoints(["a", "b"], { ...fame, n: 0 }, "n")).toBe(100);
    expect(cellPoints(["a", "b", "c"], fame, "b")).toBe(cellPoints(["a", "b", "c"], { ...fame, extra: 0.3 }, "b"));
  });
  it("the same answer scores the same all season: fame and the ranked list ignore this season", () => {
    const shrunk = { ...TRASH, extras: { ...TRASH.extras, seasons: TRASH.extras.seasons.map((x, i, all) => (i === all.length - 1 ? { ...x, guys: {}, added: {} } : x)) } };
    const a = gridData(TRASH);
    const b = gridData(shrunk);
    for (const [p, f] of Object.entries(b.fame)) if (a.fame[p] !== undefined && TRASH.extras.seasons.slice(0, -1).some((x) => Object.values(x.guys).some((g) => g[p]))) expect(a.fame[p], p).toBe(f);
  });
  it("stays a reasonable size to send to the page", () => {
    expect(JSON.stringify(data).length).toBeLessThan(250_000);
  });
});

describe("Starting Nine rarity", () => {
  it("famous answers read high, deep cuts low, spread out between", async () => {
    const { RARITY_TOP, RARITY_FLOOR } = await import("@/lib/core/grid");
    const ids = Array.from({ length: 81 }, (_, i) => `p${i}`);
    const fame = Object.fromEntries(ids.map((p, i) => [p, 1 - i / 80]));
    const r = ids.map((p) => cellRarity(ids, fame, p));
    expect(r[0]).toBe(RARITY_TOP);
    expect(r[80]).toBe(RARITY_FLOOR);
    expect(r[40]).toBeGreaterThan(3); // the middle answer is a few percent, not crowded near the floor
    expect(r[40]).toBeLessThan(6);
    for (let i = 1; i < r.length; i++) expect(r[i]).toBeLessThanOrEqual(r[i - 1]);
    // An answer added later in the season doesn't move anyone already on the list.
    expect(cellRarity(ids, fame, "p10")).toBe(cellRarity(ids, { ...fame, late: 0.5 }, "p10"));
  });
  it("totals run 0 to 900 (empty = 100) and round-trip through the standings score", () => {
    expect(EMPTY_RARITY * 9).toBe(900);
    for (const x of [0, 12.3, 456.7, 900]) expect(scoreToRarity(rarityToScore(x))).toBeCloseTo(x, 5);
    expect(rarityToScore(10)).toBeGreaterThan(rarityToScore(20)); // lower rarity ranks higher
  });
});
