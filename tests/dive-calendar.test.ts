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

describe("NBA-team questions count every team a player has played for", () => {
  it("adds players who used to play for that team", () => {
    const warriors = (d: typeof TRASH) => divePool(d).find((q) => q.prompt.startsWith("Name a Warriors player"))!;
    const before = warriors(TRASH).answers.length;
    // Someone rostered in Trash who isn't on the Warriors now, credited with a past Warriors stint.
    const pid = TRASH.extras.seasons.flatMap((s) => Object.values(s.guys).flatMap((g) => Object.keys(g))).find((p) => TRASH.extras.players[p]?.[2] && TRASH.extras.players[p][2] !== "GSW")!;
    const withPast = { ...TRASH, extras: { ...TRASH.extras, teamsPlayed: { [pid]: ["GSW"] } } };
    expect(warriors(withPast).answers.length).toBe(before + 1);
  });
});

describe("pickups the weekly rosters missed count everywhere", () => {
  it("a player picked up and dropped mid-week is a right answer in every roster question", () => {
    const last = TRASH.extras.seasons.length - 1;
    const cur = TRASH.extras.seasons[last];
    const seen = new Set(TRASH.extras.seasons.flatMap((s) => Object.values(s.guys).flatMap((g) => Object.keys(g))));
    // Someone in the directory with a position and NBA team who was never on a weekly roster.
    const pid = Object.keys(TRASH.extras.players).find((p) => !seen.has(p) && TRASH.extras.players[p]?.[1]?.includes("C") && TRASH.extras.players[p]?.[2])!;
    const m = Object.keys(cur.guys)[0];
    const week = Math.max(...Object.keys(cur.rosters ?? { 1: {} }).map(Number));
    const seasons = TRASH.extras.seasons.map((s, i) => (i === last ? { ...s, added: { [m]: [[pid, week] as [string, number]] } } : s));
    const pool = divePool({ ...TRASH, extras: { ...TRASH.extras, seasons } });
    const has = (pred: (q: (typeof pool)[number]) => boolean) => pool.filter(pred).some((q) => q.answers.some(([p]) => p === pid));
    expect(has((q) => q.kind === "Season rosters" && q.prompt.includes("this season"))).toBe(true);
    expect(has((q) => q.kind === "Positions" && q.prompt.includes("center"))).toBe(true);
    expect(has((q) => q.kind === "NBA teams")).toBe(true);
    expect(has((q) => q.kind === "Waiver wire")).toBe(true);
    if (pool.some((q) => q.kind === "Locker room" && q.who === m && q.prompt.includes("this season")))
      expect(has((q) => q.kind === "Locker room" && q.who === m && q.prompt.includes("this season"))).toBe(true);
    if (pool.some((q) => q.kind === "Cut list" && q.who === m)) expect(has((q) => q.kind === "Cut list" && q.who === m)).toBe(true);
  });
});

describe("100-point answers are spread out", () => {
  it("each prompt still has exactly one 100, and a player is the 100 for few prompts", () => {
    const counts = new Map<string, number>();
    for (const q of pool) {
      expect(q.answers.filter(([, s]) => s === 100).length, q.prompt).toBe(1);
      const top = q.answers.find(([, s]) => s === 100)![0];
      counts.set(top, (counts.get(top) ?? 0) + 1);
    }
    const repeats = [...counts.values()].filter((n) => n > 1).length;
    expect(repeats / pool.length).toBeLessThan(0.05);
  });
  it("no planned day has the same 100-point answer twice", () => {
    const cal = extendCalendar(pool, {}, "2026-11-18", 40);
    for (const d of Object.keys(cal).filter((d) => d >= RESTART)) {
      const tops = dailyPrompts(pool, d, cal).map((q) => q.answers.find(([, s]) => s === 100)![0]);
      expect(new Set(tops).size, d).toBe(tops.length);
    }
  });
});
