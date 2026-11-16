import "server-only";
import { analyse } from "@/lib/app/analysis";
import { buildDataset } from "@/lib/app/dataset";
import { db } from "@/lib/app/db";
import type { SeasonBundle } from "@/lib/app/family";
import type { WeekData } from "@/lib/app/replay";
import { playerDirectory, yahooIndex, type PlayerDir } from "@/lib/app/sleeper-cache";
import type { Dataset } from "@/lib/core/types";
import { convertSeason, type YSeasonRaw } from "@/lib/yahoo/adapter";
import { draftResults, gameWeeks, leagueSettings, scoreboard, standings, teamWeek, transactions, type YLeague } from "@/lib/yahoo/api";

/**
 * Importing a Yahoo football league with one member's token: find every season (Yahoo's "renew"
 * chain), then fetch and convert one season per step (a few hundred calls each), then grade them all
 * with the same code as Sleeper leagues. Stored in yahoo_leagues, readable only by its members.
 */
export type YahooRow = {
  id: string;
  name: string;
  members: string[];
  seasons: string[];
  parts: Record<string, { bundle: SeasonBundle; weeks: WeekData[]; regEnd: number; names: Record<string, [string, string[]]> }>;
  dataset: Dataset | null;
  status: "importing" | "ready" | "error";
  error: string | null;
  updated_at: Date;
};

export async function yahooLeague(id: string): Promise<YahooRow | null> {
  const sql = await db();
  const [row] = await sql<YahooRow[]>`select * from yahoo_leagues where id = ${id}`;
  return row ?? null;
}

/** Leagues (by newest key) this Yahoo user is a member of, among those already imported. */
export async function importedFor(guid: string) {
  const sql = await db();
  return sql<{ id: string; name: string; status: string }[]>`select id, name, status from yahoo_leagues where ${guid} = any(members) order by updated_at desc`;
}

const isFootballPoints = (l: YLeague) => l.scoring === "headpoint";

/** Start (or restart) importing a league the member chose. Returns the stored id (newest season's key). */
export async function startImport(token: string, guid: string, key: string, ack: string): Promise<{ id: string } | { error: string }> {
  const first = await leagueSettings(token, key);
  if (!isFootballPoints(first.meta)) return { error: "Only head-to-head points leagues work for now (not categories or roto)." };
  const teams = await standings(token, key);
  if (!teams.some((t) => t.guid === guid)) return { error: "You're not a manager in that league." };
  // Walk back through earlier seasons (the same league renewed each year), oldest first.
  const keys = [key];
  let prev = first.meta.renew;
  for (let i = 0; prev && i < 15; i++) {
    try {
      const s = await leagueSettings(token, prev);
      keys.unshift(prev);
      prev = s.meta.renew;
    } catch {
      break; // a season this member can't read ends the chain
    }
  }
  const sql = await db();
  await sql`
    insert into yahoo_leagues (id, name, members, seasons, status, use_ack)
    values (${key}, ${first.meta.name}, ${[guid]}, ${sql.json(keys)}, 'importing', ${ack})
    on conflict (id) do update set seasons = excluded.seasons, name = excluded.name, status = 'importing', error = null, updated_at = now(),
      members = (select array(select distinct unnest(yahoo_leagues.members || ${[guid]}::text[])))`;
  return { id: key };
}

