import type { SLeague, SMatchup, SStatRow, STransaction, Stats } from "@/lib/app/sleeper";

/**
 * Box-score lineup replay for one league-week: what each team scored (per Sleeper) against the
 * best lineup it could have set from the players it actually had at each game's tip-off
 * (transactions are replayed by timestamp).
 *
 * Two scoring models, because Sleeper NBA leagues differ:
 *  - "one": each starting slot counts one game per week (the Trash rules). Best = best legal
 *    lineup where each slot takes one player's best game of the week.
 *  - "all": every game a starter plays counts. Best = the best legal lineup on each game day, summed.
 * Both are stored; the grading step keeps whichever model explains the league's real scores.
 */

const SLOT_OK: Record<string, string[]> = {
  PG: ["PG"],
  SG: ["SG"],
  G: ["PG", "SG"],
  SF: ["SF"],
  PF: ["PF"],
  F: ["SF", "PF"],
  GF: ["SG", "SF"],
  C: ["C"],
  UTIL: ["PG", "SG", "SF", "PF", "C"],
  // Football (no overlap with basketball's slot names).
  FLEX: ["RB", "WR", "TE"],
  SUPER_FLEX: ["QB", "RB", "WR", "TE"],
  REC_FLEX: ["WR", "TE"],
  WRRB_FLEX: ["WR", "RB"],
  IDP_FLEX: ["DL", "LB", "DB", "DE", "DT", "CB", "S"],
  DL: ["DL", "DE", "DT"],
  DB: ["DB", "CB", "S"],
};
const NON_STARTING = new Set(["BN", "IR", "IL", "TAXI", "NA"]);
export const startingSlots = (rp: string[]) => rp.filter((s) => !NON_STARTING.has(s));

/** Max total with at most one candidate per slot: bitmask DP over slots. */
export function bestLineup(slots: string[], cands: { pts: number; pos: string[] }[]): number {
  const n = slots.length;
  if (n > 16) throw new Error("too many lineup slots");
  let dp = new Float64Array(1 << n).fill(-1);
  dp[0] = 0;
  // Only the best few players per week can matter; cap the work.
  const top = cands.filter((c) => c.pts > 0).sort((a, b) => b.pts - a.pts).slice(0, n + 8);
  for (const c of top) {
    const ok: number[] = [];
    slots.forEach((s, i) => {
      if ((SLOT_OK[s] ?? [s]).some((p) => c.pos.includes(p))) ok.push(i);
    });
    if (!ok.length) continue;
    const next = dp.slice();
    for (let mask = 0; mask < dp.length; mask++) {
      const v = dp[mask];
      if (v < 0) continue;
      for (const i of ok)
        if (!(mask & (1 << i))) {
          const m2 = mask | (1 << i);
          if (next[m2] < v + c.pts) next[m2] = v + c.pts;
        }
    }
    dp = next;
  }
  let best = 0;
  for (const v of dp) if (v > best) best = v;
  return best;
}

export const fantasyPoints = (st: Stats, sc: Stats) => {
  let v = 0;
  for (const k in sc) v += (st[k] ?? 0) * sc[k];
  return v;
};

export type TeamWeek = {
  rid: number;
  mid: number | null;
  /** Sleeper's matchup score (unreliable: "per Sleeper"). */
  pts: number;
  /** Best possible, one game per slot. */
  one: number;
  /** Best possible, every game counts (daily lineups). */
  all: number;
  st: string[];
  sp: number[];
  pl: string[];
};
export type WeekData = {
  week: number;
  teams: TeamWeek[];
  trades: { ts: number; sides: Record<string, string[]> }[];
  adds: [number, string][];
  /** pid -> [name, positions] for anyone who played. */
  names: Record<string, [string, string[]]>;
  /** pid -> [best single game, games played] this week, for everyone who played (replay v2+). */
  best?: Record<string, [number, number]>;
  /** Replay format version; older rows are replayed again. */
  v?: number;
};

/** Bump when WeekData gains fields, so stored weeks get replayed (box scores come from cache). */
export const REPLAY_VERSION = 2;

const r1 = (x: number) => Math.round(x * 10) / 10;

