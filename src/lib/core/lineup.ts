import type { Dataset } from "@/lib/core/types";
import { lineupOrder, poolFor, withPool } from "@/lib/core/daily-pool";

/**
 * The Lineup: identify today's mystery player. Every guess is compared on a mix of NBA bio
 * and Trash history, so knowing the league matters as much as knowing basketball.
 */
export type Suspect = {
  pid: string;
  name: string;
  team: string;
  conf: "East" | "West" | "AFC" | "NFC" | "";
  pos: string[];
  height: number;
  /** Total weeks on any Trash roster. */
  weeks: number;
  /** Manager who rostered him the longest. */
  owner: string;
  /** Every manager who ever rostered him. */
  owners: string[];
  /** First season he was on one of the league's rosters (1 = first season; 0 = never). */
  first: number;
  /** Age in years as of the last data build (0 if unknown). */
  age: number;
};

export const EAST = new Set(["ATL", "BOS", "BKN", "CHA", "CHI", "CLE", "DET", "IND", "MIA", "MIL", "NYK", "ORL", "PHI", "TOR", "WAS"]);
/** NBA and NFL divisions by team abbreviation (Sleeper's), for "Plays in the Southwest Division" tips. */
const NBA_DIVISIONS: Record<string, string[]> = {
  Atlantic: ["BOS", "BKN", "NYK", "PHI", "TOR"],
  Central: ["CHI", "CLE", "DET", "IND", "MIL"],
  Southeast: ["ATL", "CHA", "MIA", "ORL", "WAS"],
  Northwest: ["DEN", "MIN", "OKC", "POR", "UTA"],
  Pacific: ["GSW", "LAC", "LAL", "PHX", "SAC"],
  Southwest: ["DAL", "HOU", "MEM", "NOP", "SAS"],
};
const NFL_DIVISIONS: Record<string, string[]> = {
  "AFC East": ["BUF", "MIA", "NE", "NYJ"],
  "AFC North": ["BAL", "CIN", "CLE", "PIT"],
  "AFC South": ["HOU", "IND", "JAX", "TEN"],
  "AFC West": ["DEN", "KC", "LV", "LAC"],
  "NFC East": ["DAL", "NYG", "PHI", "WAS"],
  "NFC North": ["CHI", "DET", "GB", "MIN"],
  "NFC South": ["ATL", "CAR", "NO", "TB"],
  "NFC West": ["ARI", "LAR", "LA", "SF", "SEA"],
};
/** "the Southwest Division" (NBA) / "the AFC East" (NFL), or null for no or an unknown team. */
export function divisionOf(team: string, sport: "nba" | "nfl" = "nba"): string | null {
  const table = sport === "nfl" ? NFL_DIVISIONS : NBA_DIVISIONS;
  const d = Object.entries(table).find(([, ts]) => ts.includes(team))?.[0];
  return d ? (sport === "nfl" ? `the ${d}` : `the ${d} Division`) : null;
}

export const AFC = new Set(["BAL", "BUF", "CIN", "CLE", "DEN", "HOU", "IND", "JAX", "KC", "LV", "LAC", "MIA", "NE", "NYJ", "PIT", "TEN"]);
export function lineup(d: Dataset): { suspects: Suspect[]; answers: string[]; nicks: Record<string, string>; shared: string[] } {
  const raw = d.extras;
  const players = withPool(d.extras.players, d.sport);
  const asOf = d.extras.asOf;
  const league = d.league;
  const by = new Map<string, Map<string, number>>();
  const first = new Map<string, number>();
  raw.seasons.forEach((s, si) => {
    for (const [m, ps] of Object.entries(s.guys))
      for (const [pid, [w]] of Object.entries(ps)) {
        if (!w) continue;
        const b = by.get(pid) ?? new Map<string, number>();
        b.set(m, (b.get(m) ?? 0) + w);
        by.set(pid, b);
        if (!first.has(pid) || first.get(pid)! > si + 1) first.set(pid, si + 1);
      }
  });
  const suspects: Suspect[] = [];
  const inPool = new Set(poolFor(d.sport).map((e) => e[0]));
  for (const [pid, p] of Object.entries(players)) {
    const b = by.get(pid) ?? (inPool.has(pid) ? new Map<string, number>() : undefined);
    if (!b || !p[4]) continue;
    const owners = [...b.entries()].sort((x, y) => y[1] - x[1]);
    suspects.push({
      pid,
      name: p[0],
      team: p[2] || "FA",
      conf: !p[2] ? "" : d.sport === "nfl" ? (AFC.has(p[2]) ? "AFC" : "NFC") : EAST.has(p[2]) ? "East" : "West",
      pos: p[1],
      height: p[4],
      weeks: owners.reduce((t, [, w]) => t + w, 0),
      owner: owners[0]?.[0] ?? "",
      owners: owners.map(([m]) => m),
      first: first.get(pid) ?? (owners.length ? 1 : 0),
      // Age as of the data build, so prerendering stays deterministic.
      age: p[5] ? Math.floor((Date.parse(asOf) - Date.parse(p[5])) / (365.25 * 86400000)) : 0,
    });
  }
  suspects.sort((a, b) => a.name.localeCompare(b.name));
  // Suspects are players the league really knows: 35+ weeks on Trash rosters, with a photo.
  const answers = suspects.filter((s) => s.weeks >= 35 && players[s.pid][3] && s.age).map((s) => s.pid);
  const nicks = Object.fromEntries(league.managers.map((m) => [m.id, m.nick]));
  // The shared daily list: the sport's pool in its fixed order (same for every league).
  const shared = lineupOrder(d.sport);
  return { suspects, answers, nicks, shared };
}
