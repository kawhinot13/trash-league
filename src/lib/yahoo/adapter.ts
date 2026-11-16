import type { SeasonBundle } from "@/lib/app/family";
import { replayFootballWeek, type WeekData } from "@/lib/app/replay";
import type { SBracket, SLeague, SMatchup, SPick, SRoster, STransaction, SUser } from "@/lib/app/sleeper";
import type { PlayerDir } from "@/lib/app/sleeper-cache";
import type { YMatchup, YPick, YPlayer, YTeam, YTxn } from "@/lib/yahoo/api";

/**
 * Turns one Yahoo football season into the Sleeper-shaped data the rest of Rafterlore already grades
 * (a SeasonBundle plus replayed weeks), so every shared feature works for Yahoo leagues unchanged.
 * Pure: no I/O. Player ids become Sleeper ids where Sleeper knows the Yahoo id, else "y<id>".
 */
export type YSeasonRaw = {
  key: string;
  name: string;
  season: string;
  finished: boolean;
  status: "complete" | "in_season" | "pre_draft";
  startWeek: number;
  endWeek: number;
  playoffStart: number;
  playoffTeams: number;
  positions: { pos: string; count: number }[];
  teams: YTeam[];
  weeks: { week: number; matchups: YMatchup[]; rosters: Record<string, YPlayer[]> }[];
  picks: YPick[];
  txns: YTxn[];
  /** Week windows, as YYYY-MM-DD dates (Yahoo's game weeks). */
  calendar: { week: number; start: string; end: string }[];
};

export type Converted = { bundle: SeasonBundle; weeks: WeekData[]; regEnd: number; names: Record<string, [string, string[]]> };

/** Yahoo lineup slots in Sleeper's names (the replay knows which positions fill each). */
const SLOT: Record<string, string> = {
  "W/R/T": "FLEX",
  "W/R": "WRRB_FLEX",
  "W/T": "REC_FLEX",
  "Q/W/R/T": "SUPER_FLEX",
  D: "IDP_FLEX",
  "D/ST": "DEF",
};
const NON_PLAYER = new Set(["BN", "IR", "IR+", "NA", "W/R/T", "W/R", "W/T", "Q/W/R/T", "Util"]);

const r1 = (x: number) => Math.round(x * 10) / 10;

