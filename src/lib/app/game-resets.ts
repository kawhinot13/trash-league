import type { db } from "@/lib/app/db";
import { loadLeague } from "@/lib/app/league-page";
import { logError } from "@/lib/app/safe";
import { dailyPrompts, divePool, rescorePicks } from "@/lib/core/dive";

type Sql = Awaited<ReturnType<typeof db>>;

/**
 * Days whose daily game was reset so everyone can play it again (owner's call). Each runs once: that
 * day's scores are deleted, and every browser clears its saved game for that day (see PlayGate).
 * 2026-11-20: Trash's Dumpster Dive rejected players picked up and dropped mid-week.
 */
const RESETS: { family: string; game: "dive2" | "grid"; day: string }[] = [
  { family: "1020516596416155648", game: "dive2", day: "2026-11-20" },
  // Starting Nine's first grid had too many "whose team" squares; the redone grid replaces it.
  { family: "1020516596416155648", game: "grid", day: "2026-11-20" },
  // Owner: squares too thin and too star-heavy; the remade grid (6+ answers a square, no elite tiers) replaces it.
  { family: "1020516596416155648", game: "grid", day: "2026-11-21" },
];
/** Board ids stored for each game (the dive's board moved from "dive" to "dive2"). */
const STORED: Record<string, string[]> = { dive2: ["dive", "dive2"], grid: ["grid"] };
/** The browser storage names each game saves for a day (and syncs to the account as progress). */
const SAVED_NAMES: Record<string, (day: string) => string[]> = { dive2: (d) => [`dive3:${d}`], grid: (d) => [`grid:${d}`] };

/**
 * One manager re-answers from a given prompt of one day's game (owner's call): their saved game keeps the
 * first `keep` answers. Done once per entry: a finished score is taken off that day's board (so the redone
 * game can post), and the browser trims its saved game (PlayGate, `redos` in `/api/l/[id]/scores?who=1`).
 * 2026-11-21: KawhiNot redoes Dumpster Dive prompt 4.
 */
const REDOS: { family: string; manager: string; game: "dive2"; day: string; keep: number }[] = [
  { family: "1020516596416155648", manager: "1021907649295794176", game: "dive2", day: "2026-11-21", keep: 3 },
];

let applied = false;
async function applyResets(sql: Sql) {
  if (applied) return;
  for (const r of RESETS) {
    const fresh = await sql`
      insert into game_resets (family_id, game, day) values (${r.family}, ${r.game}, ${r.day}::date) on conflict do nothing returning 1`;
    if (fresh.length) {
      await sql`delete from game_scores where family_id = ${r.family} and game in ${sql(STORED[r.game])} and day = ${r.day}::date`;
      await sql`delete from game_progress where family_id = ${r.family} and name in ${sql(SAVED_NAMES[r.game](r.day))}`;
    }
  }
  applied = true;
}

/** The games reset on a day in a league, with a token that changes per reset. */
export async function resetsFor(sql: Sql, familyId: string, day: string): Promise<Record<string, string>> {
  await applyResets(sql);
  const rows = await sql<{ game: string; at: Date }[]>`
    select game, at from game_resets where family_id = ${familyId} and day = ${day}::date and game not like 'rescore%' and game not like 'redo-%'`;
  return Object.fromEntries(rows.map((r) => [r.game, r.at.toISOString()]));
}

/**
 * Once per league (owner's call 2026-11-20): re-score every saved Dumpster Dive with today's answer boards, so
 * the standings match the points the boards now show (the 100-point spread changed them). Only games saved
 * with their answers can be re-scored; a right answer that has left a board keeps its old score.
 */
const rescored = new Set<string>();
export async function rescoreDiveOnce(sql: Sql, leagueId: string, familyId: string): Promise<string> {
  if (rescored.has(familyId)) return "cached";
  const fresh = await sql`
    insert into game_resets (family_id, game, day) values (${familyId}, 'rescore-dive2-b', '2026-11-20'::date) on conflict do nothing returning 1`;
  rescored.add(familyId);
  if (!fresh.length) return "done before";
  try {
    const got = await loadLeague(leagueId, { dataset: true });
    const d = got.status === "ok" ? got.page.dataset : null;
    if (!d) throw new Error("no dataset");
    const pool = divePool(d);
    const rows = await sql<{ manager: string; day: Date; score: number; state: Record<string, unknown> | null }[]>`
      select manager, day, score, state from game_scores where family_id = ${familyId} and game = 'dive2' and state is not null`;
    let changed = 0;
    let skipped = 0;
    for (const r of rows) {
      const day = r.day.toISOString().slice(0, 10);
      const k = `dive3:${day}`;
      const st = r.state?.[k] as { picks?: { pid: string | null; typed: string; score: number | null }[]; qs?: string[]; done?: boolean } | undefined;
      if (!st?.picks?.length) {
        skipped++;
        continue;
      }
      const qs = st.qs?.length ? st.qs : dailyPrompts(pool, day, d.diveCalendar).map((q) => q.prompt);
      const out = rescorePicks(pool, qs, st.picks);
      if (!out) {
        skipped++;
        continue;
      }
      if (out.total === r.score) continue;
      changed++;
      const state = { ...r.state, [k]: { ...st, picks: out.picks } };
      await sql`update game_scores set score = ${out.total}, label = ${out.label.slice(0, 40)}, state = ${sql.json(state as never)}
        where family_id = ${familyId} and game = 'dive2' and day = ${day}::date and manager = ${r.manager}`;
    }
    return `rescored ${changed} of ${rows.length} (skipped ${skipped})`;
  } catch (e) {
    // Try again on a later visit.
    await sql`delete from game_resets where family_id = ${familyId} and game = 'rescore-dive2-b'`;
    rescored.delete(familyId);
    logError(`rescore dive ${familyId}`, e);
    return "failed";
  }
}

/** This manager's redos on a day, applied server-side once each, with a token the browser applies once. */
export async function redosFor(sql: Sql, familyId: string, manager: string | null, day: string): Promise<{ game: string; keep: number; token: string }[]> {
  if (!manager) return [];
  const mine = REDOS.filter((r) => r.family === familyId && r.manager === manager && r.day === day);
  const out: { game: string; keep: number; token: string }[] = [];
  for (const r of mine) {
    const key = `redo-${r.game}-${r.manager}-${r.keep}`;
    const fresh = await sql`insert into game_resets (family_id, game, day) values (${r.family}, ${key}, ${r.day}::date) on conflict do nothing returning 1`;
    if (fresh.length) {
      await sql`delete from game_scores where family_id = ${r.family} and game in ${sql(STORED[r.game])} and day = ${r.day}::date and manager = ${r.manager}`;
      await sql`delete from game_progress where family_id = ${r.family} and manager = ${r.manager} and name in ${sql(SAVED_NAMES[r.game](r.day))}`;
    }
    out.push({ game: r.game, keep: r.keep, token: key });
  }
  return out;
}
