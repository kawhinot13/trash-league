import { formatOf, type Format } from "@/lib/app/family";
import { avatarUrl, nbaState, sleeperUser, userLeagues, seasonYears } from "@/lib/app/sleeper";

export type FoundLeague = {
  leagueId: string;
  name: string;
  season: string;
  years: string;
  teams: number;
  status: string;
  avatar: string | null;
  format: Format;
  /** Has an earlier season linked: the app will find the whole history. */
  linked: boolean;
};

/** A Sleeper user's NBA leagues this season and last, one entry per league (its newest season). */
export async function findLeagues(username: string): Promise<{ user: { name: string; avatar: string | null } | null; leagues: FoundLeague[] }> {
  const user = await sleeperUser(username).catch(() => null);
  if (!user?.user_id) return { user: null, leagues: [] };
  const state = await nbaState();
  const now = Number(state.league_season || state.season);
  const [cur, prev] = await Promise.all([
    userLeagues(user.user_id, String(now)),
    userLeagues(user.user_id, String(now - 1)),
  ]);
  // A renewed league replaces last season's entry.
  const renewed = new Set(cur.map((l) => l.previous_league_id).filter(Boolean));
  const leagues = [...cur, ...prev.filter((l) => !renewed.has(l.league_id))].map((l) => ({
    leagueId: l.league_id,
    name: l.name,
    season: l.season,
    years: seasonYears(l.season),
    teams: l.total_rosters,
    status: l.status,
    avatar: avatarUrl(l.avatar),
    format: formatOf(l),
    linked: !!l.previous_league_id && l.previous_league_id !== "0",
  }));
  leagues.sort((a, b) => Number(b.format.supported) - Number(a.format.supported) || b.season.localeCompare(a.season));
  return { user: { name: user.display_name, avatar: avatarUrl(user.avatar) }, leagues };
}
