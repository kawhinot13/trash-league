import { describe, expect, it } from "vitest";
import { dailyPrompts, divePool, extendCalendar, PINNED_DAYS, renameCalendar, RESTART } from "@/lib/core/dive";
import { TRASH } from "@/lib/extras";
import { packDataset } from "@/packs/view";

const pool = divePool(TRASH);
const addDays = (d: string, k: number) => new Date(Date.parse(`${d}T12:00:00Z`) + k * 86_400_000).toISOString().slice(0, 10);

describe("Dumpster Dive calendar", () => {
  it("every hand-picked question exists in Trash's pool, so pinned days can't silently change", () => {
    for (const [day, qs] of Object.entries(PINNED_DAYS))
      for (const t of qs) expect(pool.some((q) => q.prompt === t), `${day}: ${t}`).toBe(true);
  });

  it("a pinned day comes out exactly as picked", () => {
    const cal = extendCalendar(pool, {}, "2026-11-18", 5);
    for (const day of Object.keys(PINNED_DAYS).filter((d) => d >= RESTART)) expect(cal[day]).toEqual([...PINNED_DAYS[day]]);
  });

  it("never repeats a category within a day, and a question waits more than 10 days", () => {
    const cal = extendCalendar(pool, {}, "2026-11-18", 60);
    const last = new Map<string, number>();
    const days = Object.keys(cal).filter((d) => d >= RESTART).sort();
    days.forEach((day, n) => {
      const qs = dailyPrompts(pool, day, cal);
      expect(qs.length).toBe(5);
      expect(new Set(qs.map((q) => q.kind)).size, day).toBe(5);
      for (const q of qs) {
        if (last.has(q.prompt)) expect(n - last.get(q.prompt)!, `${day}: ${q.prompt}`).toBeGreaterThan(10);
        last.set(q.prompt, n);
      }
    });
  });

  it("asks NBA-team questions regularly", () => {
    const cal = extendCalendar(pool, {}, "2026-11-18", 30);
    const nba = Object.keys(cal).filter((d) => d >= RESTART && dailyPrompts(pool, d, cal).some((q) => q.kind === "NBA teams"));
    expect(nba.length).toBeGreaterThanOrEqual(5);
  });

  it("renaming a league keeps every day already shown, reworded", () => {
    // A league that went by Sleeper's long name: the same data called "Trash Season 4".
    const long = { ...TRASH, name: "Trash Season 4" };
    const oldPool = divePool(long);
    const cal = extendCalendar(oldPool, {}, "2026-11-20", 5);
    const today = "2026-11-20";
    const moved = renameCalendar(oldPool, pool, cal, today);
    for (let d = RESTART; d <= today; d = addDays(d, 1)) {
      const before = dailyPrompts(oldPool, d, cal).map((q) => q.prompt.replaceAll("Trash Season 4", "Trash"));
      expect(dailyPrompts(pool, d, moved).map((q) => q.prompt)).toEqual(before);
    }
    expect(Object.keys(moved).every((d) => d <= today)).toBe(true);
  });

  it("a pack's names apply to the league name only once its calendar uses them", () => {
    const pack = { nicknames: {}, leagueName: "Trash" };
    const long = { ...TRASH, name: "Trash Season 4" };
    expect(packDataset(long, pack).name).toBe("Trash Season 4");
    expect(packDataset({ ...long, diveNames: 2 }, pack).name).toBe("Trash");
  });
});
