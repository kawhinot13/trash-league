/**
 * Exact weekly team scores from saved official season totals, and only the ones we can prove.
 *
 * A team's score for week k is its official points for after k finished weeks minus after k-1.
 * That fails when Sleeper rewrites a team's season total mid-week (it can, e.g. after a roster
 * move), so a total saved during the next week may already hold some of that week's points.
 * The check: in a head-to-head week your points for are exactly your opponent's points against.
 * A week counts only if some other team's change in points against equals yours in points for,
 * and theirs in points for equals yours in points against. Anything else is left out, never guessed.
 *
 * For each number of finished weeks the EARLIEST saved total is used (closest to the week's end,
 * before the next week's roster moves).
 */
export type OfficialSnap = { key: string; weeksDone: number; pf: number; pa?: number | null; day: string };

const close = (a: number, b: number) => Math.abs(a - b) < 0.06;
const r1 = (x: number) => Math.round(x * 10) / 10;

/** Earliest saved totals per team for each number of finished weeks. */
export function earliestTotals(snaps: OfficialSnap[]): Map<number, Map<string, OfficialSnap>> {
  const by = new Map<number, Map<string, OfficialSnap>>();
  for (const s of snaps) {
    const m = by.get(s.weeksDone) ?? by.set(s.weeksDone, new Map()).get(s.weeksDone)!;
    const had = m.get(s.key);
    if (!had || s.day < had.day) m.set(s.key, s);
  }
  return by;
}

/** Verified weekly scores: week (as finished-week count k) -> team key -> points. */
export function verifiedWeeks(snaps: OfficialSnap[]): Map<number, Map<string, number>> {
  const by = earliestTotals(snaps);
  const out = new Map<number, Map<string, number>>();
  for (const [k, now] of by) {
    if (k < 1) continue;
    const before = k === 1 ? null : by.get(k - 1);
    if (k > 1 && !before) continue;
    const d: { key: string; pf: number; pa: number }[] = [];
    for (const [key, s] of now) {
      const b = before ? before.get(key) : { pf: 0, pa: 0 };
      if (!b || s.pa == null || b.pa == null) continue;
      d.push({ key, pf: s.pf - b.pf, pa: s.pa - b.pa });
    }
    const week = new Map<string, number>();
    for (const x of d)
      if (d.some((y) => y.key !== x.key && close(x.pf, y.pa) && close(x.pa, y.pf))) week.set(x.key, r1(x.pf));
    if (week.size) out.set(k, week);
  }
  return out;
}
