import { cacheLife } from "next/cache";
import { league } from "@/lib/league";

/**
 * Front Office data: every Season 4 roster with a value for each player, live from Sleeper.
 *
 * Value is what a player is worth in THIS league's format, where each lineup slot counts one
 * game a week: his typical best game per week. This season it's the average of his weekly best
 * game; until he has a few weeks of games it's blended with last season (per-game average × 1.3,
 * about what the best of 3–4 games is worth).
 */
const API = "https://api.sleeper.app";
const LEAGUE = league.seasons.find((s) => s.code === "s4")!.leagueId;

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
};

const get = async <T>(path: string): Promise<T> => {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json() as Promise<T>;
};
const fp = (st: Stats, sc: Stats) => {
  let v = 0;
  for (const [k, w] of Object.entries(sc)) v += (st[k] ?? 0) * w;
  return v;
};

export async function frontOffice(): Promise<FrontOffice | null> {
  "use cache";
  cacheLife("hours");
  try {
    const state = await get<{ week: number; season: string }>("/v1/state/nba");
    const season = state.season;
    const weeks = Array.from({ length: Math.max(1, state.week) }, (_, i) => i + 1);
    const [lg, rosters, users, prevSeason, ...wk] = await Promise.all([
      get<{ scoring_settings: Stats; roster_positions: string[] }>(`/v1/league/${LEAGUE}`),
      get<{ roster_id: number; owner_id: string; players: string[] | null; reserve: string[] | null }[]>(`/v1/league/${LEAGUE}/rosters`),
      get<{ user_id: string; display_name: string; metadata?: { team_name?: string } }[]>(`/v1/league/${LEAGUE}/users`),
      get<Row[]>(`/stats/nba/${Number(season) - 1}?season_type=regular`),
      ...weeks.map((w) => get<Row[]>(`/stats/nba/${season}/${w}?season_type=regular`)),
    ]);
    const sc = lg.scoring_settings;
    const meta = new Map<string, Row["player"] & { team?: string }>();
    // this season: per player, best game each week + all games
    const best = new Map<string, number[]>();
    const games = new Map<string, number[]>();
    wk.forEach((rows) => {
      const wb = new Map<string, number>();
      for (const r of rows) {
        if (r.player) meta.set(r.player_id, { ...r.player, team: r.team ?? r.player.team });
        if (!r.date || !(r.stats.min ?? 0)) continue;
        const v = fp(r.stats, sc);
        wb.set(r.player_id, Math.max(wb.get(r.player_id) ?? -99, v));
        (games.get(r.player_id) ?? games.set(r.player_id, []).get(r.player_id)!).push(v);
      }
      for (const [pid, v] of wb) (best.get(pid) ?? best.set(pid, []).get(pid)!).push(v);
    });
    const prev = new Map<string, number>();
    for (const r of prevSeason) {
      const gp = r.stats.gp ?? 0;
      if (gp >= 5) prev.set(r.player_id, fp(r.stats, sc) / gp);
      if (r.player && !meta.has(r.player_id)) meta.set(r.player_id, { ...r.player, team: r.team ?? r.player.team });
    }
    const valueOf = (pid: string) => {
      const b = best.get(pid) ?? [];
      const g = games.get(pid) ?? [];
      const now = b.length ? b.reduce((a, x) => a + x, 0) / b.length : 0;
      const before = (prev.get(pid) ?? 0) * 1.3;
      const k = b.length / (b.length + 2); // trust this season more as weeks pile up
      const value = b.length ? (before ? k * now + (1 - k) * before : now) : before;
      return { value, ppg: g.length ? g.reduce((a, x) => a + x, 0) / g.length : 0, gp: g.length, prev: prev.get(pid) ?? 0 };
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
      };
    };
    const teams: FOTeam[] = rosters.map((r) => {
      const u = byUser.get(r.owner_id);
      const ir = new Set(r.reserve ?? []);
      for (const pid of r.players ?? []) {
        owned.add(pid);
        out[pid] = make(pid, ir.has(pid));
      }
      return { id: u?.display_name ?? String(r.roster_id), team: u?.metadata?.team_name || u?.display_name || "", players: r.players ?? [] };
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
    return { week: state.week, slots: lg.roster_positions.filter((p) => p !== "BN"), teams, players: out, free, asOf: new Date().toISOString() };
  } catch {
    return null;
  }
}
