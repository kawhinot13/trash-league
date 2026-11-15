import { cacheLife } from "next/cache";
import { league } from "@/lib/league";

/**
 * Live intel built on Sleeper's public endpoints (pairings, per-game projections,
 * per-game stats, trending adds). Team scores never come from here.
 */
const API = "https://api.sleeper.app";
const LEAGUE = league.seasons.find((s) => s.code === "s4")!.leagueId;

type Stats = Record<string, number>;
type Row = {
  player_id: string;
  date: string | null;
  stats: Stats;
  team?: string;
  opponent?: string;
  player?: {
    first_name?: string;
    last_name?: string;
    fantasy_positions?: string[];
    injury_status?: string | null;
    team?: string;
  };
};

const get = async <T>(path: string): Promise<T> => {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json() as Promise<T>;
};

/** Fantasy points under this league's scoring. Sleeper reports milestone bonuses
 * (40+ pts, 20+ reb...) as tallies, so one weighted sum works for single games and
 * season totals alike. Verified: reproduces all 149 player scores in week 4 exactly. */
const fp = (st: Stats, sc: Stats) => {
  let v = 0;
  for (const [k, w] of Object.entries(sc)) v += (st[k] ?? 0) * w;
  return v;
};

/** Today's date in US Eastern time (NBA game dates). */
const todayET = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(
    new Date(),
  );

/**
 * This week's pairings (who plays whom), nothing else. Sleeper's matchup feed reports
 * different team scores on different requests for this daily-lineup league, so its points are
 * never shown; only the matchup_id pairing is used.
 */
export async function weekPairings(): Promise<{ week: number; opp: Record<string, string> } | null> {
  "use cache";
  cacheLife("minutes");
  try {
    const state = await get<{ week: number }>("/v1/state/nba");
    const [rosters, users, matchups] = await Promise.all([
      get<{ roster_id: number; owner_id: string }[]>(`/v1/league/${LEAGUE}/rosters`),
      get<{ user_id: string; display_name: string }[]>(`/v1/league/${LEAGUE}/users`),
      get<{ roster_id: number; matchup_id: number | null }[]>(`/v1/league/${LEAGUE}/matchups/${state.week}`),
    ]);
    const name = new Map(users.map((u) => [u.user_id, u.display_name]));
    const who = new Map(rosters.map((r) => [r.roster_id, name.get(r.owner_id) ?? "unknown"]));
    const groups = new Map<number, string[]>();
    for (const m of matchups)
      if (m.matchup_id != null) (groups.get(m.matchup_id) ?? groups.set(m.matchup_id, []).get(m.matchup_id)!).push(who.get(m.roster_id)!);
    const opp: Record<string, string> = {};
    for (const [x, y] of groups.values())
      if (x && y) {
        opp[x] = y;
        opp[y] = x;
      }
    return { week: state.week, opp };
  } catch {
    return null;
  }
}

export type Pickup = {
  id: string;
  name: string;
  team: string;
  pos: string[];
  injury: string | null;
  gp: number;
  seasonAvg: number;
  recentAvg: number;
  minSeason: number;
  minRecent: number;
  gamesLeft: number;
  projLeft: number;
  gamesNext: number;
  trend: number;
  score: number;
  tags: string[];
};

