import "server-only";
import { cacheLife } from "next/cache";
import { consensusMatchups, sportState } from "@/lib/app/sleeper";
import type { Sport } from "@/lib/core/sport";
import { playerDirectory } from "@/lib/app/sleeper-cache";

/**
 * This week's matchups for an in-progress season, per Sleeper (its live matchup scores are not
 * the official totals). Cached for a minute or two so a busy league page doesn't hammer Sleeper.
 */
export type LiveSide = {
  rosterId: number;
  pts: number;
  starters: { pid: string; name: string; pos: string; pts: number }[];
};
export type LiveWeek = { week: number; asOf: string; games: [LiveSide, LiveSide][] } | null;

export async function liveWeek(leagueId: string, season: string, sport: Sport = "nba"): Promise<LiveWeek> {
  "use cache: remote";
  cacheLife("minutes");
  const state = await sportState(sport);
  const inSeason = state.season_type === "regular" || state.season_type === "post";
  if ((state.league_season || state.season) !== season || !inSeason) return null;
  const week = state.week;
  if (!week) return null;
  const [mus, dir] = await Promise.all([consensusMatchups(leagueId, week, 4), playerDirectory(sport).catch(() => ({}) as Awaited<ReturnType<typeof playerDirectory>>)]);
  const side = (m: (typeof mus)[number]): LiveSide => ({
    rosterId: m.roster_id,
    pts: Math.round((m.points ?? 0) * 10) / 10,
    starters: (m.starters ?? [])
      .map((pid, i) => ({ pid, pts: Math.round((m.starters_points?.[i] ?? 0) * 10) / 10 }))
      .filter((x) => x.pid && x.pid !== "0")
      .map((x) => ({ ...x, name: dir[x.pid]?.[0] ?? "Unknown player", pos: dir[x.pid]?.[1]?.join("/") ?? "" })),
  });
  const byMid = new Map<number, LiveSide[]>();
  for (const m of mus) if (m.matchup_id != null) (byMid.get(m.matchup_id) ?? byMid.set(m.matchup_id, []).get(m.matchup_id)!).push(side(m));
  const games = [...byMid.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => v)
    .filter((v): v is [LiveSide, LiveSide] => v.length === 2);
  return { week, asOf: new Date().toISOString(), games };
}