export function convertSeason(raw: YSeasonRaw, idx: Record<string, string>, dir: PlayerDir): Converted {
  const pidOf = (yid: string) => idx[yid] ?? `y${yid}`;
  const names: Record<string, [string, string[]]> = {};
  // Lookups fall through to Sleeper's directory; players it doesn't know get Yahoo's name/positions.
  const look = Object.create(dir) as Record<string, [string, string[], ...unknown[]]>;
  const see = (yid: string, name: string, pos: string[]) => {
    const pid = pidOf(yid);
    if (!dir[pid] && !names[pid]) look[pid] = names[pid] = [name, pos.filter((p) => !NON_PLAYER.has(p))];
    return pid;
  };
  const teamId = new Map(raw.teams.map((t) => [t.key, t.id]));
  const rid = (key: string | null) => (key ? (teamId.get(key) ?? Number(key.split(".t.")[1] ?? 0)) : 0);

  const regEnd = raw.playoffStart > 0 ? raw.playoffStart - 1 : raw.endWeek;
  const roster_positions = raw.positions.flatMap((p) => Array.from({ length: p.count }, () => SLOT[p.pos] ?? p.pos));

  const league: SLeague = {
    league_id: raw.key,
    name: raw.name,
    season: raw.season,
    status: raw.status,
    sport: "nfl",
    avatar: null,
    total_rosters: raw.teams.length,
    draft_id: null,
    previous_league_id: null,
    roster_positions,
    // Yahoo scores the league itself; these weights only mark it as a points league.
    scoring_settings: { pts: 1 },
    settings: {
      start_week: raw.startWeek,
      playoff_week_start: raw.playoffStart || raw.endWeek + 1,
      playoff_teams: raw.playoffTeams,
      league_average_match: 0,
    },
  };

  // W/L/T string per finished regular-season week, like Sleeper's roster metadata.record.
  const record = new Map<number, string>();
  for (const w of raw.weeks)
    if (w.week <= regEnd)
      for (const m of w.matchups)
        for (const t of m.teams) {
          const id = rid(t.key);
          const r = m.tied ? "T" : m.winner === t.key ? "W" : "L";
          record.set(id, (record.get(id) ?? "") + r);
        }
  const moves = new Map<number, number>();
  for (const t of raw.txns) for (const mv of t.moves) if (mv.kind === "add" && mv.to) moves.set(rid(mv.to), (moves.get(rid(mv.to)) ?? 0) + 1);

  const users: SUser[] = raw.teams.map((t) => ({ user_id: t.guid, display_name: t.nick, avatar: null, metadata: { team_name: t.name } }));
  const rosters: SRoster[] = raw.teams.map((t) => ({
    roster_id: t.id,
    owner_id: t.guid,
    players: null,
    settings: {
      wins: t.w,
      losses: t.l,
      ties: t.t,
      fpts: Math.floor(t.pf),
      fpts_decimal: Math.round((t.pf - Math.floor(t.pf)) * 100),
      fpts_against: Math.floor(t.pa),
      fpts_against_decimal: Math.round((t.pa - Math.floor(t.pa)) * 100),
      total_moves: moves.get(t.id) ?? 0,
    },
    metadata: { record: record.get(t.id) ?? "" },
  }));

  // Winners bracket from the playoff weeks: round 1 is the first playoff week. Later rounds keep
  // only games between winners of the round before (the title game gets p: 1, third place p: 3).
  const winners: SBracket[] = [];
  if (raw.playoffStart > 0) {
    let m = 1;
    const won = new Map<number, Set<number>>();
    const lost = new Map<number, Set<number>>();
    for (const w of raw.weeks.filter((x) => x.week >= raw.playoffStart).sort((a, b) => a.week - b.week)) {
      const r = w.week - raw.playoffStart + 1;
      const games = w.matchups.filter((g) => g.playoffs && !g.consolation && g.teams.length === 2);
      const wr = (won.get(r) ?? won.set(r, new Set()).get(r)!);
      const lr = (lost.get(r) ?? lost.set(r, new Set()).get(r)!);
      for (const g of games) {
        const [a, b] = g.teams.map((t) => rid(t.key));
        const winner = g.winner ? rid(g.winner) : null;
        const loser = winner == null ? null : winner === a ? b : a;
        const prevWon = won.get(r - 1);
        const prevLost = lost.get(r - 1);
        const fromWinners = r === 1 || (!!prevWon && (prevWon.has(a) || prevWon.has(b)) && !(prevLost?.has(a) || prevLost?.has(b)));
        const fromLosers = r > 1 && !!prevLost && prevLost.has(a) && prevLost.has(b);
        if (!fromWinners && !fromLosers) continue;
        if (winner != null) wr.add(winner);
        if (loser != null) lr.add(loser);
        winners.push({ r, m: m++, t1: a, t2: b, w: winner, l: loser, t1_from: r === 1 ? null : fromWinners ? { w: 1 } : { l: 1 }, p: null });
      }
    }
    const maxR = Math.max(0, ...winners.map((g) => g.r));
    for (const g of winners) if (g.r === maxR) g.p = g.t1_from?.l ? 3 : maxR === 1 || g.t1_from?.w ? 1 : null;
  }

  const picks: SPick[] = raw.picks.map((p) => {
    const pid = pidOf(p.yid);
    const nm = dir[pid]?.[0] ?? names[pid]?.[0] ?? pid;
    const [first, ...rest] = nm.split(" ");
    const team = raw.teams.find((t) => t.key === p.team);
    return { pick_no: p.pick, round: p.round, roster_id: rid(p.team), player_id: pid, picked_by: team?.guid ?? "", metadata: { first_name: first, last_name: rest.join(" ") } };
  });

  // Transactions by week (Yahoo gives timestamps; its game weeks give the windows).
  const weekOf = (ts: number) => {
    const day = new Date(ts * 1000).toISOString().slice(0, 10);
    const hit = raw.calendar.find((c) => day >= c.start && day <= c.end);
    if (hit) return hit.week;
    return raw.calendar.length && day < raw.calendar[0].start ? raw.startWeek : null;
  };
  const txByWeek = new Map<number, STransaction[]>();
  raw.txns.forEach((t, i) => {
    const wk = weekOf(t.ts);
    if (wk == null) return;
    const adds: Record<string, number> = {};
    const drops: Record<string, number> = {};
    for (const mv of t.moves) {
      const pid = see(mv.yid, mv.name, mv.pos);
      if (mv.kind === "add" && mv.to) adds[pid] = rid(mv.to);
      if (mv.kind === "drop" && mv.from) drops[pid] = rid(mv.from);
    }
    if (!Object.keys(adds).length) return;
    (txByWeek.get(wk) ?? txByWeek.set(wk, []).get(wk)!).push({
      transaction_id: `${raw.key}:${i}`,
      type: t.type === "trade" ? "trade" : "free_agent",
      status: "complete",
      created: t.ts * 1000,
      leg: wk,
      adds,
      drops,
    });
  });

  // Weeks: every team's roster with each player's points and slot -> Sleeper-style matchups.
  const weeks: WeekData[] = [];
  for (const w of [...raw.weeks].sort((a, b) => a.week - b.week)) {
    const mid = new Map<string, number>();
    const pts = new Map<string, number>();
    w.matchups.forEach((g, i) => g.teams.forEach((t) => (mid.set(t.key, i + 1), pts.set(t.key, t.pts))));
    const matchups: SMatchup[] = Object.entries(w.rosters).map(([key, players]) => {
      const pp: Record<string, number> = {};
      const starters: string[] = [];
      const sp: number[] = [];
      for (const p of players) {
        const pid = see(p.yid, p.name, p.pos);
        pp[pid] = r1(p.pts);
        if (p.slot !== "BN" && !p.slot.startsWith("IR") && p.slot !== "NA") {
          starters.push(pid);
          sp.push(r1(p.pts));
        }
      }
      return {
        roster_id: rid(key),
        matchup_id: mid.get(key) ?? null,
        points: pts.get(key) ?? r1(sp.reduce((a, b) => a + b, 0)),
        players: Object.keys(pp),
        starters,
        starters_points: sp,
        players_points: pp,
      };
    });
    weeks.push(replayFootballWeek(league, w.week, matchups, txByWeek.get(w.week) ?? [], look));
  }

  const bundle: SeasonBundle = { league, users, rosters, winners, losers: [], picks, fetchedAt: new Date().toISOString() };
  return { bundle, weeks, regEnd, names };
}
