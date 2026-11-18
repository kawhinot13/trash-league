import { sportOf } from "@/lib/core/sport";
import type { SeasonBundle } from "@/lib/app/family";
import type { WeekData } from "@/lib/app/replay";
import { official, seasonYears, type SLeague } from "@/lib/app/sleeper";

const officialPf = (st: Record<string, number>) => Math.round(official(st).pf * 10) / 10;

/** Which weeks a season has: regular season plus playoff rounds (Sleeper's round settings). */
export function seasonWeeks(league: SLeague, currentSeason: string, currentWeek: number) {
  const s = league.settings ?? {};
  const start = Math.max(1, s.start_week || 1);
  const poStart = s.playoff_week_start || 22;
  const teams = s.playoff_teams || 6;
  const rounds = Math.ceil(Math.log2(Math.max(2, teams)));
  // playoff_round_type: 0 one week a round, 1 two-week final, 2 two weeks every round.
  const span = s.playoff_round_type === 2 ? rounds * 2 : rounds + (s.playoff_round_type === 1 ? 1 : 0);
  const last = poStart + span - 1;
  if (league.status === "complete") return { weeks: range(start, last), regEnd: poStart - 1, finalUpTo: last };
  if (league.status === "pre_draft" || league.status === "drafting") return { weeks: [], regEnd: poStart - 1, finalUpTo: 0 };
  // In season: weeks before the current one are played. The latest one can still get stat
  // corrections, so it stays provisional and is replayed again the next night.
  const done = league.season === currentSeason ? Math.min(last, currentWeek - 1) : last;
  return { weeks: range(start, done), regEnd: poStart - 1, finalUpTo: done - 1 };
}
const range = (a: number, b: number) => (b < a ? [] : Array.from({ length: b - a + 1 }, (_, i) => a + i));

export type Who = string; // owner (Sleeper user id), or "r<roster id>" for an open team
export type LineupRow = {
  who: Who;
  act: number;
  opt: number;
  weeks: number;
  perfect: number;
  seasons: { season: string; act: number; opt: number; weeks: number }[];
  worst: { season: string; week: number; act: number; opt: number } | null;
};
export type GradedTrade = {
  season: string;
  years: string;
  week: number;
  ts: number;
  sides: { who: Who; got: string[]; pts: number; held: number; starts: number }[];
  winner: Who | null;
  margin: number;
  /** Replayed weeks after the trade (0: too soon to judge). */
  weeksAfter: number;
};
export type Pickup = { who: Who; pid: string; season: string; years: string; week: number; pts: number; starts: number };
/** One head-to-head game, per Sleeper's weekly matchup scores. */
export type Game = { season: string; years: string; week: number; a: Who; b: Who; pa: number; pb: number; playoff: boolean };

// 10: custom-pack leagues plan Dumpster Dive in the pack's names (Trash on Rafterlore).
export const ANALYSIS_VERSION = 10;
export type Analysis = {
  version: number;
  /** Every regular-season and playoff (winners bracket) meeting, per Sleeper. */
  games: Game[];
  computedAt: string;
  model: Record<string, "one" | "all">;
  /** Margin under which a trade is called even, scaled to the league's scoring. */
  even: number;
  lineups: LineupRow[];
  crimes: { who: Who; season: string; years: string; week: number; act: number; opt: number }[];
  seasons: { season: string; years: string; eff: number; weeks: number; live: boolean }[];
  trades: GradedTrade[];
  dealers: { who: Who; w: number; l: number; e: number; net: number }[];
  pickups: Pickup[];
  players: Record<string, [string, string[]]>;
  weeksReplayed: number;
  misfits: number;
};

/**
 * `exact`: "league|roster|week" -> that week's official score, from consecutive nightly snapshots.
 */
/** One season's replayed weeks. `current` holds the week in progress: only its trades are used
 * (lineups and scores aren't final until the week ends, but a trade is final when it's made). */
export type SeasonInput = { bundle: SeasonBundle; weeks: WeekData[]; regEnd: number; current?: WeekData };

