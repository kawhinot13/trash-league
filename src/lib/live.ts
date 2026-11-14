import { cacheLife } from "next/cache";
import { league } from "@/lib/league";

/**
 * Live intel built on Sleeper's public endpoints (matchups, per-game projections,
 * per-game stats, trending adds). Sleeper doesn't publish these combinations.
 *
 * The league uses daily lineups (game_mode 1): a game only counts on days the
 * player starts. So "points so far" always comes from Sleeper's own matchup
 * score, and the rest of the week is projected by setting each team's best
 * legal lineup for every remaining day.
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

/** Standard normal CDF (Abramowitz–Stegun). */
const phi = (z: number) => {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
};

export type LiveRow = {
  pending: number;
  oppNow: number;
  manager: string;
  team: string;
  w: number;
  l: number;
  t: number;
  now: number;
  proj: number;
  opp: string;
  oppProj: number;
  winProb: number;
  pw: number;
  pl: number;
  pt: number;
  rankNow: number;
  rankProj: number;
  pf: number;
};

export async function weekIfEndedToday(): Promise<{
  week: number;
  rows: LiveRow[];
  daysLeft: number;
  asOf: string;
} | null> {
  "use cache";
  cacheLife("minutes");
  try {
    const state = await get<{ week: number; season: string }>("/v1/state/nba");
    const week = state.week;
    const [lg, rosters, users, matchups, proj, stats] = await Promise.all([
      get<{ scoring_settings: Stats }>(`/v1/league/${LEAGUE}`),
      get<
        {
          roster_id: number;
          owner_id: string;
          players: string[] | null;
          settings: Stats;
        }[]
      >(`/v1/league/${LEAGUE}/rosters`),
      get<
        {
          user_id: string;
          display_name: string;
          metadata?: { team_name?: string };
        }[]
      >(`/v1/league/${LEAGUE}/users`),
      get<{ roster_id: number; matchup_id: number; points: number; starters: string[]; starters_points: number[] }[]>(
        `/v1/league/${LEAGUE}/matchups/${week}`,
      ),
      get<Row[]>(
        `/projections/nba/${state.season}/${week}?season_type=regular`,
      ),
      get<Row[]>(`/stats/nba/${state.season}/${week}?season_type=regular`),
    ]);
    const scoring = lg.scoring_settings;
    const today = todayET();
    const played = new Set(
      stats.filter((r) => r.date).map((r) => `${r.player_id}|${r.date}`),
    );
    const dates = [
      ...new Set(
        proj.map((r) => r.date).filter((d): d is string => !!d && d >= today),
      ),
    ].sort();
    // Each lineup slot shows the latest game its starter played while starting; a new game
    // replaces the old score (verified: 79 of 108 slots = latest game, the rest = benched later).
    const lastGame = new Map<string, { date: string; proj: number }>();
    for (const r of proj) {
      if (!r.date || r.date < today || played.has(`${r.player_id}|${r.date}`)) continue;
      if (r.player?.injury_status === "Out") continue;
      const cur = lastGame.get(r.player_id);
      if (!cur || r.date > cur.date) lastGame.set(r.player_id, { date: r.date, proj: fp(r.stats, scoring) });
    }
    const byUser = new Map(users.map((u) => [u.user_id, u]));
    const team = rosters.map((r) => {
      const mu = matchups.find((x) => x.roster_id === r.roster_id);
      let final = 0;
      let v = 0;
      let pending = 0;
      (mu?.starters ?? []).forEach((pid, i) => {
        const now = mu?.starters_points?.[i] ?? 0;
        const next = lastGame.get(pid);
        // Managers protect a big score by benching, and play a starter when a better game is coming,
        // so a slot ends the week at the better of its current score and its next projected game.
        if (next && next.proj > now) {
          final += next.proj;
          v += (0.33 * next.proj) ** 2; // one game's spread is roughly a third of its projection
          pending += 1;
        } else final += now;
      });
      const rest = final - (mu?.points ?? 0);
      const m = matchups.find((x) => x.roster_id === r.roster_id)!;
      const u = byUser.get(r.owner_id);
      const s = r.settings;
      return {
        rid: r.roster_id,
        mid: m?.matchup_id,
        manager: u?.display_name ?? "unknown",
        team: u?.metadata?.team_name || u?.display_name || "",
        w: s.wins ?? 0,
        l: s.losses ?? 0,
        t: s.ties ?? 0,
        pf: (s.fpts ?? 0) + (s.fpts_decimal ?? 0) / 100,
        now: m?.points ?? 0,
        proj: (m?.points ?? 0) + rest,
        sd: Math.sqrt(v),
        pending,
      };
    });
    const rows: LiveRow[] = team.map((x) => {
      const o = team.find((y) => y.mid === x.mid && y.rid !== x.rid)!;
      const sd = Math.sqrt(x.sd ** 2 + o.sd ** 2) || 1;
      const winProb = phi((x.proj - o.proj) / sd);
      const win = x.proj > o.proj;
      return {
        manager: x.manager,
        team: x.team,
        w: x.w,
        l: x.l,
        t: x.t,
        now: x.now,
        proj: x.proj,
        opp: o.manager,
        oppProj: o.proj,
        oppNow: o.now,
        pending: x.pending,
        winProb,
        pw: x.w + (win ? 1 : 0),
        pl: x.l + (win ? 0 : 1),
        pt: x.t,
        rankNow: 0,
        rankProj: 0,
        pf: x.pf,
      };
    });
    [...rows]
      .sort((a, b) => b.w + b.t / 2 - (a.w + a.t / 2) || b.pf - a.pf)
      .forEach((r, i) => (r.rankNow = i + 1));
    [...rows]
      .sort(
        (a, b) =>
          b.pw + b.pt / 2 - (a.pw + a.pt / 2) ||
          b.pf + b.proj - (a.pf + a.proj),
      )
      .forEach((r, i) => (r.rankProj = i + 1));
    rows.sort((a, b) => a.rankProj - b.rankProj);
    return {
      week,
      rows,
      daysLeft: dates.length,
      asOf: new Date().toISOString(),
    };
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
      const x = left.get(r.player_id) ?? { n: 0, pts: 0 };
      x.n += 1;
      x.pts += fp(r.stats, sc);
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
        0.2 * (lw.pts / 3) +
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
