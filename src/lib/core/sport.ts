/**
 * The sports Rafterlore supports, and what differs between them. Sleeper uses the same API for
 * both; basketball is the default everywhere (the Trash site is basketball).
 */
export type Sport = "nba" | "nfl";

export const SPORTS: Sport[] = ["nba", "nfl"];

export const isSport = (s: unknown): s is Sport => s === "nba" || s === "nfl";

/** A league's sport from Sleeper's `sport` field (missing on old leagues: basketball). */
export const sportOf = (l: { sport?: string | null } | null | undefined): Sport => (l?.sport === "nfl" ? "nfl" : "nba");

export const SPORT = {
  nba: { word: "basketball", label: "NBA", short: "hoops" },
  nfl: { word: "football", label: "NFL", short: "football" },
} as const satisfies Record<Sport, { word: string; label: string; short: string }>;

/**
 * Season label from Sleeper's season year. Basketball seasons span two calendar years (Sleeper's
 * "2025" is 2025–26); football seasons are one (2025).
 */
export const seasonLabel = (season: string, sport: Sport = "nba") => {
  if (sport === "nfl") return season;
  const y = Number(season);
  return Number.isFinite(y) ? `${y}–${String((y + 1) % 100).padStart(2, "0")}` : season;
};