/** Fetch one season into Yahoo-neutral raw form. */
async function fetchSeason(token: string, key: string): Promise<YSeasonRaw> {
  const s = await leagueSettings(token, key);
  const [teams, picks, txns, calendar] = await Promise.all([
    standings(token, key),
    draftResults(token, key).catch(() => []),
    transactions(token, key).catch(() => []),
    gameWeeks(token, s.gameKey).catch(() => []),
  ]);
  const status = s.meta.finished ? "complete" : s.draftDone && s.currentWeek >= s.startWeek ? "in_season" : "pre_draft";
  const weeks: YSeasonRaw["weeks"] = [];
  if (status !== "pre_draft")
    for (let w = s.startWeek; w <= s.endWeek; w++) {
      const matchups = await scoreboard(token, key, w);
      // Only finished weeks: scores and lineups are final.
      if (!matchups.length || matchups.some((m) => !m.final)) break;
      const rosters: Record<string, Awaited<ReturnType<typeof teamWeek>>> = {};
      await Promise.all(teams.map(async (t) => (rosters[t.key] = await teamWeek(token, t.key, w))));
      weeks.push({ week: w, matchups, rosters });
    }
  return {
    key,
    name: s.meta.name,
    season: s.meta.season,
    finished: s.meta.finished,
    status,
    startWeek: s.startWeek,
    endWeek: s.endWeek,
    playoffStart: s.usesPlayoff ? s.playoffStart : 0,
    playoffTeams: s.playoffTeams,
    positions: s.positions,
    teams,
    weeks,
    picks,
    txns,
    calendar,
  };
}

/**
 * One import step: the next season not yet stored (or, with `refresh`, the newest season again).
 * When every season is in, grade them all into the league's dataset.
 */
export async function importStep(token: string, id: string, refresh = false): Promise<{ done: number; total: number; ready: boolean }> {
  const row = await yahooLeague(id);
  if (!row) throw new Error("not imported");
  const sql = await db();
  const todo = refresh ? row.seasons[row.seasons.length - 1] : row.seasons.find((k) => !row.parts[k]);
  if (todo) {
    const [raw, idx, dir] = await Promise.all([fetchSeason(token, todo), yahooIndex().catch(() => ({})), playerDirectory("nfl").catch(() => ({}) as PlayerDir)]);
    const conv = convertSeason(raw, idx, dir);
    const members = raw.teams.map((t) => t.guid);
    await sql`
      update yahoo_leagues set
        parts = parts || ${sql.json({ [todo]: conv } as never)},
        members = (select array(select distinct unnest(members || ${members}::text[]))),
        updated_at = now()
      where id = ${id}`;
  }
  const fresh = (await yahooLeague(id))!;
  const done = fresh.seasons.filter((k) => fresh.parts[k]).length;
  if (done < fresh.seasons.length) return { done, total: fresh.seasons.length, ready: false };
  await grade(fresh);
  return { done, total: fresh.seasons.length, ready: true };
}

/** Grade every stored season with the shared Sleeper pipeline and save the dataset. */
async function grade(row: YahooRow) {
  const parts = row.seasons.map((k) => row.parts[k]).filter(Boolean);
  const inputs = parts.map((p) => ({ bundle: p.bundle, weeks: p.weeks, regEnd: p.regEnd }));
  const a = analyse(inputs);
  const dir = await playerDirectory("nfl").catch(() => ({}) as PlayerDir);
  // Players Sleeper doesn't know, under their Yahoo names.
  const all: PlayerDir = { ...dir };
  for (const p of parts) for (const [pid, [name, pos]] of Object.entries(p.names)) all[pid] ??= [name, pos, "", 0, ""];
  const ds = buildDataset(parts[parts.length - 1]?.bundle.league.name ?? row.name, inputs, a, new Map(), all);
  const sql = await db();
  await sql`update yahoo_leagues set dataset = ${sql.json({ ...ds, sport: "nfl" } as never)}, status = 'ready', error = null, updated_at = now() where id = ${row.id}`;
}

export async function failImport(id: string, message: string) {
  const sql = await db();
  await sql`update yahoo_leagues set status = 'error', error = ${message.slice(0, 200)}, updated_at = now() where id = ${id}`;
}

/** Remove a league (a manager in its newest season can; any manager can bring it back later). */
export async function removeYahooLeague(id: string, guid: string): Promise<boolean> {
  const row = await yahooLeague(id);
  const newest = row?.seasons[row.seasons.length - 1];
  const current = newest ? (row?.parts[newest]?.bundle.users.map((u) => u.user_id) ?? []) : [];
  if (!row || !current.includes(guid)) return false;
  const sql = await db();
  await sql`delete from yahoo_leagues where id = ${id}`;
  return true;
}
