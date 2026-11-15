/**
 * Typed client for Sleeper's public read API (no key needed). Used by the multi-league app only;
 * the Trash site keeps its own fetchers. Every call is uncached here: callers decide caching
 * (the database, or a 'use cache' wrapper).
 */
import { acquire, rateLimited, succeeded } from "@/lib/app/throttle";

export const SLEEPER = "https://api.sleeper.app";

export type Stats = Record<string, number>;

export type SLeague = {
  league_id: string;
  name: string;
  season: string;
  status: "pre_draft" | "drafting" | "in_season" | "complete" | string;
  sport: string;
  avatar: string | null;
  total_rosters: number;
  draft_id: string | null;
  previous_league_id: string | null;
  roster_positions: string[];
  scoring_settings: Stats;
  settings: Record<string, number>;
  metadata?: Record<string, string> | null;
};
export type SUser = {
  user_id: string;
  display_name: string;
  avatar: string | null;
  metadata?: { team_name?: string; avatar?: string } | null;
};
export type SRoster = {
  roster_id: number;
  owner_id: string | null;
  co_owners?: string[] | null;
  players: string[] | null;
  starters?: string[] | null;
  reserve?: string[] | null;
  settings: Record<string, number>;
  metadata?: { record?: string; streak?: string } | null;
};
export type SBracket = {
  r: number;
  m: number;
  t1: number | null;
  t2: number | null;
  w?: number | null;
  l?: number | null;
  p?: number | null;
  t1_from?: { w?: number; l?: number } | null;
  t2_from?: { w?: number; l?: number } | null;
};
export type SPick = {
  pick_no: number;
  round: number;
  roster_id: number;
  player_id: string;
  picked_by: string;
  metadata?: Record<string, string> | null;
};
export type SMatchup = {
  roster_id: number;
  matchup_id: number | null;
  points: number | null;
  players: string[] | null;
  starters: string[] | null;
  starters_points: number[] | null;
};
export type STransaction = {
  transaction_id: string;
  type: "trade" | "free_agent" | "waiver" | "commissioner" | string;
  status: string;
  created: number;
  status_updated?: number | null;
  leg?: number;
  roster_ids?: number[];
  adds: Record<string, number> | null;
  drops: Record<string, number> | null;
  draft_picks?: { season: string; round: number; roster_id: number; owner_id: number; previous_owner_id: number }[] | null;
};
export type SStatRow = {
  player_id: string;
  date: string | null;
  stats: Stats;
  team?: string;
  player?: { first_name?: string; last_name?: string; fantasy_positions?: string[]; team?: string } | null;
};
export type SState = { week: number; season: string; league_season: string; season_type: string; display_week: number };

export class SleeperError extends Error {
  constructor(
    public path: string,
    public status: number,
  ) {
    super(`Sleeper ${path} → ${status}`);
  }
}

/**
 * GET from Sleeper, through the shared throttle (see throttle.ts). Retries network errors and 5xx
 * with backoff; on 429 every instance backs off together. Sleeper answers unknown ids with `null`.
 */
export async function sleeper<T>(path: string, tries = 4): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    await acquire();
    let wait = 400 * 2 ** i;
    try {
      const r = await fetch(`${SLEEPER}${path}`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
      if (r.ok) {
        succeeded();
        return (await r.json()) as T;
      }
      if (r.status === 429) {
        const ra = Number(r.headers.get("retry-after"));
        wait = await rateLimited(Number.isFinite(ra) && ra > 0 ? ra : null);
      } else if (r.status < 500) throw new SleeperError(path, r.status);
      last = new SleeperError(path, r.status);
    } catch (e) {
      if (e instanceof SleeperError && e.status < 500 && e.status !== 429) throw e;
      last = e;
    }
    if (i < tries - 1) await new Promise((res) => setTimeout(res, wait));
  }
  throw last;
}

export const nbaState = () => sleeper<SState>("/v1/state/nba");

/** A user by username or user id. null when no such user. */
export const sleeperUser = (name: string) => sleeper<SUser | null>(`/v1/user/${encodeURIComponent(name.trim())}`);

export const userLeagues = (userId: string, season: string) =>
  sleeper<SLeague[] | null>(`/v1/user/${userId}/leagues/nba/${season}`).then((x) => x ?? []);

/**
 * Sleeper's matchups endpoint can return a different score for the same finished week on different
 * requests. Ask several times and keep each team's highest reported score (with that sample's
 * lineup): against Sleeper's official season totals, the highest variant is by far the closest.
 * Even so these are "per Sleeper" numbers; the official totals live in the nightly snapshots.
 */
export async function consensusMatchups(leagueId: string, week: number, samples = 4): Promise<SMatchup[]> {
  const runs = await Promise.all(
    Array.from({ length: samples }, (_, i) =>
      sleeper<SMatchup[] | null>(`/v1/league/${leagueId}/matchups/${week}?sample=${i}-${Date.now()}`).catch(
        () => null,
      ),
    ),
  );
  const best = new Map<number, SMatchup>();
  for (const rows of runs)
    for (const m of rows ?? []) {
      const cur = best.get(m.roster_id);
      if (!cur || (m.points ?? 0) > (cur.points ?? 0)) best.set(m.roster_id, m);
    }
  if (runs.every((r) => r === null)) throw new Error(`matchups ${leagueId}/${week} unavailable`);
  return [...best.values()].sort((a, b) => a.roster_id - b.roster_id);
}

/** Official totals from a roster: Sleeper stores them as integer + hundredths. */
export const official = (s: Record<string, number>) => ({
  pf: (s.fpts ?? 0) + (s.fpts_decimal ?? 0) / 100,
  pa: (s.fpts_against ?? 0) + (s.fpts_against_decimal ?? 0) / 100,
  ppts: (s.ppts ?? 0) + (s.ppts_decimal ?? 0) / 100,
});

export const avatarUrl = (id: string | null | undefined, thumb = true) =>
  id ? (id.startsWith("http") ? id : `https://sleepercdn.com/avatars/${thumb ? "thumbs/" : ""}${id}`) : null;

/** NBA seasons span two calendar years: Sleeper's "2025" is the 2025–26 season. */
export const seasonYears = (season: string) => {
  const y = Number(season);
  return Number.isFinite(y) ? `${y}–${String((y + 1) % 100).padStart(2, "0")}` : season;
};
