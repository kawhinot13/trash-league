import { isSleeperId } from "@/lib/app/validate";
import { isSport, sportOf, SPORT } from "@/lib/core/sport";
import {
  sportState,
  sleeper,
  userLeagues,
  type SBracket,
  type SLeague,
  type SPick,
  type SRoster,
  type SUser,
} from "@/lib/app/sleeper";

/**
 * A "family" is one league across its seasons. Sleeper links each season to the one before it
 * (previous_league_id); there is no forward link, so newer seasons are found by checking the
 * members' leagues for one that points back at the newest season we know.
 * The family id is its oldest season's league id: it never changes as seasons are added.
 */
export type SeasonBundle = {
  league: SLeague;
  users: SUser[];
  rosters: SRoster[];
  winners: SBracket[];
  losers: SBracket[];
  picks: SPick[];
  fetchedAt: string;
};
export type Family = {
  id: string;
  /** Oldest first. */
  seasons: SeasonBundle[];
};

export type Format = { supported: boolean; label: string; reason?: string };

/** Phase 1 supports head-to-head points leagues. */
export function formatOf(l: Pick<SLeague, "scoring_settings" | "settings" | "sport">): Format {
  if (l.sport && !isSport(l.sport)) return { supported: false, label: l.sport.toUpperCase(), reason: "Only basketball and football leagues for now." };
  const s = l.settings ?? {};
  const weights = Object.values(l.scoring_settings ?? {}).filter((v) => v !== 0);
  // Sleeper marks category scoring on the league settings; points leagues carry point weights.
  if ((s as Record<string, unknown>).scoring_type && String((s as Record<string, unknown>).scoring_type).includes("cat"))
    return { supported: false, label: "Categories", reason: "Category leagues are coming later." };
  if (!weights.length) return { supported: false, label: "Unknown scoring", reason: "This league has no point scoring." };
  if (s.best_ball) return { supported: false, label: "Best ball", reason: "Best-ball leagues are coming later." };
  const kind = s.type === 2 ? "Dynasty" : s.type === 1 ? "Keeper" : "Redraft";
  return { supported: true, label: `${SPORT[sportOf(l)].label} head-to-head points, ${kind.toLowerCase()}` };
}

const MAX_SEASONS = 20;

/**
 * Keep only the public league data Rafterlore uses. Sleeper's payloads carry more (the league's last
 * chat message, notification settings and so on); none of that is stored.
 */
const pick = <T extends object>(o: T | null | undefined, keys: string[]) =>
  o ? (Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, (o as Record<string, unknown>)[k]])) as Partial<T>) : null;

export function sanitizeLeague(l: SLeague): SLeague {
  return {
    ...(pick(l, ["league_id", "name", "season", "status", "sport", "avatar", "total_rosters", "draft_id", "previous_league_id", "roster_positions", "scoring_settings", "settings"]) as SLeague),
    metadata: pick(l.metadata, ["copy_from_league_id", "latest_league_winner_roster_id"]) as Record<string, string> | null,
  };
}

export function sanitizeBundle(b: SeasonBundle): SeasonBundle {
  return {
    league: sanitizeLeague(b.league),
    users: b.users.map((u) => ({
      user_id: u.user_id,
      display_name: u.display_name,
      avatar: u.avatar ?? null,
      metadata: pick(u.metadata, ["team_name", "avatar"]),
    })),
    rosters: b.rosters.map(
      (r) =>
        ({
          ...pick(r, ["roster_id", "owner_id", "co_owners", "players", "starters", "reserve", "settings"]),
          metadata: pick(r.metadata, ["record", "streak"]),
        }) as SRoster,
    ),
    winners: b.winners,
    losers: b.losers,
    picks: b.picks.map(
      (p) =>
        ({
          ...pick(p, ["pick_no", "round", "roster_id", "player_id", "picked_by"]),
          metadata: pick(p.metadata, ["first_name", "last_name", "position", "team"]),
        }) as SPick,
    ),
    fetchedAt: b.fetchedAt,
  };
}

