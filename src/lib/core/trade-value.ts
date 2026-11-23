/**
 * Trade value over replacement (owner's call 2026-11-23): a traded player only earns what he scores above a
 * waiver-level player, the kind any team can pick up for free. Two depth pieces near that line add little; a
 * star adds a lot. Pure math, shared by the grader (app/analysis.ts) and tests.
 */

/** Weeks of games after a trade (in a season still being played) before it gets a verdict. */
export const EARLY_WEEKS = 3;

/**
 * Replacement level (the waiver line): the average lock-in of the best player nobody would keep, i.e. the
 * Nth best player where N = every roster spot in the league (teams x roster size). Everyone below him is the
 * kind of player any team can pick up for free. (Not the last starter: in lock-in leagues regular starters'
 * averages bunch together, so that line would call real starters worthless.)
 * `players`: each player's average lock-in that season and how many lock-ins it's from. Only players with
 * 2+ lock-ins rank (one lucky week shouldn't set the line). Early in a season too few players qualify to
 * reach N: then last season's line (`prior`) is used, else the lowest qualifying average.
 */
export function replacementLevel(players: { avg: number; n: number }[], spots: number, prior?: number): number {
  const pool = players
    .filter((p) => p.n >= 2)
    .map((p) => p.avg)
    .sort((a, b) => b - a);
  if (pool.length < spots && prior !== undefined) return prior;
  if (!pool.length || spots < 1) return prior ?? 0;
  return Math.round(pool[Math.min(spots, pool.length) - 1] * 10) / 10;
}

/** One week of a player on your roster: what he scores above replacement (never below zero: you'd bench or drop him). */
export const weekValue = (avg: number, repl: number) => Math.max(0, avg - repl);

/**
 * "Even" on this scale: within 1.5 weeks of an average starter's edge over replacement. `starters`: the
 * average lock-in of every lineup spot filled that season (one entry per spot-week is fine).
 */
export function evenMargin(starterAvg: number, repl: number): number {
  return Math.max(5, Math.round(1.5 * Math.max(0, starterAvg - repl)));
}