export function analyse(
  seasons: SeasonInput[],
  exact: Map<string, number> = new Map(),
): Analysis {
  const lineups = new Map<Who, LineupRow>();
  const crimes: Analysis["crimes"] = [];
  const bySeason: Analysis["seasons"] = [];
  const trades: GradedTrade[] = [];
  const pickups: Pickup[] = [];
  const players: Analysis["players"] = {};
  const model: Analysis["model"] = {};
  const games: Game[] = [];
  let weeklyTotal = 0;
  let weeklyN = 0;
  let misfits = 0;
  let replayed = 0;

  for (const { bundle, weeks, regEnd, current } of seasons) {
    const lg = bundle.league;
    const years = seasonYears(lg.season, sportOf(lg));
    const who = new Map<number, Who>(bundle.rosters.map((r) => [r.roster_id, r.owner_id ?? `r${r.roster_id}`]));
    const W = (rid: number | string) => who.get(Number(rid)) ?? `r${rid}`;
    for (const w of weeks) Object.assign(players, w.names);
    replayed += weeks.length;

    // Pick the scoring model that explains Sleeper's own scores: the tight "one game per slot"
    // model if it covers nine in ten team-weeks, otherwise "every game counts".
    const reg = weeks.filter((w) => w.week <= regEnd);
    const tw = reg.flatMap((w) => w.teams).filter((t) => t.pts > 0);
    const fitOne = tw.filter((t) => t.pts <= t.one + 0.05).length;
    const m = tw.length && fitOne / tw.length >= 0.9 ? "one" : "all";
    model[lg.league_id] = m;

    // Official totals beat Sleeper's weekly matchup scores: a team's season act is its official
    // points for whenever the replay covers every week that total includes; single weeks use the
    // exact nightly-snapshot difference when there is one, else Sleeper's matchup score.
    const off = new Map(bundle.rosters.map((r) => [r.roster_id, { pf: officialPf(r.settings ?? {}), done: (r.metadata?.record ?? "").length }]));
    const per = new Map<number, { week: number; act: number; opt: number }[]>();
    for (const w of reg)
      for (const t of w.teams) {
        if (t.pts <= 0 && t.st.length === 0) continue;
        const raw = m === "one" ? t.one : t.all;
        const act = exact.get(`${lg.league_id}|${t.rid}|${w.week}`) ?? t.pts;
        if (act > raw + 0.05) misfits += 1;
        // The real score is the truth; if the replay can't explain it, never claim more than 100%.
        const opt = Math.max(raw, act);
        (per.get(t.rid) ?? per.set(t.rid, []).get(t.rid)!).push({ week: w.week, act, opt });
      }
    let sa = 0;
    let so = 0;
    for (const [rid, wks] of per) {
      const id = W(rid);
      const o = off.get(rid);
      const opt = wks.reduce((a, x) => a + x.opt, 0);
      const act = o && o.done === wks.length && o.pf > 0 ? Math.min(o.pf, opt) : wks.reduce((a, x) => a + x.act, 0);
      const row = lineups.get(id) ?? { who: id, act: 0, opt: 0, weeks: 0, perfect: 0, seasons: [], worst: null };
      row.act += act;
      row.opt += opt;
      row.weeks += wks.length;
      row.seasons.push({ season: lg.season, act, opt, weeks: wks.length });
      for (const x of wks) {
        if (x.opt > 0 && x.act / x.opt >= 0.97) row.perfect += 1;
        if (!row.worst || x.opt - x.act > row.worst.opt - row.worst.act) row.worst = { season: lg.season, week: x.week, act: x.act, opt: x.opt };
        crimes.push({ who: id, season: lg.season, years, week: x.week, act: x.act, opt: x.opt });
        weeklyTotal += x.act;
        weeklyN += 1;
      }
      lineups.set(id, row);
      sa += act;
      so += opt;
    }
    if (so > 0) bySeason.push({ season: lg.season, years, eff: sa / so, weeks: reg.length, live: lg.status !== "complete" });

    // Who started whom, and who rostered whom, each week.
    const starts = new Map<string, Map<string, number>>(); // `${rid}|${week}` -> pid -> pts
    const rostered = new Map<string, Set<string>>();
    for (const w of weeks)
      for (const t of w.teams) {
        starts.set(`${t.rid}|${w.week}`, new Map(t.st.map((p, i) => [p, t.sp[i] ?? 0])));
        rostered.set(`${t.rid}|${w.week}`, new Set(t.pl));
      }
    const weekNos = weeks.map((w) => w.week);

    // Each player's average lock-in this season: points per week in any team's starting lineup.
    const lockAvg = new Map<string, number>();
    {
      const tot = new Map<string, [number, number]>();
      for (const m of starts.values())
        for (const [p, v] of m) {
          const t = tot.get(p) ?? [0, 0];
          t[0] += v;
          t[1] += 1;
          tot.set(p, t);
        }
      for (const [p, [sum, n]] of tot) lockAvg.set(p, sum / n);
    }

    // Who played at least one game each week (from the replay; started players count when an old
    // replay lacks it).
    const played = new Set<string>();
    for (const w of weeks) {
      if (w.best) {
        for (const [p, [, n]] of Object.entries(w.best)) if (n > 0) played.add(`${w.week}|${p}`);
      } else {
        for (const t of w.teams) t.st.forEach((p, i) => (t.sp[i] ?? 0) !== 0 && played.add(`${w.week}|${p}`));
      }
    }

    // Trade grades: for the rest of the season (playoffs included), each incoming player earns his
    // average lock-in for every week he's on that manager's roster and plays at least one game,
    // started or not (sitting him is the manager's call, not the trade's fault; injured weeks earn
    // nothing). One lucky or unlucky game doesn't decide a trade. Also how many weeks they stayed.
    for (const w of current ? [...weeks, current] : weeks)
      for (const t of w.trades) {
        const later = weekNos.filter((x) => x > w.week);
        const sides = Object.entries(t.sides).map(([rid, got]) => {
          let pts = 0;
          let held = 0;
          let n = 0;
          for (const x of later)
            for (const p of got) {
              if (!rostered.get(`${rid}|${x}`)?.has(p)) continue;
              held += 1;
              if (played.has(`${x}|${p}`)) {
                pts += lockAvg.get(p) ?? 0;
                n += 1;
              }
            }
          return { who: W(rid), got, pts: Math.round(pts * 10) / 10, held, starts: n };
        });
        trades.push({ season: lg.season, years, week: w.week, ts: t.ts, sides, winner: null, margin: 0, weeksAfter: later.length });
      }

    // Head-to-head games: teams sharing a matchup id. In the playoffs only real bracket games count
    // (Sleeper also pairs teams in consolation weeks).
    const bracketPairs = new Set(
      bundle.winners.filter((m) => m.t1 != null && m.t2 != null).map((m) => [m.t1, m.t2].sort((x, y) => x! - y!).join("-")),
    );
    for (const w of weeks) {
      const byMid = new Map<number, typeof w.teams>();
      for (const t of w.teams) if (t.mid != null) (byMid.get(t.mid) ?? byMid.set(t.mid, []).get(t.mid)!).push(t);
      for (const pair of byMid.values()) {
        if (pair.length !== 2) continue;
        const [x, y] = pair.sort((p, q) => p.rid - q.rid);
        const playoff = w.week > regEnd;
        if (playoff && !bracketPairs.has(`${x.rid}-${y.rid}`)) continue;
        if (x.pts === 0 && y.pts === 0) continue;
        games.push({ season: lg.season, years, week: w.week, a: W(x.rid), b: W(y.rid), pa: x.pts, pb: y.pts, playoff });
      }
    }

    // Pickups: free-agent and waiver adds, by what they scored as that manager's starter afterwards.
    for (const w of weeks)
      for (const [rid, pid] of w.adds) {
        let pts = 0;
        let n = 0;
        for (const x of weekNos.filter((y) => y >= w.week)) {
          const v = starts.get(`${rid}|${x}`)?.get(pid);
          if (v != null) {
            pts += v;
            n += 1;
          }
        }
        if (pts > 0) pickups.push({ who: W(rid), pid, season: lg.season, years, week: w.week, pts: Math.round(pts * 10) / 10, starts: n });
      }
  }

  // "Even" scales with the league's scoring: about an eighth of an average weekly score
  // (60 points in a league that averages ~500 a week).
  const avgWeek = weeklyN ? weeklyTotal / weeklyN : 400;
  const even = Math.max(10, Math.round(avgWeek * 0.12));
  for (const t of trades) {
    const ranked = [...t.sides].sort((a, b) => b.pts - a.pts);
    t.margin = ranked.length > 1 ? Math.round((ranked[0].pts - ranked[1].pts) * 10) / 10 : 0;
    t.winner = t.weeksAfter > 0 && t.margin >= even ? ranked[0].who : null;
  }
  trades.sort((a, b) => b.ts - a.ts);
  const dealers = new Map<Who, Analysis["dealers"][number]>();
  for (const t of trades)
    for (const s of t.sides) {
      const r = dealers.get(s.who) ?? { who: s.who, w: 0, l: 0, e: 0, net: 0 };
      if (t.weeksAfter === 0) continue;
      if (!t.winner) r.e += 1;
      else if (t.winner === s.who) r.w += 1;
      else r.l += 1;
      r.net += s.pts - t.sides.filter((x) => x.who !== s.who).reduce((a, x) => a + x.pts, 0);
      dealers.set(s.who, r);
    }

  const rows = [...lineups.values()].sort((a, b) => b.act / b.opt - a.act / a.opt);
  crimes.sort((a, b) => b.opt - b.act - (a.opt - a.act));
  pickups.sort((a, b) => b.pts - a.pts);
  const top = pickups.slice(0, 12);
  const need = new Set<string>([
    ...trades.flatMap((t) => t.sides.flatMap((s) => s.got)),
    ...top.map((p) => p.pid),
  ]);
  return {
    version: ANALYSIS_VERSION,
    games,
    computedAt: new Date().toISOString(),
    model,
    even,
    lineups: rows,
    crimes: crimes.slice(0, 10),
    seasons: bySeason,
    trades,
    dealers: [...dealers.values()].map((d) => ({ ...d, net: Math.round(d.net) })).sort((a, b) => b.net - a.net),
    pickups: top,
    players: Object.fromEntries(Object.entries(players).filter(([p]) => need.has(p))),
    weeksReplayed: replayed,
    misfits,
  };
}
