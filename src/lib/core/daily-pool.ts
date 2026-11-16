import pool from "@/data/daily-pool.json";
import type { Players } from "@/lib/core/types";

/**
 * One shared player list per sport (src/data/daily-pool.json, append-only), so Rosterdle/Trashle and
 * The Lineup give every league of a sport the same player on the same day. Each league still gets its
 * own history clues for him (weeks on its rosters, top owner...), which may be "never".
 */
type Entry = [pid: string, name: string, pos: string[], team: string, height: number, birth: string];
const POOL = pool as unknown as Record<"nba" | "nfl", Entry[]> & { lineup: Record<"nba" | "nfl", string[]> };

/** First day of the shared schedule. Earlier days keep each league's own pick. */
export const SHARED_FROM = "2026-11-16";

export const poolFor = (sport: "nba" | "nfl" | undefined) => POOL[sport === "nfl" ? "nfl" : "nba"];
/** The Lineup's own order of the same players, so it never echoes Rosterdle's pick. */
export const lineupOrder = (sport: "nba" | "nfl" | undefined) => POOL.lineup[sport === "nfl" ? "nfl" : "nba"];

/** Days since the shared schedule started (null before it). */
export const sharedDay = (day: string) => {
  const n = Math.round((Date.parse(day) - Date.parse(SHARED_FROM)) / 86_400_000);
  return n >= 0 ? n : null;
};

/** The league's player map plus the pool's players (no local photo for ones it didn't know). */
export function withPool(players: Players, sport: "nba" | "nfl" | undefined): Players {
  const out: Players = { ...players };
  for (const [pid, name, pos, team, height, birth] of poolFor(sport)) {
    const p = out[pid];
    // Unknown here: add him. Known: fill in anything the league's data is missing (height, birthday,
    // team), so he's always a valid suspect on the day he's the answer.
    out[pid] = p ? [p[0], p[1].length ? p[1] : pos, p[2] || team, p[3], p[4] || height, p[5] || birth] : [name, pos, team, 0, height, birth];
  }
  return out;
}
