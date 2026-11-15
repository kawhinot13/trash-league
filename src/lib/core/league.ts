import type { LeagueData } from "@/lib/core/types";

/** League-wide helpers that work for any league's data. */
export const record = (x: { w: number; l: number; t: number }) => `${x.w}–${x.l}${x.t ? `–${x.t}` : ""}`;

/** Head to head (per Sleeper weekly data): [wins, losses] of a against b. */
export const h2h = (league: LeagueData, a: string, b: string): [number, number] => [
  league.h2h[a]?.[b] ?? 0,
  league.h2h[b]?.[a] ?? 0,
];

/** The most lopsided head-to-head records, owner first. */
export const ownership = (league: LeagueData, min = 6) => {
  const out: { owner: string; owned: string; w: number; l: number }[] = [];
  for (const a of Object.keys(league.h2h))
    for (const b of Object.keys(league.h2h[a])) {
      const [w, l] = h2h(league, a, b);
      if (w + l >= min && w > l) out.push({ owner: a, owned: b, w, l });
    }
  return out.sort((x, y) => y.w - y.l - (x.w - x.l) || y.w - x.w);
};

