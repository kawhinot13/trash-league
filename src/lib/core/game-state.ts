/**
 * A finished daily game's saved progress, stored with the score so the player's other devices open on
 * the same result: { "dive3:2026-11-17": {...} }. Only these storage names are accepted, and it stays small.
 */
export const STATE_NAME = /^(dive3|trashle|trashle-hints|lineup|grid):\d{4}-\d{2}-\d{2}$/;

export function cleanState(x: unknown): Record<string, unknown> | null {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  const entries = Object.entries(x as Record<string, unknown>).filter(([k]) => STATE_NAME.test(k));
  if (!entries.length || entries.length > 4) return null;
  const out = Object.fromEntries(entries);
  return JSON.stringify(out).length <= 16_000 ? out : null;
}

/**
 * How far along a saved game is, for syncing between devices (the further one wins, so a fresh device
 * never wipes progress). Dive: answers given; Starting Nine: guesses used; Rosterdle and The Lineup:
 * guesses (or hints) made. A finished game counts one extra.
 */
export function progressOf(name: string, v: unknown): number {
  if (v == null) return -1;
  const kind = name.split(":")[0];
  if (Array.isArray(v)) return v.length;
  const o = v as { picks?: unknown[]; left?: number; done?: boolean };
  if (kind === "dive3") return (o.picks?.length ?? 0) + (o.done ? 1 : 0);
  if (kind === "grid") return 9 - (o.left ?? 9) + (o.done ? 1 : 0);
  return JSON.stringify(v).length;
}
