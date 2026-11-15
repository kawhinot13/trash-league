/** Input checks for everything that comes from a URL or a form. */

/** Sleeper league and user ids are long numbers (18–19 digits today). */
export const isSleeperId = (s: unknown): s is string => typeof s === "string" && /^\d{10,25}$/.test(s);

/** Sleeper usernames: letters, digits and underscores (a few older ones have dots or dashes). */
export function cleanUsername(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const v = s.trim();
  return /^[A-Za-z0-9_.-]{2,32}$/.test(v) ? v : null;
}

/** A pasted league link or id -> the id. */
export function leagueIdFrom(s: string): string | null {
  const m = s.match(/(?:^|\/)(\d{10,25})(?:$|[/?#])/) ?? s.trim().match(/^(\d{10,25})$/);
  return m ? m[1] : null;
}
