import "server-only";
import { cacheLife } from "next/cache";
import { db, hasDb } from "@/lib/app/db";
import { sleeper } from "@/lib/app/sleeper";
import * as coreFO from "@/lib/core/front-office";
import * as coreLive from "@/lib/core/live";
import * as corePower from "@/lib/core/power";
import * as coreStandings from "@/lib/core/standings";
import type { LiveSource } from "@/lib/core/live-source";
import type { Dataset, Standing } from "@/lib/core/types";

/**
 * The Trash site's live features for any Rafterlore league: the live table, this week's pairings,
 * the waiver wire, the front office and power rankings. Every Sleeper call goes through the
 * shared throttle; league-independent responses (box scores, projections, trending players) are
 * shared between leagues for a few minutes, so ten leagues don't fetch the same stats ten times.
 */
const SHARED = /^\/(stats|projections)\/|^\/v1\/players\/nba\/trending|^\/v1\/state\//;
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
const source = (leagueId: string): LiveSource => ({ leagueId, get, idOf: (u) => u.user_id });

/** Official points-for totals after k finished weeks, per manager, from the nightly snapshots. */
async function snapshotTotals(leagueId: string): Promise<Record<number, Record<string, number>>> {
  "use cache: remote";
  cacheLife("minutes");
  if (!hasDb()) return {};
  const sql = await db();
  const rows = await sql<{ owner_id: string | null; roster_id: number; weeks_done: number; pf: string }[]>`
    select distinct on (roster_id, weeks_done) owner_id, roster_id, weeks_done, pf from pf_snapshots
    where league_id = ${leagueId} order by roster_id, weeks_done, taken_on desc`;
  const out: Record<number, Record<string, number>> = {};
  for (const r of rows) (out[r.weeks_done] ??= {})[r.owner_id ?? `r${r.roster_id}`] = Number(r.pf);
  return out;
}

export async function liveTable(leagueId: string, fallback: Standing[]) {
  "use cache: remote";
  cacheLife("minutes");
  const totals = await snapshotTotals(leagueId).catch(() => ({}) as Record<number, Record<string, number>>);
  return coreStandings.liveStandings(source(leagueId), fallback, (k) => totals[k] ?? null);
}

export async function pairings(leagueId: string) {
  "use cache: remote";
  cacheLife("minutes");
  return coreLive.weekPairings(source(leagueId));
}

export async function waivers(leagueId: string) {
  "use cache: remote";
  cacheLife("minutes");
  return coreLive.waiverIntel(source(leagueId));
}

export async function frontOffice(leagueId: string) {
  "use cache: remote";
  cacheLife("hours");
  return coreFO.frontOffice(source(leagueId));
}

/** Power rankings: live table + front office + this season's lineups + exact weekly scores. */
export async function power(leagueId: string, d: Dataset) {
  const cur = d.league.seasons[d.league.seasons.length - 1];
  const [{ rows: table, week }, fo, totals] = await Promise.all([
    liveTable(leagueId, cur.standings),
    frontOffice(leagueId),
    snapshotTotals(leagueId).catch(() => ({}) as Record<number, Record<string, number>>),
  ]);
  const officialWeek = (w: number) => {
    const a = totals[w];
    const b = w === 1 ? {} : totals[w - 1];
    if (!a || !b) return null;
    return new Map(Object.entries(a).map(([id, pf]) => [id, Math.round((pf - (b[id] ?? 0)) * 10) / 10]));
  };
  const lines = d.extras.seasons[d.extras.seasons.length - 1]?.lineups ?? {};
  const nick = (id: string) => d.league.managers.find((m) => m.id === id)?.nick ?? id;
  return corePower.powerRankings({ table, week, fo, lines, officialWeek, nick });
}
