import "server-only";
import { earliestTotals, verifiedWeeks, type OfficialSnap } from "@/lib/core/official";
import { cacheLife } from "next/cache";
import { db, hasDb } from "@/lib/app/db";
import { sleeper } from "@/lib/app/sleeper";
import * as coreFO from "@/lib/core/front-office";
import * as coreLive from "@/lib/core/live";
import * as corePower from "@/lib/core/power";
import * as coreStandings from "@/lib/core/standings";
import type { LiveSource } from "@/lib/core/live-source";
import type { Sport } from "@/lib/core/sport";
import type { Dataset, Standing } from "@/lib/core/types";

/**
 * The Trash site's live features for any Rafterlore league: the live table, this week's pairings,
 * the waiver wire, the front office and power rankings. Every Sleeper call goes through the
 * shared throttle; league-independent responses (box scores, projections, trending players) are
 * shared between leagues for a few minutes, so ten leagues don't fetch the same stats ten times.
 */
const SHARED = /^\/(stats|projections)\/|^\/v1\/players\/(nba|nfl)\/trending|^\/v1\/state\//;
const memo = new Map<string, { at: number; p: Promise<unknown> }>();
const get = <T,>(path: string): Promise<T> => {
  if (!SHARED.test(path)) return sleeper<T>(path);
  const hit = memo.get(path);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.p as Promise<T>;
  const p = sleeper<T>(path);
  p.catch(() => memo.delete(path));
  memo.set(path, { at: Date.now(), p });
  while (memo.size > 40) memo.delete(memo.keys().next().value!);
  return p;
};
const source = (leagueId: string, sport: Sport = "nba"): LiveSource => ({ leagueId, get, idOf: (u) => u.user_id, sport });

/** The nightly official snapshots, per manager. */
async function officialSnaps(leagueId: string): Promise<OfficialSnap[]> {
  "use cache: remote";
  cacheLife("minutes");
  if (!hasDb()) return [];
  const sql = await db();
  const rows = await sql<{ owner_id: string | null; roster_id: number; weeks_done: number; pf: string; pa: string | null; taken_on: Date | string }[]>`
    select owner_id, roster_id, weeks_done, pf, pa, taken_on from pf_snapshots where league_id = ${leagueId}`;
  return rows.map((r) => ({
    key: r.owner_id ?? `r${r.roster_id}`,
    weeksDone: r.weeks_done,
    pf: Number(r.pf),
    pa: r.pa === null ? null : Number(r.pa),
    day: typeof r.taken_on === "string" ? r.taken_on : r.taken_on.toISOString().slice(0, 10),
  }));
}

/** Official points-for totals after k finished weeks, per manager (earliest snapshot of each). */
async function snapshotTotals(leagueId: string): Promise<Record<number, Record<string, number>>> {
  const out: Record<number, Record<string, number>> = {};
  for (const [k, m] of earliestTotals(await officialSnaps(leagueId))) for (const [key, s] of m) (out[k] ??= {})[key] = s.pf;
  return out;
}

export async function liveTable(leagueId: string, fallback: Standing[], sport: Sport = "nba") {
  "use cache: remote";
  cacheLife("minutes");
  const totals = await snapshotTotals(leagueId).catch(() => ({}) as Record<number, Record<string, number>>);
  return coreStandings.liveStandings(source(leagueId, sport), fallback, (k) => totals[k] ?? null);
}

export async function pairings(leagueId: string, sport: Sport = "nba") {
  "use cache: remote";
  cacheLife("minutes");
  return coreLive.weekPairings(source(leagueId, sport));
}

export async function waivers(leagueId: string, sport: Sport = "nba") {
  "use cache: remote";
  cacheLife("minutes");
  return coreLive.waiverIntel(source(leagueId, sport));
}

export async function frontOffice(leagueId: string, sport: Sport = "nba") {
  "use cache: remote";
  cacheLife("hours");
  return coreFO.frontOffice(source(leagueId, sport));
}

/** Power rankings: live table + front office + this season's lineups + exact weekly scores. */
export async function power(leagueId: string, d: Dataset, sport: Sport = "nba") {
  const cur = d.league.seasons[d.league.seasons.length - 1];
  const [{ rows: table, week }, fo, snaps] = await Promise.all([
    liveTable(leagueId, cur.standings, sport),
    frontOffice(leagueId, sport),
    officialSnaps(leagueId).catch(() => [] as OfficialSnap[]),
  ]);
  // Only proven weekly scores (core/official.ts); a week with any team unproven sits out.
  const verified = verifiedWeeks(snaps);
  const officialWeek = (w: number) => {
    const m = verified.get(w);
    return m && m.size === table.length ? m : null;
  };
  const lines = d.extras.seasons[d.extras.seasons.length - 1]?.lineups ?? {};
  const nick = (id: string) => d.league.managers.find((m) => m.id === id)?.nick ?? id;
  return corePower.powerRankings({ table, week, fo, lines, officialWeek, nick });
}
