import type { Dataset, Season, Standing } from "@/lib/core/types";

/**
 * The Trapezoid of Excellence: which managers have the regular-season profile of a champion.
 *
 * X: regular-season win percentage (wins / games; ties count as games, not wins).
 * Y: average points for per matchup (official regular-season points for / completed scoring
 *    periods), and the Scoring Index (that average / the league's average x 100), which makes
 *    different seasons and scoring systems comparable.
 *
 * The excellence window has a scoring floor F, a base win rate B and a slope K: a manager is inside
 * when S >= F and W >= max(0, B - K (S - F)). It's open at the top and right. F and B come from the
 * league's own champions, using only seasons that finished before the one being charted (no
 * leakage). All numbers are regular season only; playoffs are reported separately.
 */

export type TrapConfig = {
  /** Provisional floor and base win rate when fewer than 3 champions exist. */
  provisionalFloor: number;
  provisionalBase: number;
  /** Safeguards: the floor and base never go below these. */
  minFloor: number;
  minBase: number;
  /** Required win rate drops this much per Scoring Index point above the floor. */
  slope: number;
  /** With 8+ champions, the percentile of champion profiles used. */
  percentile: number;
  /** "On the bubble": within this many index points / this much win rate of the window. */
  bubbleIndex: number;
  bubbleWin: number;
};

export const TRAP_CONFIG: TrapConfig = {
  provisionalFloor: 105,
  provisionalBase: 0.5,
  minFloor: 100,
  minBase: 0.45,
  slope: 0.005,
  percentile: 0.2,
  bubbleIndex: 3,
  bubbleWin: 0.05,
};

export type Thresholds = {
  floor: number;
  base: number;
  slope: number;
  /** provisional: under 3 champions; lowest: 3-7 (lowest champion); percentile: 8+. */
  basis: "provisional" | "lowest" | "percentile";
  /** Champion seasons the thresholds were built from. */
  from: string[];
};

export type Classification = "Elite Contender" | "On the Bubble" | "Sleeping Giant" | "Record Merchant" | "Outside the Window" | "Small Sample";

export type TrapPoint = {
  id: string;
  /** Win rate 0-1. */
  win: number;
  /** Average points for per matchup (Infinity-free; 0 if unavailable). */
  avg: number;
  /** Scoring Index (100 = league average). */
  index: number;
  w: number;
  l: number;
  t: number;
  games: number;
  periods: number;
  /** Average points against and point differential per matchup (null when unavailable). */
  pa: number | null;
  diff: number | null;
  /** Average points above/below the league average per matchup. */
  vsAvg: number;
  transactions: number;
  /** Transactions per completed scoring period. */
  txRate: number;
  seasons: number;
  playoffApps: number;
  /** Completed seasons played (the denominator for playoff %). */
  eligible: number;
  playoffW: number;
  playoffL: number;
  finals: number;
  titles: string[];
  inside: boolean;
  /** Win rate needed at this scoring level (null when below the floor). */
  needed: number | null;
  cls: Classification;
  /** Seasonal views: seed, and whether the playoff spot is final. */
  seed?: number;
  playoffSpot?: "champion" | "finalist" | "playoffs" | "missed" | "projected-in" | "projected-out";
};

export type TrapView = {
  key: string;
  label: string;
  kind: "all" | "current" | "season";
  /** Years label for seasonal views. */
  years?: string;
  /** League average points per matchup (seasonal views). */
  leagueAvg: number | null;
  /** Seasonal: progress through the regular season and the sample label. */
  played?: number;
  scheduled?: number | null;
  stage?: string;
  th: Thresholds;
  points: TrapPoint[];
  /** Champion of this season, once decided. */
  champion?: string | null;
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};
const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return 0;
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  return s[lo] + (s[Math.min(s.length - 1, lo + 1)] - s[lo]) * (i - lo);
};

/** A season whose numbers can be charted: points leagues with completed regular-season games. */
const playable = (s: Season) => s.status !== "pre_draft" && s.status !== "drafting" && s.standings.some((x) => x.w + x.l + x.t > 0 && x.pf > 0);
/** Real managers only: open rosters ("r5") count toward the league average but aren't plotted. */
const isManager = (id: string) => !/^r\d+$/.test(id);

