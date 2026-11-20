import { lastCode, lockIn, tradeCourt } from "@/lib/core/extras";
import type { Dataset } from "@/lib/core/types";

/**
 * GM rating: one all-time grade per active manager, from five skills (every season they've played).
 *   Draft    20%  spots gained: where his picks (rounds 1–6) finished vs where he took them (finished seasons)
 *   Waivers  20%  points a season his pickups (not drafted, not traded for) scored in his starting lineup
 *   Trades   20%  trade court net: what he got out of trades minus what the other side got, a season
 *   Lineups  15%  lineup efficiency: points started vs the best he could have started (per Sleeper)
 *   Results  25%  official win rate, and rings (title 2, final 1, playoffs ½) a season
 * Each skill is scored against the league (z-score), shown 0–100 (50 = league average), and the rating is
 * the weighted blend on the same scale. Trades and lineups come from Sleeper's weekly lineups (per Sleeper).
 */
export const GM_SKILLS = ["draft", "waivers", "trades", "lineups", "results"] as const;
export type GmSkill = (typeof GM_SKILLS)[number];
export const GM_WEIGHTS: Record<GmSkill, number> = { draft: 0.2, waivers: 0.2, trades: 0.2, lineups: 0.15, results: 0.25 };

export type GmRow = {
  id: string;
  rating: number;
  grade: string;
  rank: number;
  seasons: number;
  scores: Record<GmSkill, number>;
  /** The raw number behind each skill, for the card. */
  raw: { draft: number; waivers: number; trades: number; lineups: number; win: number; rings: number; titles: number };
  best: GmSkill;
  worst: GmSkill;
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const score = (z: number) => Math.max(1, Math.min(99, Math.round(50 + 15 * z)));

export function gradeOf(r: number) {
  return r >= 80 ? "A+" : r >= 72 ? "A" : r >= 66 ? "A-" : r >= 61 ? "B+" : r >= 56 ? "B" : r >= 51 ? "B-" : r >= 46 ? "C+" : r >= 41 ? "C" : r >= 36 ? "C-" : r >= 28 ? "D" : "F";
}

export function gmRatings(d: Dataset): GmRow[] {
  const active = d.league.seasons.find((s) => s.code === lastCode(d))!.standings.map((r) => r.manager);
  const lock = new Map(lockIn(d).rows.map((r) => [r.id, r]));
  const court = new Map(tradeCourt(d).records.map((r) => [r.id, r]));

  // Draft: spots gained by picks in rounds 1–6 of finished seasons.
  const eye = new Map<string, number[]>();
  for (const s of d.extras.seasons.filter((x) => x.status === "complete")) {
    const rank = new Map([...s.draft].sort((a, b) => b.value - a.value || a.no - b.no).map((p, i) => [p.pid, i + 1]));
    for (const p of s.draft.filter((x) => x.round <= 6)) (eye.get(p.by) ?? eye.set(p.by, []).get(p.by)!).push(p.no - rank.get(p.pid)!);
  }

  // Waivers: starter points from players a manager picked up (not drafted by him, not traded to him).
  const wire = new Map<string, number>();
  for (const s of d.extras.seasons) {
    const drafted = new Set(s.draft.map((x) => `${x.by}|${x.pid}`));
    const traded = new Set(s.trades.flatMap((t) => Object.entries(t.sides).flatMap(([m, ps]) => ps.map((p) => `${m}|${p}`))));
    for (const [m, ps] of Object.entries(s.guys))
      for (const [p, [, , pts]] of Object.entries(ps)) if (!drafted.has(`${m}|${p}`) && !traded.has(`${m}|${p}`)) wire.set(m, (wire.get(m) ?? 0) + pts);
  }

  const base = active.map((id) => {
    const m = d.league.managers.find((x) => x.id === id)!;
    const n = Math.max(1, m.seasons.length);
    const finals = (m as unknown as { finals?: number }).finals ?? 0;
    const rings = (m.titles.length * 2 + finals + m.playoffs * 0.5) / n;
    return {
      m,
      n,
      v: {
        draft: mean(eye.get(id) ?? [0]),
        waivers: (wire.get(id) ?? 0) / n,
        trades: (court.get(id)?.net ?? 0) / n,
        lineups: lock.get(id)?.eff ?? 0,
        win: m.pct,
        rings,
      },
    };
  });
  const zOf = (xs: number[]) => {
    const mu = mean(xs);
    const sd = Math.sqrt(mean(xs.map((x) => (x - mu) ** 2))) || 1;
    return (x: number) => (x - mu) / sd;
  };
  const zs = {
    draft: zOf(base.map((b) => b.v.draft)),
    waivers: zOf(base.map((b) => b.v.waivers)),
    trades: zOf(base.map((b) => b.v.trades)),
    lineups: zOf(base.map((b) => b.v.lineups)),
    win: zOf(base.map((b) => b.v.win)),
    rings: zOf(base.map((b) => b.v.rings)),
  };
  const rows = base.map((b) => {
    const z: Record<GmSkill, number> = {
      draft: zs.draft(b.v.draft),
      waivers: zs.waivers(b.v.waivers),
      trades: zs.trades(b.v.trades),
      lineups: zs.lineups(b.v.lineups),
      results: (zs.win(b.v.win) + zs.rings(b.v.rings)) / 2,
    };
    const total = GM_SKILLS.reduce((t, k) => t + GM_WEIGHTS[k] * z[k], 0);
    const scores = Object.fromEntries(GM_SKILLS.map((k) => [k, score(z[k])])) as Record<GmSkill, number>;
    const sorted = [...GM_SKILLS].sort((a, c) => z[c] - z[a]);
    const rating = score(total / 0.55); // the blend of five skills spreads less than one; stretch it back
    return {
      id: b.m.id,
      rating,
      grade: gradeOf(rating),
      rank: 0,
      seasons: b.m.seasons.length,
      scores,
      raw: { draft: b.v.draft, waivers: b.v.waivers, trades: b.v.trades, lineups: b.v.lineups, win: b.v.win, rings: b.v.rings, titles: b.m.titles.length },
      best: sorted[0],
      worst: sorted[sorted.length - 1],
      total,
    };
  });
  rows.sort((a, b) => b.total - a.total);
  return rows.map(({ total: _t, ...r }, i) => (void _t, { ...r, rank: i + 1 }));
}
