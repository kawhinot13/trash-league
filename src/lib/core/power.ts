import { profile } from "@/lib/fo-analysis";
import type { FrontOffice } from "@/lib/core/front-office";
import type { Standing } from "@/lib/core/types";

/**
 * Power rankings for the current season. One score per team, 0–100:
 *   record 30%  (official win rate)
 *   scoring 25% (official points for, per week played)
 *   roster 30%  (best possible starting nine, from the Front Office player values)
 *   form 15%    (last finished week's score vs the league average)
 *   momentum    (the last three results, last week counting most: 3, 2, 1). With exact scores the split is
 *               record 25, scoring 25, roster 30, form 10, momentum 10; without them form sits out and it's
 *               record 30, scoring 25, roster 30, momentum 15, so recent play always counts.
 * Movement compares with the same formula one week earlier (record and points without the
 * latest week). Blurbs are written from whichever signals stand out for that team.
 */
export type PowerRow = {
  id: string;
  nick: string;
  team: string;
  rank: number;
  move: number;
  score: number;
  tier: string;
  record: string;
  ppw: number;
  roster: number;
  last: number | null;
  eff: number | null;
  parts: { record: number; scoring: number; roster: number; form: number; momentum: number };
  blurb: string;
};

type Lines = Record<string, [number, number, number][]>;

/** Recent results, 0 (lost the last three) to 1 (won them): last week x3, the one before x2, then x1. Null before any. */
export function momentumOf(results: string | undefined): number | null {
  const last = (results ?? "").slice(-3).split("").reverse();
  if (!last.length) return null;
  const w = [3, 2, 1];
  let num = 0;
  let den = 0;
  last.forEach((c, i) => {
    num += w[i] * (c === "W" ? 1 : c === "T" ? 0.5 : 0);
    den += w[i];
  });
  return num / den;
}

/** Scale a set of values to 0..1 (min..max). */
const scale = (xs: number[]) => {
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  return (x: number) => (hi > lo ? (x - lo) / (hi - lo) : 0.5);
};

/** Inputs: the live table, front-office rosters, this season's [week, actual, best] lineups per
 * manager, official weekly scores (from snapshots) and display names. */
