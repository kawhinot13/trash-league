import { boomLine, boomOf } from "@/lib/core/boom";
import { sportPath, type LiveSource } from "@/lib/core/live-source";

/**
 * Front Office data: every current roster with a value for each player, live from Sleeper.
 *
 * Value is what a player is worth in THIS league's format, where each lineup slot counts one
 * game a week: his typical best game per week. This season it's the average of his weekly best
 * game; until he has a few weeks of games it's blended with last season (per-game average × 1.3,
 * about what the best of 3–4 games is worth).
 */
type Stats = Record<string, number>;
type Row = {
  player_id: string;
  date: string | null;
  stats: Stats;
  team?: string;
  player?: { first_name?: string; last_name?: string; fantasy_positions?: string[]; injury_status?: string | null; team?: string };
};

export type FOPlayer = {
  pid: string;
  name: string;
  team: string;
  pos: string[];
  injury: string | null;
  /** weekly ceiling value used for everything */
  value: number;
  ppg: number;
  gp: number;
  /** last season's points per game, if any */
  prev: number;
  onIR: boolean;
  /** This season's weekly best-game average (0 before he has played). */
  now: number;
  /** Weeks this season he has played in. */
  weeks: number;
  /** What his weekly best game "should" be: last season and Sleeper's projection, as a ceiling. */
  expected: number;
  /** Average of his last 3 games, and minutes: season vs last 3. */
  recent: number;
  min: number;
  minRecent: number;
  /** Boom index (core/boom.ts): share of this season's games over the league's big-game line, and his ceiling. */
  boom?: number;
  ceil?: number;
};
export type FOTeam = { id: string; team: string; players: string[] };
export type FrontOffice = {
  week: number;
  slots: string[];
  teams: FOTeam[];
  players: Record<string, FOPlayer>;
  /** Best free agents by value, for "pick up" suggestions. */
  free: string[];
  asOf: string;
  /** Basketball when unset. */
  sport?: "nba" | "nfl";
  /** The big-game line (90th percentile of rostered players' games this season), for the boom index. */
  boomLine?: number;
};

const fp = (st: Stats, sc: Stats) => {
  let v = 0;
  for (const [k, w] of Object.entries(sc)) v += (st[k] ?? 0) * w;
  return v;
};