type Ext = Standing & { pa?: number; adds?: number };

/** Scoring periods: one per regular-season week, even when the league also plays the median. */
function periodsOf(s: Season, x: Standing) {
  const games = x.w + x.l + x.t;
  return s.median ? games / 2 : games;
}

/** Season-level facts: league average, each manager's numbers, playoff results. */
export function seasonStats(d: Dataset, s: Season) {
  const teams = s.standings.map((x) => ({ x: x as Ext, periods: periodsOf(s, x) })).filter((t) => t.periods > 0);
  const totalPf = teams.reduce((a, t) => a + t.x.pf, 0);
  const totalPeriods = teams.reduce((a, t) => a + t.periods, 0);
  const leagueAvg = totalPeriods ? totalPf / totalPeriods : 0;
  const complete = s.status === "complete";
  const inBracket = new Set(s.bracket.flatMap((g) => [g.a, g.b]).filter(Boolean));
  const tradesBy = new Map<string, number>();
  for (const t of s.trades) for (const who of Object.keys(t.sides)) tradesBy.set(who, (tradesBy.get(who) ?? 0) + 1);
  const pw = new Map<string, [number, number]>();
  if (complete)
    for (const g of s.bracket)
      if (g.winner && g.a && g.b) {
        const loser = g.winner === g.a ? g.b : g.a;
        (pw.get(g.winner) ?? pw.set(g.winner, [0, 0]).get(g.winner)!)[0] += 1;
        (pw.get(loser) ?? pw.set(loser, [0, 0]).get(loser)!)[1] += 1;
      }
  const rows = teams.map(({ x, periods }) => {
    const avg = x.pf / periods;
    return {
      id: x.manager,
      w: x.w,
      l: x.l,
      t: x.t,
      games: x.w + x.l + x.t,
      periods,
      pf: x.pf,
      pa: typeof x.pa === "number" ? x.pa : null,
      avg,
      index: leagueAvg ? (avg / leagueAvg) * 100 : 0,
      seed: x.seed,
      transactions: (x.adds ?? 0) + (tradesBy.get(x.manager) ?? 0),
      playoffs: complete ? inBracket.has(x.manager) : null,
      playoffW: pw.get(x.manager)?.[0] ?? 0,
      playoffL: pw.get(x.manager)?.[1] ?? 0,
      champion: complete && s.champion === x.manager,
      finalist: complete && (s.champion === x.manager || s.runnerUp === x.manager),
    };
  });
  return { season: s, leagueAvg, rows, complete, inBracket };
}