async function seasonBundle(league: SLeague): Promise<SeasonBundle> {
  const id = league.league_id;
  const [users, rosters, winners, losers, picks] = await Promise.all([
    sleeper<SUser[] | null>(`/v1/league/${id}/users`),
    sleeper<SRoster[] | null>(`/v1/league/${id}/rosters`),
    sleeper<SBracket[] | null>(`/v1/league/${id}/winners_bracket`).catch(() => null),
    sleeper<SBracket[] | null>(`/v1/league/${id}/losers_bracket`).catch(() => null),
    league.draft_id
      ? sleeper<SPick[] | null>(`/v1/draft/${league.draft_id}/picks`).catch(() => null)
      : Promise.resolve(null),
  ]);
  return sanitizeBundle({
    league,
    users: users ?? [],
    rosters: rosters ?? [],
    winners: winners ?? [],
    losers: losers ?? [],
    picks: picks ?? [],
    fetchedAt: new Date().toISOString(),
  });
}

/** Fetch one season's bundle again (in-season refresh). */
export async function refreshSeason(leagueId: string): Promise<SeasonBundle | null> {
  const league = await sleeper<SLeague | null>(`/v1/league/${leagueId}`);
  return league ? seasonBundle(league) : null;
}

const real = (id: string | null | undefined) => (id && id !== "0" ? id : null);

/** The season before `l`. Sleeper sometimes drops previous_league_id on a renewal but keeps
 * copy_from_league_id (the league it was copied from); that counts only if it's an earlier season. */
async function previousOf(l: SLeague): Promise<SLeague | null> {
  const prev = real(l.previous_league_id);
  if (prev) return sleeper<SLeague | null>(`/v1/league/${prev}`).catch(() => null);
  const copy = real(l.metadata?.copy_from_league_id);
  if (!copy) return null;
  const c = await sleeper<SLeague | null>(`/v1/league/${copy}`).catch(() => null);
  return c && Number(c.season) < Number(l.season) ? c : null;
}
const linksTo = (l: SLeague, prev: SLeague) =>
  real(l.previous_league_id) === prev.league_id ||
  (!real(l.previous_league_id) && real(l.metadata?.copy_from_league_id) === prev.league_id);

/** Walk back to the first season. */
async function walkBack(start: SLeague): Promise<SLeague[]> {
  const out = [start];
  const seen = new Set([start.league_id]);
  let cur: SLeague | null = start;
  while (cur && out.length < MAX_SEASONS) {
    const p: SLeague | null = await previousOf(cur);
    if (!p || seen.has(p.league_id) || Number(p.season) >= Number(cur.season)) break;
    seen.add(p.league_id);
    out.push(p);
    cur = p;
  }
  return out.reverse();
}

/** Seasons newer than `newest`: a member's league that links back to it. */
export async function walkForward(newest: SLeague, memberIds: string[]): Promise<SLeague[]> {
  const sport = sportOf(newest);
  const state = await sportState(sport).catch(() => null);
  const latest = Number(state?.league_season ?? state?.season ?? newest.season);
  const out: SLeague[] = [];
  let cur = newest;
  let members = memberIds;
  while (Number(cur.season) < latest && out.length < 3) {
    const next = String(Number(cur.season) + 1);
    let found: SLeague | undefined;
    // A few members is plenty: everyone who stayed is in the renewed league.
    for (const uid of members.slice(0, 4)) {
      const ls = await userLeagues(uid, next, sport).catch(() => []);
      found = ls.find((l) => linksTo(l, cur));
      if (found) break;
    }
    if (!found) break;
    out.push(found);
    cur = found;
    const users = await sleeper<SUser[] | null>(`/v1/league/${found.league_id}/users`).catch(() => null);
    members = users?.map((u) => u.user_id) ?? members;
  }
  return out;
}

/** Discover every season of the league `leagueId` belongs to and fetch their data. */
export async function discoverFamily(leagueId: string): Promise<Family | null> {
  if (!isSleeperId(leagueId)) return null;
  const start = await sleeper<SLeague | null>(`/v1/league/${leagueId}`).catch(() => null);
  if (!start || (start.sport && !isSport(start.sport))) return null;
  const back = await walkBack(start);
  const newest = back[back.length - 1];
  const newestUsers = await sleeper<SUser[] | null>(`/v1/league/${newest.league_id}/users`).catch(() => null);
  const forward = await walkForward(newest, newestUsers?.map((u) => u.user_id) ?? []);
  const leagues = [...back, ...forward];
  const seasons: SeasonBundle[] = [];
  // A handful of requests per season; keep it gentle on Sleeper.
  for (let i = 0; i < leagues.length; i += 3)
    seasons.push(...(await Promise.all(leagues.slice(i, i + 3).map(seasonBundle))));
  return { id: leagues[0].league_id, seasons };
}
