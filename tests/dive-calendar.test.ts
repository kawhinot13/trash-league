import { describe, expect, it } from "vitest";
import { BROAD_FROM, dailyPrompts, divePool, extendCalendar, MAX_WHO, PINNED_DAYS, renameCalendar, RESTART } from "@/lib/core/dive";
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

  it("planned days have one NBA-team question and at most two about a single manager", () => {
    const cal = extendCalendar(pool, {}, "2026-11-18", 40);
    for (const d of Object.keys(cal).filter((d) => d >= RESTART && !(d in PINNED_DAYS))) {
      const qs = dailyPrompts(pool, d, cal);
      expect(qs.filter((q) => q.kind === "NBA teams").length, d).toBe(1);
      expect(qs.filter((q) => q.who).length, d).toBeLessThanOrEqual(MAX_WHO);
    }
  });

  it("last week's overused questions stay away for 10 days after the restart", () => {
    const cal = extendCalendar(pool, {}, "2026-11-18", 20);
    const overused = ["Journeymen", "First round", "Late rounds", "Playoffs"];
    let n = 0;
    for (let d = RESTART; d <= addDays(RESTART, 20); d = addDays(d, 1), n++)
      if (d >= BROAD_FROM && n < 10)
        for (const q of dailyPrompts(pool, d, cal)) expect(overused.includes(q.kind), `${d}: ${q.prompt}`).toBe(false);
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
