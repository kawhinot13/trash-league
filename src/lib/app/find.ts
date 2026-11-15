import { formatOf, type Format } from "@/lib/app/family";
import { avatarUrl, sportState, sleeperUser, userLeagues, seasonYears } from "@/lib/app/sleeper";
import { SPORTS, sportOf, type Sport } from "@/lib/core/sport";

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
  sport: Sport;
};

/** A Sleeper user's basketball and football leagues this season and last, one entry per league (its newest season). */
export async function findLeagues(username: string): Promise<{ user: { name: string; avatar: string | null } | null; leagues: FoundLeague[] }> {
  const user = await sleeperUser(username).catch(() => null);
  if (!user?.user_id) return { user: null, leagues: [] };
  const perSport = await Promise.all(
    SPORTS.map(async (sport) => {
      const state = await sportState(sport);
      const now = Number(state.league_season || state.season);
      const [cur, prev] = await Promise.all([
        userLeagues(user.user_id, String(now), sport),
        userLeagues(user.user_id, String(now - 1), sport),
      ]);
      // A renewed league replaces last season's entry.
      const renewed = new Set(cur.map((l) => l.previous_league_id).filter(Boolean));
      return [...cur, ...prev.filter((l) => !renewed.has(l.league_id))];
    }).map((p) => p.catch(() => [] as Awaited<ReturnType<typeof userLeagues>>)), // one sport failing doesn't hide the other
  );
  const leagues = perSport.flat().map((l) => ({
    leagueId: l.league_id,
    name: l.name,
    season: l.season,
    years: seasonYears(l.season, sportOf(l)),
    teams: l.total_rosters,
    status: l.status,
    avatar: avatarUrl(l.avatar),
    format: formatOf(l),
    linked: !!l.previous_league_id && l.previous_league_id !== "0",
    sport: sportOf(l),
  }));
  leagues.sort((a, b) => Number(b.format.supported) - Number(a.format.supported) || b.season.localeCompare(a.season));
  return { user: { name: user.display_name, avatar: avatarUrl(user.avatar) }, leagues };
}