export async function waiverIntel(): Promise<{
  week: number;
  players: Pickup[];
} | null> {
  "use cache";
  cacheLife("minutes");
  try {
    const state = await get<{ week: number; season: string }>("/v1/state/nba");
    const { week, season } = state;
    const [
      lg,
      rosters,
      seasonStats,
      wkStats,
      prevStats,
      proj,
      projNext,
      trending,
    ] = await Promise.all([
      get<{ scoring_settings: Stats }>(`/v1/league/${LEAGUE}`),
      get<{ players: string[] | null }[]>(`/v1/league/${LEAGUE}/rosters`),
      get<Row[]>(`/stats/nba/${season}?season_type=regular`),
      get<Row[]>(`/stats/nba/${season}/${week}?season_type=regular`),
      week > 1
        ? get<Row[]>(`/stats/nba/${season}/${week - 1}?season_type=regular`)
        : Promise.resolve([] as Row[]),
      get<Row[]>(`/projections/nba/${season}/${week}?season_type=regular`),
      get<Row[]>(
        `/projections/nba/${season}/${week + 1}?season_type=regular`,
      ).catch(() => [] as Row[]),
      get<{ player_id: string; count: number }[]>(
        `/v1/players/nba/trending/add?lookback_hours=48&limit=100`,
      ),
    ]);
    const sc = lg.scoring_settings;
    const owned = new Set(rosters.flatMap((r) => r.players ?? []));
    const today = todayET();
    const trend = new Map(trending.map((t) => [t.player_id, t.count]));
    const games = new Map<
      string,
      { date: string; fp: number; min: number }[]
    >();
    for (const r of [...prevStats, ...wkStats]) {
      if (!r.date || !(r.stats.min ?? 0)) continue;
      const a = games.get(r.player_id) ?? [];
      a.push({ date: r.date, fp: fp(r.stats, sc), min: r.stats.min ?? 0 });
      games.set(r.player_id, a);
    }
    const played = new Set(
      wkStats.filter((r) => r.date).map((r) => `${r.player_id}|${r.date}`),
    );
    const meta = new Map<string, Row["player"] & { team?: string }>();
    const left = new Map<string, { n: number; pts: number }>();
    for (const r of proj) {
      if (r.player)
        meta.set(r.player_id, { ...r.player, team: r.team ?? r.player.team });
      if (!r.date || r.date < today || played.has(`${r.player_id}|${r.date}`))
        continue;
      // Trash counts one locked-in game per player per week, so the rest of the week is
      // worth his single best projected game, not the sum of his games.
      const x = left.get(r.player_id) ?? { n: 0, pts: 0 };
      x.n += 1;
      x.pts = Math.max(x.pts, fp(r.stats, sc));
      left.set(r.player_id, x);
    }
    const next = new Map<string, number>();
    for (const r of projNext)
      if (r.date) next.set(r.player_id, (next.get(r.player_id) ?? 0) + 1);

    const out: Pickup[] = [];
    for (const r of seasonStats) {
      const gp = r.stats.gp ?? 0;
      if (!gp || owned.has(r.player_id) || r.player_id.startsWith("TEAM_")) continue;
      const m = meta.get(r.player_id) ?? r.player;
      if (!m) continue;
      const g = (games.get(r.player_id) ?? [])
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, 5);
      const seasonAvg = fp(r.stats, sc) / gp;
      const recentAvg = g.length
        ? g.reduce((s, x) => s + x.fp, 0) / g.length
        : seasonAvg;
      const minSeason = (r.stats.min ?? 0) / gp;
      const minRecent = g.length
        ? g.reduce((s, x) => s + x.min, 0) / g.length
        : minSeason;
      const lw = left.get(r.player_id) ?? { n: 0, pts: 0 };
      const t = trend.get(r.player_id) ?? 0;
      const score =
        0.45 * recentAvg +
        0.25 * seasonAvg +
        0.2 * lw.pts +
        6 * Math.log10(1 + t / 100) +
        0.6 * (minRecent - minSeason);
      const injuryPenalty: Record<string, number> = { Out: 0.5, Doubtful: 0.7, Questionable: 0.85, "Day-To-Day": 0.85 };
      const adjScore = score * (injuryPenalty[m.injury_status ?? ""] ?? 1);
      const tags: string[] = [];
      if (recentAvg > seasonAvg * 1.2 && g.length >= 2) tags.push("Heating up");
      if (minRecent - minSeason >= 4) tags.push("Minutes up");
      if (lw.n >= 3) tags.push(`${lw.n} games left`);
      if (t >= 1000) tags.push("Trending");
      if (m.injury_status) tags.push(m.injury_status);
      out.push({
        id: r.player_id,
        name: `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim(),
        team: (m as { team?: string }).team ?? "",
        pos: m.fantasy_positions ?? [],
        injury: m.injury_status ?? null,
        gp,
        seasonAvg,
        recentAvg,
        minSeason,
        minRecent,
        gamesLeft: lw.n,
        projLeft: lw.pts,
        gamesNext: next.get(r.player_id) ?? 0,
        trend: t,
        score: adjScore,
        tags,
      });
    }
    out.sort((a, b) => b.score - a.score);
    return { week, players: out.slice(0, 60) };
  } catch {
    return null;
  }
}
