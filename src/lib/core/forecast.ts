import { championProfiles } from "@/lib/core/trapezoid";
import type { Dataset, Standing } from "@/lib/core/types";

/**
 * The Forecast: how this season's teams stack up against what it has taken to win this league.
 *
 * 1. The title line (history): the lowest official scoring index (points for per week, 100 = league
 *    average) any champion has had. Nobody has won here scoring less. Champions' best possible lineups
 *    (per Sleeper's weekly lineups, same index) are shown alongside.
 * 2. Strength now. Each team's best healthy lineup today (Front Office values) as the same index, and its
 *    official points for per week. Its projected weekly score blends the two: results count more as the
 *    season goes (games / (games + 5)), and the last three exact weekly scores, when proven, count for a
 *    quarter of the results part (current form).
 * 3. The season, played out. The rest of the regular season (Sleeper's schedule) and the playoff bracket
 *    (the league's own size and seeding by record, then points) are simulated RUNS times with weekly
 *    scores drawn around each team's projection, spread as much as this league's weeks really vary.
 * Pure and seeded, so the same inputs always give the same numbers.
 */
export const RUNS = 5000;
/** Games until results and roster count the same (results weight = games / (games + RESULTS_K)). */
export const RESULTS_K = 5;

export type TitleLine = {
  /** Lowest official scoring index any champion has had (points for per week, 100 = league average):
   * nobody has won here scoring less. Null without a finished season. */
  line: number | null;
  /** Lowest champion lineup index (per Sleeper weekly best lineups). */
  lineupLine: number | null;
  champs: { code: string; years: string; id: string; lineup: number | null; scoring: number; seed: number }[];
  /** How much a team's weekly score varies around its own average (median coefficient of variation). */
  cv: number;
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Each manager's average best-possible weekly lineup in a season, as an index of the league (100 = average). */
export function lineupIndex(lineups: Record<string, [number, number, number][]>, regWeeks?: number): Map<string, number> {
  const avg = new Map<string, number>();
  for (const [m, rows] of Object.entries(lineups)) {
    const xs = rows.filter(([w]) => !regWeeks || w <= regWeeks).map(([, , opt]) => opt).filter((x) => x > 0);
    if (xs.length) avg.set(m, mean(xs));
  }
  const league = mean([...avg.values()]);
  return new Map([...avg].map(([m, v]) => [m, league ? (100 * v) / league : 100]));
}

/** What it has taken to win here: the champions' lineup and scoring indexes, and how much weeks swing. */
export function titleLine(d: Dataset): TitleLine {
  const champs = championProfiles(d).map((c) => {
    const s = d.league.seasons.find((x) => x.code === c.code)!;
    const ex = d.extras.seasons.find((x) => x.code === c.code);
    const idx = ex ? lineupIndex(ex.lineups ?? {}, s.regWeeks).get(c.id) ?? null : null;
    return { code: c.code, years: c.years, id: c.id, lineup: idx, scoring: c.index, seed: c.seed };
  });
  const known = champs.map((c) => c.lineup).filter((x): x is number => x !== null);
  const cvs: number[] = [];
  for (const s of d.extras.seasons)
    for (const rows of Object.values(s.lineups ?? {})) {
      const xs = rows.map(([, act]) => act).filter((x) => x > 0);
      if (xs.length >= 5) {
        const m = mean(xs);
        const sd = Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
        if (m > 0) cvs.push(sd / m);
      }
    }
  return {
    line: champs.length ? Math.min(...champs.map((c) => c.scoring)) : null,
    lineupLine: known.length ? Math.min(...known) : null,
    champs,
    cv: cvs.length ? Math.min(0.3, Math.max(0.05, median(cvs))) : 0.12 };
}

/** Seed order of a standard bracket of `size` (a power of two): 1 v size, then the halves folded in. */
export function bracketOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

/** Seeded random numbers (mulberry32) and a normal draw. */
function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => {
    const u = Math.max(1e-12, next());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
  return { next, normal };
}

export type ForecastRow = {
  id: string;
  /** Projected weekly score (league points), as an index of the league (100 = average), and its parts. */
  proj: number;
  index: number;
  lineup: number;
  scoring: number | null;
  form: number | null;
  /** Projected index clears the title line (null when there's no line yet). */
  clears: boolean | null;
  wins: number;
  losses: number;
  /** Chance of each finish, 0..1. */
  playoffs: number;
  bye: number;
  title: number;
  record: string;
  tier: "Title favorite" | "Contender" | "Dark horse" | "Playoff team" | "Long shot";
};

export type ForecastInput = {
  table: Standing[];
  /** Best healthy lineup value now, per manager (Front Office). */
  lineup: Map<string, number>;
  /** Remaining regular-season games: [week, a, b] by manager id. */
  schedule: [number, string, string][];
  regWeeks: number;
  playoffTeams: number;
  median?: boolean;
  /** Average of each manager's last (up to) three exact weekly scores, when proven. */
  recent?: Map<string, number>;
  line: TitleLine;
  runs?: number;
};

export function forecast(input: ForecastInput): { rows: ForecastRow[]; weeksLeft: number; runs: number } {
  const { table, lineup, schedule, line } = input;
  const runs = input.runs ?? RUNS;
  const ids = table.map((r) => r.manager);
  const perWeek = input.median ? 2 : 1;
  const gp = (r: Standing) => (r.w + r.l + r.t) / perWeek;
  const ppw = new Map(table.map((r) => [r.manager, gp(r) ? r.pf / gp(r) : 0]));
  const played = ids.filter((m) => ppw.get(m)! > 0);
  const L = played.length ? mean(played.map((m) => ppw.get(m)!)) : mean(ids.map((m) => lineup.get(m) ?? 0));
  const lAvg = mean(ids.map((m) => lineup.get(m) ?? 0));
  const recentVals = [...(input.recent?.values() ?? [])];
  const recentAvg = recentVals.length === ids.length ? mean(recentVals) : 0;

  const base = table.map((r) => {
    const games = gp(r);
    const lin = lAvg ? (100 * (lineup.get(r.manager) ?? 0)) / lAvg : 100;
    const sco = games && L ? (100 * ppw.get(r.manager)!) / L : null;
    const form = recentAvg && input.recent?.has(r.manager) ? (100 * input.recent.get(r.manager)!) / recentAvg : null;
    const results = sco === null ? lin : form === null ? sco : 0.75 * sco + 0.25 * form;
    const w = games / (games + RESULTS_K);
    const proj = (L * (w * results + (1 - w) * lin)) / 100;
    return { r, lin, sco, form, proj };
  });
  const mu = new Map(base.map((b) => [b.r.manager, b.proj]));
  const sd = (m: string) => Math.max(1, mu.get(m)! * line.cv);

  const P = Math.min(input.playoffTeams, ids.length);
  const size = 1 << Math.ceil(Math.log2(Math.max(2, P)));
  const order = bracketOrder(size);
  const count = new Map(ids.map((m) => [m, { wins: 0, losses: 0, playoffs: 0, bye: 0, title: 0 }]));
  const weeks = [...new Set(schedule.map(([w]) => w))].sort((a, b) => a - b);
  const R = rng(20261120);

  for (let run = 0; run < runs; run++) {
    const W = new Map(table.map((r) => [r.manager, r.w + r.t / 2]));
    const Lo = new Map(table.map((r) => [r.manager, r.l + r.t / 2]));
    const PF = new Map(table.map((r) => [r.manager, r.pf]));
    for (const wk of weeks) {
      const score = new Map(ids.map((m) => [m, mu.get(m)! + sd(m) * R.normal()]));
      for (const [w, a, b] of schedule) {
        if (w !== wk || !score.has(a) || !score.has(b)) continue;
        const [x, y] = [score.get(a)!, score.get(b)!];
        W.set(a, W.get(a)! + (x > y ? 1 : 0));
        W.set(b, W.get(b)! + (y > x ? 1 : 0));
        Lo.set(a, Lo.get(a)! + (x > y ? 0 : 1));
        Lo.set(b, Lo.get(b)! + (y > x ? 0 : 1));
      }
      if (input.median) {
        const med = median([...score.values()]);
        for (const m of ids) (score.get(m)! > med ? W : Lo).set(m, (score.get(m)! > med ? W : Lo).get(m)! + 1);
      }
      for (const m of ids) PF.set(m, PF.get(m)! + score.get(m)!);
    }
    for (const m of ids) {
      count.get(m)!.wins += W.get(m)!;
      count.get(m)!.losses += Lo.get(m)!;
    }
    // Seeds: record, then points for.
    const seeds = [...ids].sort((a, b) => W.get(b)! - W.get(a)! || PF.get(b)! - PF.get(a)!).slice(0, P);
    seeds.forEach((m) => count.get(m)!.playoffs++);
    let alive: (string | null)[] = order.map((s) => (s <= P ? seeds[s - 1] : null));
    // A team facing an empty slot in the first round has a bye.
    for (let i = 0; i < alive.length; i += 2) if (alive[i] && !alive[i + 1]) count.get(alive[i]!)!.bye++;
    while (alive.length > 1) {
      const next: (string | null)[] = [];
      for (let i = 0; i < alive.length; i += 2) {
        const [a, b] = [alive[i], alive[i + 1]];
        if (!a || !b) next.push(a ?? b);
        else next.push(mu.get(a)! + sd(a) * R.normal() >= mu.get(b)! + sd(b) * R.normal() ? a : b);
      }
      alive = next;
    }
    if (alive[0]) count.get(alive[0])!.title++;
  }

  const rows: ForecastRow[] = base.map((b) => {
    const c = count.get(b.r.manager)!;
    const title = c.title / runs;
    const playoffs = c.playoffs / runs;
    const wins = c.wins / runs;
    const losses = c.losses / runs;
    return {
      id: b.r.manager,
      proj: b.proj,
      index: L ? (100 * b.proj) / L : 100,
      lineup: b.lin,
      scoring: b.sco,
      form: b.form,
      clears: line.line === null || !L ? null : (100 * b.proj) / L >= line.line,
      wins,
      losses,
      playoffs,
      bye: c.bye / runs,
      title,
      record: `${Math.round(wins)}–${Math.round(losses)}`,
      tier: title >= 0.25 ? "Title favorite" : title >= 0.1 ? "Contender" : title >= 0.04 ? "Dark horse" : playoffs >= 0.5 ? "Playoff team" : "Long shot",
    };
  });
  rows.sort((a, b) => b.title - a.title || b.playoffs - a.playoffs || b.proj - a.proj);
  return { rows, weeksLeft: weeks.length, runs };
}