/** The champion's regular-season profile for every completed season, in order. */
export function championProfiles(d: Dataset) {
  return d.league.seasons
    .filter((s) => s.status === "complete" && s.champion && playable(s))
    .map((s) => {
      const st = seasonStats(d, s);
      const r = st.rows.find((x) => x.id === s.champion);
      return r ? { code: s.code, years: s.years, id: r.id, index: r.index, win: winRate(r), avg: r.avg, games: r.games, seed: r.seed } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

const winRate = (x: { w: number; games: number }) => (x.games ? x.w / x.games : 0);

/** The window, from champions of the given seasons (pass only seasons before the one charted). */
export function thresholdsFrom(champs: ReturnType<typeof championProfiles>, cfg = TRAP_CONFIG): Thresholds {
  const from = champs.map((c) => c.code);
  if (champs.length < 3) return { floor: cfg.provisionalFloor, base: cfg.provisionalBase, slope: cfg.slope, basis: "provisional", from };
  const idx = champs.map((c) => c.index);
  const wins = champs.map((c) => c.win);
  const pick = champs.length >= 8 ? (xs: number[]) => quantile(xs, cfg.percentile) : (xs: number[]) => Math.min(...xs);
  return {
    floor: Math.max(cfg.minFloor, pick(idx)),
    base: Math.max(cfg.minBase, pick(wins)),
    slope: cfg.slope,
    basis: champs.length >= 8 ? "percentile" : "lowest",
    from,
  };
}

/** Win rate needed at Scoring Index S (null below the floor). */
export const needed = (th: Thresholds, s: number) => (s < th.floor ? null : Math.max(0, th.base - th.slope * (s - th.floor)));
export const inside = (th: Thresholds, s: number, w: number) => s >= th.floor && w >= th.base - th.slope * (s - th.floor) - 1e-9;

export function classify(th: Thresholds, s: number, w: number, small: boolean, cfg = TRAP_CONFIG): Classification {
  if (small) return "Small Sample";
  if (inside(th, s, w)) return "Elite Contender";
  // Distance to the window on each axis.
  const near = s >= th.floor - cfg.bubbleIndex && w >= th.base - th.slope * (Math.max(s, th.floor) - th.floor) - cfg.bubbleWin;
  if (near) return "On the Bubble";
  if (s >= th.floor) return "Sleeping Giant";
  if (w >= th.base) return "Record Merchant";
  return "Outside the Window";
}

/** Regular-season weeks scheduled: the league's setting, else the longest earlier completed season. */
function scheduledWeeks(d: Dataset, s: Season) {
  if (s.regWeeks) return s.regWeeks;
  const i = d.league.seasons.indexOf(s);
  const prev = d.league.seasons
    .slice(0, i)
    .filter((x) => x.status === "complete" && playable(x))
    .map((x) => Math.max(...x.standings.map((r) => periodsOf(x, r))));
  return prev.length ? prev[prev.length - 1] : null;
}

export function stageOf(played: number, scheduled: number | null, complete: boolean) {
  if (complete) return "Final regular-season profile";
  if (!scheduled) return "In progress";
  const f = played / scheduled;
  if (f < 0.25) return "Early-season provisional results";
  if (f <= 0.5) return "Developing results";
  if (f < 1) return "More established results";
  return "Final regular-season profile";
}

/** Playoff spots in a season: the setting, else the bracket's size. */
const playoffSpots = (s: Season) => s.playoffTeams ?? new Set(s.bracket.flatMap((g) => [g.a, g.b]).filter(Boolean)).size;

/** One season's chart. Thresholds come only from champions of seasons that finished before it. */
export function seasonView(d: Dataset, s: Season, cfg = TRAP_CONFIG): TrapView {
  const i = d.league.seasons.indexOf(s);
  const earlier = championProfiles(d).filter((c) => d.league.seasons.findIndex((x) => x.code === c.code) < i);
  const th = thresholdsFrom(earlier, cfg);
  const st = seasonStats(d, s);
  const played = Math.max(0, ...st.rows.map((r) => r.periods));
  const scheduled = scheduledWeeks(d, s);
  const current = !st.complete;
  const stage = stageOf(played, scheduled, st.complete);
  const small = current && (!scheduled || played / scheduled < 0.25);
  const spots = playoffSpots(s);
  const points: TrapPoint[] = st.rows
    .filter((r) => isManager(r.id))
    .map((r) => {
      const win = winRate(r);
      const prior = d.league.seasons.slice(0, i).filter((x) => x.status === "complete");
      return {
        id: r.id,
        win,
        avg: r.avg,
        index: r.index,
        w: r.w,
        l: r.l,
        t: r.t,
        games: r.games,
        periods: r.periods,
        pa: r.pa === null ? null : r.pa / r.periods,
        diff: r.pa === null ? null : (r.pf - r.pa) / r.periods,
        vsAvg: r.avg - st.leagueAvg,
        transactions: r.transactions,
        txRate: r.periods ? r.transactions / r.periods : 0,
        seasons: 1,
        playoffApps: r.playoffs ? 1 : 0,
        eligible: st.complete ? 1 : 0,
        playoffW: r.playoffW,
        playoffL: r.playoffL,
        finals: r.finalist ? 1 : 0,
        // Titles won before or in this season (the tooltip shows earlier ones as context).
        titles: [...prior, ...(st.complete ? [s] : [])].filter((x) => x.champion === r.id).map((x) => x.code),
        inside: inside(th, r.index, win),
        needed: needed(th, r.index),
        cls: classify(th, r.index, win, small, cfg),
        seed: r.seed,
        playoffSpot: st.complete
          ? r.champion
            ? "champion"
            : r.finalist
              ? "finalist"
              : r.playoffs
                ? "playoffs"
                : "missed"
          : spots && r.seed
            ? r.seed <= spots
              ? "projected-in"
              : "projected-out"
            : undefined,
      };
    });
  return {
    key: s.code,
    label: current ? "This season" : s.years,
    kind: current ? "current" : "season",
    years: s.years,
    leagueAvg: st.leagueAvg,
    played,
    scheduled,
    stage,
    th,
    points,
    champion: st.complete ? s.champion : null,
  };
}

/** Career numbers across every charted season, the current one included (completed games only). */
export function allTimeView(d: Dataset, cfg = TRAP_CONFIG): TrapView {
  const champs = championProfiles(d);
  const th = thresholdsFrom(champs, cfg);
  type Acc = Omit<TrapPoint, "win" | "avg" | "index" | "inside" | "needed" | "cls" | "pa" | "diff" | "vsAvg" | "txRate"> & {
    pf: number;
    paSum: number;
    paPeriods: number;
    idxWeighted: number;
    vsSum: number;
  };
  const acc = new Map<string, Acc>();
  const seasons = d.league.seasons.filter(playable);
  const fullSeason = median(seasons.filter((s) => s.status === "complete").map((s) => Math.max(...s.standings.map((r) => periodsOf(s, r)))));
  for (const s of seasons) {
    const st = seasonStats(d, s);
    for (const r of st.rows) {
      if (!isManager(r.id)) continue;
      const a =
        acc.get(r.id) ??
        acc
          .set(r.id, {
            id: r.id,
            w: 0,
            l: 0,
            t: 0,
            games: 0,
            periods: 0,
            pf: 0,
            paSum: 0,
            paPeriods: 0,
            idxWeighted: 0,
            vsSum: 0,
            transactions: 0,
            seasons: 0,
            playoffApps: 0,
            eligible: 0,
            playoffW: 0,
            playoffL: 0,
            finals: 0,
            titles: [],
          })
          .get(r.id)!;
      a.w += r.w;
      a.l += r.l;
      a.t += r.t;
      a.games += r.games;
      a.periods += r.periods;
      a.pf += r.pf;
      if (r.pa !== null) {
        a.paSum += r.pa;
        a.paPeriods += r.periods;
      }
      a.idxWeighted += r.index * r.periods;
      a.vsSum += (r.avg - st.leagueAvg) * r.periods;
      a.transactions += r.transactions;
      a.seasons += 1;
      if (st.complete) {
        a.eligible += 1;
        if (r.playoffs) a.playoffApps += 1;
        if (r.finalist) a.finals += 1;
        if (r.champion) a.titles.push(s.code);
      }
      a.playoffW += r.playoffW;
      a.playoffL += r.playoffL;
    }
  }
  const points: TrapPoint[] = [...acc.values()].map((a) => {
    const win = winRate(a);
    const index = a.periods ? a.idxWeighted / a.periods : 0;
    const small = !!fullSeason && a.periods < fullSeason * 0.5;
    const { pf, paSum, paPeriods, idxWeighted: _i, vsSum, ...rest } = a;
    void _i;
    return {
      ...rest,
      win,
      avg: a.periods ? pf / a.periods : 0,
      index,
      pa: paPeriods ? paSum / paPeriods : null,
      diff: paPeriods ? (pf - paSum) / paPeriods : null,
      vsAvg: a.periods ? vsSum / a.periods : 0,
      txRate: a.periods ? a.transactions / a.periods : 0,
      inside: inside(th, index, win),
      needed: needed(th, index),
      cls: classify(th, index, win, small, cfg),
    };
  });
  return { key: "all", label: "All-time", kind: "all", leagueAvg: null, th, points };
}

/** Every chart the league has: all-time, then the current season, then past seasons newest first. */
export function trapezoidViews(d: Dataset, cfg = TRAP_CONFIG): TrapView[] {
  const seasons = d.league.seasons.filter(playable);
  if (!seasons.length) return [];
  const views = [allTimeView(d, cfg)];
  const cur = seasons.filter((s) => s.status !== "complete");
  const past = seasons.filter((s) => s.status === "complete").reverse();
  for (const s of cur) views.push(seasonView(d, s, cfg));
  for (const s of past) views.push(seasonView(d, s, cfg));
  return views;
}

/** How the window would have done each completed season, using only champions from before it. */
export function backtest(d: Dataset, cfg = TRAP_CONFIG) {
  const rows = d.league.seasons
    .filter((s) => s.status === "complete" && playable(s))
    .map((s) => {
      const v = seasonView(d, s, cfg);
      const ins = v.points.filter((p) => p.inside);
      const fin = v.points.filter((p) => p.playoffSpot === "champion" || p.playoffSpot === "finalist");
      return {
        code: s.code,
        years: s.years,
        basis: v.th.basis,
        floor: v.th.floor,
        base: v.th.base,
        teams: v.points.length,
        insideCount: ins.length,
        championInside: v.points.find((p) => p.playoffSpot === "champion")?.inside ?? null,
        finalistsInside: fin.filter((p) => p.inside).length,
        finalists: fin.length,
        insideMadePlayoffs: ins.filter((p) => p.playoffSpot !== "missed").length,
        champion: s.champion,
      };
    });
  const scored = rows.filter((r) => r.championInside !== null);
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
  return {
    rows,
    summary: {
      seasons: rows.length,
      championCapture: scored.length ? scored.filter((r) => r.championInside).length / scored.length : null,
      finalistCapture: sum((r) => r.finalists) ? sum((r) => r.finalistsInside) / sum((r) => r.finalists) : null,
      contenderShare: sum((r) => r.teams) ? sum((r) => r.insideCount) / sum((r) => r.teams) : null,
      championsOutside: scored.filter((r) => !r.championInside).map((r) => ({ code: r.code, years: r.years, id: r.champion! })),
      insidePlayoffRate: sum((r) => r.insideCount) ? sum((r) => r.insideMadePlayoffs) / sum((r) => r.insideCount) : null,
    },
  };
}

/* ── Playoff report (separate from the trapezoid) ─────────────────────── */

export type PlayoffRow = {
  id: string;
  eligible: number;
  apps: number;
  w: number;
  l: number;
  titles: string[];
  finals: number;
  semis: number;
  /** Wins over a better seed, and losses to a worse seed. */
  upsetWins: number;
  upsetLosses: number;
  /** Playoff points per matchup (per Sleeper weekly scores) and how many matchups that covers. */
  ppm: number | null;
  ppmGames: number;
  /** Playoff scoring vs the same manager's regular-season weekly average that season, as % of that
   * season's league weekly average, per playoff matchup. Both sides come from Sleeper's weekly
   * scores, so they're compared like for like. null when no playoff scores could be matched. */
  lift: number | null;
};

/** Which weeks each bracket round covers: one week a round, or two (scores summed). */
function roundWeeks(s: Season, d: Dataset) {
  const raw = d.extras.seasons.find((x) => x.code === s.code);
  const rounds = Math.max(0, ...s.bracket.map((g) => g.round));
  const weeks = [...new Set((raw?.playoffs ?? []).map((p) => p.week))].sort((a, b) => a - b);
  if (!rounds || !weeks.length) return null;
  if (weeks.length === rounds) return (r: number) => [weeks[r - 1]];
  if (weeks.length === rounds * 2) return (r: number) => [weeks[2 * r - 2], weeks[2 * r - 1]];
  return null;
}

export function playoffReport(d: Dataset): PlayoffRow[] {
  const rows = new Map<string, PlayoffRow>();
  const row = (id: string) =>
    rows.get(id) ??
    rows
      .set(id, { id, eligible: 0, apps: 0, w: 0, l: 0, titles: [], finals: 0, semis: 0, upsetWins: 0, upsetLosses: 0, ppm: null, ppmGames: 0, lift: null })
      .get(id)!;
  const ptsSum = new Map<string, number>();
  const liftSum = new Map<string, number>();
  const liftN = new Map<string, number>();
  for (const s of d.league.seasons.filter((x) => x.status === "complete" && playable(x))) {
    const st = seasonStats(d, s);
    const seed = new Map(s.standings.map((x) => [x.manager, x.seed]));
    // Regular-season weekly averages from the same (per Sleeper) source as the playoff scores.
    const wk = d.extras.seasons.find((x) => x.code === s.code)?.weekly ?? {};
    const regSum = new Map<string, [number, number]>();
    for (const v of Object.values(wk))
      for (const [a, b, pa, pb] of v.games)
        for (const [id, pts] of [
          [a, pa],
          [b, pb],
        ] as const) {
          const t = regSum.get(id) ?? [0, 0];
          t[0] += pts;
          t[1] += 1;
          regSum.set(id, t);
        }
    const regAvg = new Map([...regSum].map(([id, [t, n]]) => [id, t / n]));
    const allReg = [...regSum.values()].reduce((a, [t, n]) => [a[0] + t, a[1] + n], [0, 0]);
    const leagueWeekly = allReg[1] ? allReg[0] / allReg[1] : 0;
    for (const r of st.rows) if (isManager(r.id)) row(r.id).eligible += 1;
    for (const id of st.inBracket) if (isManager(id)) row(id).apps += 1;
    if (s.champion && isManager(s.champion)) row(s.champion).titles.push(s.code);
    for (const id of [s.champion, s.runnerUp]) if (id && isManager(id)) row(id).finals += 1;
    const last = Math.max(0, ...s.bracket.map((g) => g.round));
    for (const g of s.bracket.filter((g) => g.round === last - 1)) for (const id of [g.a, g.b]) if (id && isManager(id)) row(id).semis += 1;
    if (last === 1) for (const id of [s.champion, s.runnerUp]) if (id && isManager(id)) row(id).semis += 1;
    const weeksOf = roundWeeks(s, d);
    const raw = d.extras.seasons.find((x) => x.code === s.code);
    for (const g of s.bracket) {
      if (!g.winner || !g.a || !g.b) continue;
      const loser = g.winner === g.a ? g.b : g.a;
      if (isManager(g.winner)) row(g.winner).w += 1;
      if (isManager(loser)) row(loser).l += 1;
      const sw = seed.get(g.winner) ?? 0;
      const sl = seed.get(loser) ?? 0;
      if (sw && sl && sw > sl) {
        if (isManager(g.winner)) row(g.winner).upsetWins += 1;
        if (isManager(loser)) row(loser).upsetLosses += 1;
      }
      // Playoff scores, when the bracket's rounds line up with the weekly data.
      if (!weeksOf || !raw) continue;
      for (const id of [g.a, g.b]) {
        if (!isManager(id)) continue;
        const ws = weeksOf(g.round);
        const games = ws.map((w) => raw.playoffs.find((p) => p.week === w && p.who === id));
        if (games.some((x) => !x)) continue;
        const pts = games.reduce((a, x) => a + x!.act, 0);
        const r = row(id);
        r.ppmGames += 1;
        ptsSum.set(id, (ptsSum.get(id) ?? 0) + pts);
        const reg = regAvg.get(id);
        if (reg !== undefined && leagueWeekly) {
          liftSum.set(id, (liftSum.get(id) ?? 0) + ((pts - reg * ws.length) / (leagueWeekly * ws.length)) * 100);
          liftN.set(id, (liftN.get(id) ?? 0) + 1);
        }
      }
    }
  }
  return [...rows.values()]
    .map((r) => {
      return {
        ...r,
        ppm: r.ppmGames ? (ptsSum.get(r.id) ?? 0) / r.ppmGames : null,
        lift: liftN.get(r.id) ? (liftSum.get(r.id) ?? 0) / liftN.get(r.id)! : null,
      };
    })
    .sort((a, b) => b.titles.length - a.titles.length || b.finals - a.finals || b.w - a.w || a.l - b.l);
}