export function replayWeek(
  league: Pick<SLeague, "scoring_settings" | "roster_positions">,
  week: number,
  matchups: SMatchup[],
  txs: STransaction[],
  stats: SStatRow[],
): WeekData {
  const sc = league.scoring_settings;
  const slots = startingSlots(league.roster_positions);
  const names: WeekData["names"] = {};
  // Per-game fantasy points: pid -> [{ts, date, pts}]. Stats dates are ET game dates; treat
  // tip-off as 7pm ET (23:00 UTC) for the roster replay.
  const games = new Map<string, { ts: number; date: string; pts: number }[]>();
  const pos = new Map<string, string[]>();
  for (const r of stats) {
    if (!r.date || r.player_id.startsWith("TEAM")) continue;
    const p = r.player;
    if (p && !names[r.player_id])
      names[r.player_id] = [`${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(), p.fantasy_positions ?? []];
    if (p?.fantasy_positions) pos.set(r.player_id, p.fantasy_positions);
    const ts = Date.parse(`${r.date}T23:00:00Z`);
    const list = games.get(r.player_id) ?? [];
    list.push({ ts, date: r.date, pts: r1(fantasyPoints(r.stats ?? {}, sc)) });
    games.set(r.player_id, list);
  }

  // Roster events this week, per roster.
  const ev = new Map<number, { ts: number; pid: string; k: 1 | -1 }[]>();
  const trades: WeekData["trades"] = [];
  const adds: WeekData["adds"] = [];
  for (const t of txs) {
    if (t.status !== "complete") continue;
    const ts = t.status_updated || t.created;
    for (const [pid, rid] of Object.entries(t.adds ?? {})) {
      (ev.get(rid) ?? ev.set(rid, []).get(rid)!).push({ ts, pid, k: 1 });
      if (t.type !== "trade") adds.push([rid, pid]);
    }
    for (const [pid, rid] of Object.entries(t.drops ?? {})) (ev.get(rid) ?? ev.set(rid, []).get(rid)!).push({ ts, pid, k: -1 });
    if (t.type === "trade") {
      const sides: Record<string, string[]> = {};
      for (const [pid, rid] of Object.entries(t.adds ?? {})) (sides[rid] ??= []).push(pid);
      for (const pk of t.draft_picks ?? []) (sides[pk.owner_id] ??= []).push(`pick:${pk.season} R${pk.round}`);
      trades.push({ ts, sides });
    }
  }

  const teams: TeamWeek[] = matchups.map((m) => {
    const evs = (ev.get(m.roster_id) ?? []).sort((a, b) => a.ts - b.ts);
    const end = new Set(m.players ?? []);
    const cand = new Set([...end, ...evs.filter((e) => e.k < 0).map((e) => e.pid)]);
    const onRoster = (pid: string, ts: number) => {
      const later = evs.find((e) => e.pid === pid && e.ts > ts);
      return later ? later.k < 0 : end.has(pid);
    };
    const oneCands: { pts: number; pos: string[] }[] = [];
    const byDay = new Map<string, { pts: number; pos: string[] }[]>();
    for (const pid of cand) {
      const gl = (games.get(pid) ?? []).filter((g) => onRoster(pid, g.ts));
      if (!gl.length) continue;
      const pp = pos.get(pid) ?? [];
      oneCands.push({ pts: Math.max(...gl.map((g) => g.pts)), pos: pp });
      for (const g of gl) (byDay.get(g.date) ?? byDay.set(g.date, []).get(g.date)!).push({ pts: g.pts, pos: pp });
    }
    let all = 0;
    for (const c of byDay.values()) all += bestLineup(slots, c);
    return {
      rid: m.roster_id,
      mid: m.matchup_id ?? null,
      pts: r1(m.points ?? 0),
      one: r1(bestLineup(slots, oneCands)),
      all: r1(all),
      st: (m.starters ?? []).filter((p) => p && p !== "0"),
      sp: (m.starters ?? []).map((p, i) => [p, m.starters_points?.[i] ?? 0] as const).filter(([p]) => p && p !== "0").map(([, x]) => r1(x)),
      pl: m.players ?? [],
    };
  });
  const best: Record<string, [number, number]> = {};
  for (const [pid, gl] of games) best[pid] = [Math.max(...gl.map((g) => g.pts)), gl.filter((g) => g.pts !== 0).length];
  return { week, teams, trades, adds, names, best, v: REPLAY_VERSION };
}

/**
 * Football week: one game per player per week, and Sleeper's matchup already lists every rostered
 * player's points (players_points), bench included. So the best lineup comes straight from that
 * week's roster, no box scores or tip-off replay needed. "one" and "all" are the same thing here.
 */
export function replayFootballWeek(
  league: Pick<SLeague, "roster_positions">,
  week: number,
  matchups: SMatchup[],
  txs: STransaction[],
  dir: Record<string, [string, string[], ...unknown[]]>,
): WeekData {
  const slots = startingSlots(league.roster_positions);
  const names: WeekData["names"] = {};
  const best: Record<string, [number, number]> = {};
  const teams: TeamWeek[] = matchups.map((m) => {
    const pp = m.players_points ?? {};
    const cands = (m.players ?? []).map((pid) => {
      const d = dir[pid];
      if (d) names[pid] = [d[0], d[1]];
      const pts = r1(pp[pid] ?? 0);
      if (pp[pid] != null) best[pid] = [pts, pts !== 0 ? 1 : 0];
      return { pts, pos: d?.[1] ?? [] };
    });
    const opt = r1(bestLineup(slots, cands));
    return {
      rid: m.roster_id,
      mid: m.matchup_id ?? null,
      pts: r1(m.points ?? 0),
      one: opt,
      all: opt,
      st: (m.starters ?? []).filter((p) => p && p !== "0"),
      sp: (m.starters ?? []).map((p, i) => [p, m.starters_points?.[i] ?? 0] as const).filter(([p]) => p && p !== "0").map(([, x]) => r1(x)),
      pl: m.players ?? [],
    };
  });
  const trades: WeekData["trades"] = [];
  const adds: WeekData["adds"] = [];
  for (const t of txs) {
    if (t.status !== "complete") continue;
    const ts = t.status_updated || t.created;
    if (t.type === "trade") {
      const sides: Record<string, string[]> = {};
      for (const [pid, rid] of Object.entries(t.adds ?? {})) (sides[rid] ??= []).push(pid);
      for (const pk of t.draft_picks ?? []) (sides[pk.owner_id] ??= []).push(`pick:${pk.season} R${pk.round}`);
      trades.push({ ts, sides });
    } else for (const [pid, rid] of Object.entries(t.adds ?? {})) adds.push([rid, pid]);
  }
  return { week, teams, trades, adds, names, best, v: REPLAY_VERSION };
}
