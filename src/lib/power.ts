import data from "@/data/extras.json";
import { profile } from "@/lib/fo-analysis";
import { frontOffice } from "@/lib/front-office";
import { league, liveStandings } from "@/lib/league";
import { officialWeek } from "@/lib/recap-live";

/**
 * Season 4 power rankings. One score per team, 0–100:
 *   record 30%  (official win rate)
 *   scoring 25% (official points for, per week played)
 *   roster 30%  (best possible starting nine, from the Front Office player values)
 *   form 15%    (last finished week's score vs the league average)
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
  parts: { record: number; scoring: number; roster: number; form: number };
  blurb: string;
};

type Lines = Record<string, [number, number, number][]>;
const s4lines = (): Lines =>
  (data as unknown as { seasons: { code: string; lineups: Lines }[] }).seasons.find((s) => s.code === "s4")?.lineups ?? {};

/** Scale a set of values to 0..1 (min..max). */
const scale = (xs: number[]) => {
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  return (x: number) => (hi > lo ? (x - lo) / (hi - lo) : 0.5);
};

export async function powerRankings(): Promise<{ week: number | null; rows: PowerRow[]; weights: Record<keyof PowerRow["parts"], number> } | null> {
  const [{ rows: table, week }, fo] = await Promise.all([liveStandings(), frontOffice()]);
  if (!table.length) return null;
  const lines = s4lines();
  // Exact last-week scores only (official points-for snapshots); Sleeper's weekly matchup
  // scores are unreliable for this league, so without snapshots "form" sits out.
  const done = Math.max(0, ...table.map((r) => r.w + r.l + r.t));
  const lastExact = officialWeek(done);
  const prevExact = officialWeek(done - 1);
  const W = lastExact ? { record: 0.3, scoring: 0.25, roster: 0.3, form: 0.15 } : { record: 0.35, scoring: 0.3, roster: 0.35, form: 0 };
  const nick = (id: string) => league.managers.find((m) => m.id === id)?.nick ?? id;

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
    };
  });

  const scoreAll = (pick: (b: (typeof base)[number]) => [number, number, number, number | null]) => {
    const vals = base.map(pick);
    const lastVals = vals.map((v) => v[3]).filter((x): x is number => x !== null);
    const avgLast = lastVals.length ? lastVals.reduce((a, x) => a + x, 0) / lastVals.length : 0;
    const [sw, sp, sr] = [scale(vals.map((v) => v[0])), scale(vals.map((v) => v[1])), scale(vals.map((v) => v[2]))];
    const sf = scale(vals.map((v) => (v[3] ?? avgLast) - avgLast));
    return vals.map((v) => {
      const parts = { record: sw(v[0]), scoring: sp(v[1]), roster: sr(v[2]), form: sf((v[3] ?? avgLast) - avgLast) };
      return { parts, score: 100 * (W.record * parts.record + W.scoring * parts.scoring + W.roster * parts.roster + W.form * parts.form) };
    });
  };
  const now = scoreAll((b) => [b.winPct, b.ppw, b.roster, b.last]);
  const before = scoreAll((b) => [b.prevWinPct, b.prevPpw, b.roster, b.prevLast]);
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
