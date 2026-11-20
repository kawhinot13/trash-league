/**
 * Boom index: in a league where each lineup slot keeps one game a week, a player's ceiling matters more
 * than his average, so this measures how often he has a big game. The big-game line is league-relative:
 * the 90th percentile of every game rostered players have played this season (BOOM_PCT), so it fits any
 * scoring. Boom rate = share of his games at or over it; ceiling = average of his best quarter of games.
 */
export const BOOM_PCT = 0.9;
/** Games before a boom rate means much. */
export const BOOM_MIN_GAMES = 5;

export function boomLine(games: number[]): number {
  if (!games.length) return 0;
  const s = [...games].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(BOOM_PCT * s.length))];
}

export function boomOf(games: number[], line: number): { rate: number; ceil: number } {
  if (!games.length) return { rate: 0, ceil: 0 };
  const top = [...games].sort((a, b) => b - a).slice(0, Math.max(1, Math.ceil(games.length / 4)));
  return { rate: games.filter((g) => g >= line).length / games.length, ceil: top.reduce((a, b) => a + b, 0) / top.length };
}