export async function frontOffice(src: LiveSource): Promise<FrontOffice | null> {
  try {
    const state = await src.get<{ week: number; season: string }>(`/v1/state/${sportPath(src)}`);
    const season = state.season;
    const weeks = Array.from({ length: Math.max(1, state.week) }, (_, i) => i + 1);
    const [lg, rosters, users, prevSeason, proj, ...wk] = await Promise.all([
      src.get<{ scoring_settings: Stats; roster_positions: string[] }>(`/v1/league/${src.leagueId}`),
      src.get<{ roster_id: number; owner_id: string; players: string[] | null; reserve: string[] | null }[]>(`/v1/league/${src.leagueId}/rosters`),
      src.get<{ user_id: string; display_name: string; metadata?: { team_name?: string } }[]>(`/v1/league/${src.leagueId}/users`),
      src.get<Row[]>(`/stats/${sportPath(src)}/${Number(season) - 1}?season_type=regular`),
      src.get<Row[]>(`/projections/${sportPath(src)}/${season}/${state.week}?season_type=regular`).catch(() => [] as Row[]),
      ...weeks.map((w) => src.get<Row[]>(`/stats/${sportPath(src)}/${season}/${w}?season_type=regular`)),
    ]);
    const sc = lg.scoring_settings;
    // Football: one game a week, so a week's best game is just his game (no 1.3x "best of several"
    // lift), and stats have no minutes: games played says he played.
    const nfl = sportPath(src) === "nfl";
    const CEIL = nfl ? 1 : 1.3;
    const played = (r: Row) => (nfl ? (r.stats.gp ?? 0) > 0 : !!r.date && (r.stats.min ?? 0) > 0);
    const meta = new Map<string, Row["player"] & { team?: string }>();
    // this season: per player, best game each week + all games
    const best = new Map<string, number[]>();
    const games = new Map<string, { date: string; v: number; min: number }[]>();
    wk.forEach((rows) => {
      const wb = new Map<string, number>();
      for (const r of rows) {
        if (r.player) meta.set(r.player_id, { ...r.player, team: r.team ?? r.player.team });
        if (!played(r)) continue;
        const v = fp(r.stats, sc);
        wb.set(r.player_id, Math.max(wb.get(r.player_id) ?? -99, v));
        (games.get(r.player_id) ?? games.set(r.player_id, []).get(r.player_id)!).push({ date: r.date ?? "", v, min: r.stats.min ?? 0 });
      }
      for (const [pid, v] of wb) (best.get(pid) ?? best.set(pid, []).get(pid)!).push(v);
    });
    // Sleeper's per-game projections for this week, averaged per player.
    const projSum = new Map<string, [number, number]>();
    for (const r of proj) {
      if (!r.date && !nfl) continue;
      const [t, n] = projSum.get(r.player_id) ?? [0, 0];
      projSum.set(r.player_id, [t + fp(r.stats, sc), n + 1]);
    }
    const prevMin = new Map<string, number>();
    const prev = new Map<string, number>();
    for (const r of prevSeason) {
      const gp = r.stats.gp ?? 0;
      if (gp >= (nfl ? 3 : 5)) {
        prev.set(r.player_id, fp(r.stats, sc) / gp);
        prevMin.set(r.player_id, (r.stats.min ?? 0) / gp);
      }
      if (r.player && !meta.has(r.player_id)) meta.set(r.player_id, { ...r.player, team: r.team ?? r.player.team });
    }
    const valueOf = (pid: string) => {
      const b = best.get(pid) ?? [];
      const g = games.get(pid) ?? [];
      const now = b.length ? b.reduce((a, x) => a + x, 0) / b.length : 0;
      const before = (prev.get(pid) ?? 0) * CEIL;
      const k = b.length / (b.length + 2); // trust this season more as weeks pile up
      const value = b.length ? (before ? k * now + (1 - k) * before : now) : before;
      const sorted = [...g].sort((a, b) => (a.date < b.date ? -1 : 1));
      const last = sorted.slice(-3);
      const avg = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 0);
      const pj = projSum.get(pid);
      const anchors = [before, pj && pj[1] ? (pj[0] / pj[1]) * CEIL : 0].filter((x) => x > 0);
      return {
        value,
        ppg: avg(g.map((x) => x.v)),
        gp: g.length,
        prev: prev.get(pid) ?? 0,
        now,
        weeks: b.length,
        expected: avg(anchors),
        recent: avg(last.map((x) => x.v)),
        min: avg(g.map((x) => x.min)),
        minRecent: avg(last.map((x) => x.min)),
      };
    };
    const byUser = new Map(users.map((u) => [u.user_id, u]));
    const owned = new Set<string>();
    const out: Record<string, FOPlayer> = {};
    const make = (pid: string, onIR: boolean): FOPlayer => {
      const m = meta.get(pid);
      const v = valueOf(pid);
      return {
        pid,
        name: m ? `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() : pid,
        team: m?.team ?? "",
        pos: m?.fantasy_positions ?? [],
        injury: m?.injury_status ?? null,
        value: Math.round(v.value * 10) / 10,
        ppg: Math.round(v.ppg * 10) / 10,
        gp: v.gp,
        prev: Math.round(v.prev * 10) / 10,
        onIR,
        now: Math.round(v.now * 10) / 10,
        weeks: v.weeks,
        expected: Math.round(v.expected * 10) / 10,
        recent: Math.round(v.recent * 10) / 10,
        min: Math.round(v.min * 10) / 10,
        minRecent: Math.round(v.minRecent * 10) / 10,
      };
    };
    const teams: FOTeam[] = rosters.map((r) => {
      const u = byUser.get(r.owner_id);
      const ir = new Set(r.reserve ?? []);
      for (const pid of r.players ?? []) {
        owned.add(pid);
        out[pid] = make(pid, ir.has(pid));
      }
      return { id: u ? src.idOf(u) : String(r.roster_id), team: u?.metadata?.team_name || u?.display_name || "", players: r.players ?? [] };
    });
    // best free agents, for pickup suggestions
    const free = [...new Set([...best.keys(), ...prev.keys()])]
      .filter((pid) => !owned.has(pid) && !pid.startsWith("TEAM") && meta.get(pid)?.team && (meta.get(pid)?.fantasy_positions ?? []).some((x) => x !== "TEAM"))
      .map((pid) => ({ pid, v: valueOf(pid).value }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 25)
      .map(({ pid }) => {
        out[pid] = make(pid, false);
        return pid;
      });
    // Boom index: the league's big-game line from every rostered player's games, then each player's rate.
    const line = boomLine([...owned].flatMap((pid) => (games.get(pid) ?? []).map((g) => g.v)));
    for (const p of Object.values(out)) {
      const b = boomOf((games.get(p.pid) ?? []).map((g) => g.v), line);
      p.boom = Math.round(b.rate * 1000) / 1000;
      p.ceil = Math.round(b.ceil * 10) / 10;
    }
    return {
      week: state.week,
      boomLine: Math.round(line * 10) / 10,
      slots: lg.roster_positions.filter((p) => (nfl ? !["BN", "IR", "TAXI"].includes(p) : p !== "BN")),
      teams,
      players: out,
      free,
      asOf: new Date().toISOString(),
      ...(nfl ? { sport: "nfl" as const } : {}),
    };
  } catch {
    return null;
  }
}