export function powerRankings(input: {
  table: Standing[];
  week: number | null;
  fo: FrontOffice | null;
  lines: Lines;
  officialWeek: (week: number) => Map<string, number> | null;
  nick: (id: string) => string;
}): { week: number | null; rows: PowerRow[]; weights: Record<keyof PowerRow["parts"], number> } | null {
  const { table, week, fo, lines, officialWeek, nick } = input;
  if (!table.length) return null;
  // Exact last-week scores only (official points-for snapshots); Sleeper's weekly matchup
  // scores are unreliable for this league, so without snapshots "form" sits out.
  const done = Math.max(0, ...table.map((r) => r.w + r.l + r.t));
  const lastExact = officialWeek(done);
  const prevExact = officialWeek(done - 1);
  const W = lastExact
    ? { record: 0.25, scoring: 0.25, roster: 0.3, form: 0.1, momentum: 0.1 }
    : { record: 0.3, scoring: 0.25, roster: 0.3, form: 0, momentum: 0.15 };

  const base = table.map((r) => {
    const gp = r.w + r.l + r.t;
    const hist = lines[r.manager] ?? [];
    const lastRow = hist.length ? hist[hist.length - 1] : null;
    const eff = hist.length ? hist.reduce((a, x) => a + x[1], 0) / hist.reduce((a, x) => a + x[2], 0) : null;
    const team = fo?.teams.find((t) => t.id === r.manager);
    const prof = team && fo ? profile(team, fo.players, fo.slots) : null;
    const mvp = team && fo ? [...team.players].map((id) => fo.players[id]).filter(Boolean).sort((a, b) => b.value - a.value)[0] : null;
    // one week earlier: drop the latest result and that week's points
    const lastPts = lastRow?.[1] ?? 0;
    const prevW = r.w - (r.streak?.endsWith("W") ? 1 : 0);
    const prevGp = Math.max(0, gp - (lastRow ? 1 : 0));
    return {
      r,
      gp,
      winPct: gp ? (r.w + r.t / 2) / gp : 0,
      ppw: gp ? r.pf / gp : 0,
      roster: prof?.lineup.total ?? 0,
      last: lastExact?.get(r.manager) ?? null,
      eff,
      mvp,
      prevWinPct: prevGp ? (prevW + r.t / 2) / prevGp : 0,
      prevPpw: prevGp ? (r.pf - (lastExact?.get(r.manager) ?? lastPts)) / prevGp : 0,
      prevLast: prevExact?.get(r.manager) ?? null,
      mom: momentumOf(r.results),
      prevMom: momentumOf(r.results?.slice(0, -1)),
    };
  });

  const scoreAll = (pick: (b: (typeof base)[number]) => [number, number, number, number | null, number | null]) => {
    const vals = base.map(pick);
    const lastVals = vals.map((v) => v[3]).filter((x): x is number => x !== null);
    const avgLast = lastVals.length ? lastVals.reduce((a, x) => a + x, 0) / lastVals.length : 0;
    const [sw, sp, sr] = [scale(vals.map((v) => v[0])), scale(vals.map((v) => v[1])), scale(vals.map((v) => v[2]))];
    const sf = scale(vals.map((v) => (v[3] ?? avgLast) - avgLast));
    const moms = vals.map((v) => v[4]).filter((x): x is number => x !== null);
    const avgMom = moms.length ? moms.reduce((a, x) => a + x, 0) / moms.length : 0.5;
    const sm = scale(vals.map((v) => v[4] ?? avgMom));
    return vals.map((v) => {
      const parts = { record: sw(v[0]), scoring: sp(v[1]), roster: sr(v[2]), form: sf((v[3] ?? avgLast) - avgLast), momentum: sm(v[4] ?? avgMom) };
      return {
        parts,
        score: 100 * (W.record * parts.record + W.scoring * parts.scoring + W.roster * parts.roster + W.form * parts.form + W.momentum * parts.momentum),
      };
    });
  };
  const now = scoreAll((b) => [b.winPct, b.ppw, b.roster, b.last, b.mom]);
  const before = scoreAll((b) => [b.prevWinPct, b.prevPpw, b.roster, b.prevLast, b.prevMom]);
  const rankOf = (xs: { score: number }[]) => {
    const order = xs.map((x, i) => [x.score, i] as const).sort((a, b) => b[0] - a[0]);
    const r = new Map<number, number>();
    order.forEach(([, i], k) => r.set(i, k + 1));
    return r;
  };
  const nowRank = rankOf(now);
  const prevRank = rankOf(before);
  const rankBy = (f: (b: (typeof base)[number]) => number) => {
    const order = base.map((b, i) => [f(b), i] as const).sort((a, b) => b[0] - a[0]);
    const r = new Map<number, number>();
    order.forEach(([, i], k) => r.set(i, k + 1));
    return r;
  };
  const recR = rankBy((b) => b.winPct);
  const rosR = rankBy((b) => b.roster);
  const ppwR = rankBy((b) => b.ppw);
  const n = base.length;

  const rows: PowerRow[] = base.map((b, i) => {
    const rank = nowRank.get(i)!;
    const notes: string[] = [];
    const streak = b.r.streak ?? "";
    const sN = parseInt(streak) || 0;
    if (rosR.get(i)! <= 3 && recR.get(i)! > n / 2) notes.push(`A top-three roster stuck at ${b.r.w}–${b.r.l}. The wins are coming.`);
    else if (recR.get(i)! <= 3 && rosR.get(i)! > n / 2) notes.push(`Winning with a roster that ranks #${rosR.get(i)} on paper. Regression is circling.`);
    if (ppwR.get(i) === 1) notes.push("The highest-scoring team in the league.");
    if (sN >= 3 && streak.endsWith("W")) notes.push(`Won ${sN} straight.`);
    if (sN >= 3 && streak.endsWith("L")) notes.push(`Lost ${sN} straight. Someone check on them.`);
    if (b.mvp && notes.length < 2) notes.push(`${b.mvp.name} is carrying this team at ${Math.round(b.mvp.value)} a week.`);
    if (!notes.length) notes.push("Nothing loud yet. Middle of the pack, waiting for a move.");
    const score = Math.round(now[i].score);
    return {
      id: b.r.manager,
      nick: nick(b.r.manager),
      team: b.r.team,
      rank,
      move: (prevRank.get(i) ?? rank) - rank,
      score,
      tier: rank <= 3 ? "Contender" : rank <= 6 ? "In the hunt" : rank <= 9 ? "Fringe" : "Lottery",
      record: `${b.r.w}–${b.r.l}${b.r.t ? `–${b.r.t}` : ""}`,
      ppw: Math.round(b.ppw),
      roster: Math.round(b.roster),
      last: b.last === null ? null : Math.round(b.last),
      eff: b.eff,
      parts: now[i].parts,
      blurb: notes.slice(0, 2).join(" "),
    };
  });
  rows.sort((a, b) => a.rank - b.rank);
  return { week, rows, weights: W };
}
