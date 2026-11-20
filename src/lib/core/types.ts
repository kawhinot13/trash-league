/**
 * Shapes of a league's dataset: the Trash site's league.json + extras.json, which the Rafterlore
 * importer also produces for any Sleeper league. Pure types: importing this pulls in no data.
 */
export type Standing = {
  manager: string;
  team: string;
  w: number;
  l: number;
  t: number;
  pf: number;
  seed: number;
  streak?: string;
  move?: number;
  /** Week-by-week results, oldest first ("WWLW"), from Sleeper's official record. */
  results?: string;
};
export type Pick = { no: number; pid: string; player: string; by: string };
export type TradeSide = { pid: string | null; name: string };
export type Trade = {
  season: string;
  week: number;
  sides: Record<string, TradeSide[]>;
};
export type Season = {
  code: string;
  years: string;
  name: string;
  status: string;
  leagueId: string;
  standings: Standing[];
  champion: string | null;
  runnerUp: string | null;
  bracket: { round: number; a: string; b: string; winner: string | null }[];
  draft: Pick[];
  trades: Trade[];
  /** League also plays the weekly median (records count two games a week). Unset: no. */
  median?: boolean;
  /** Regular-season weeks scheduled, and playoff spots, from the league's settings when known. */
  regWeeks?: number;
  playoffTeams?: number;
};
export type Manager = {
  id: string;
  nick: string;
  color: string;
  team: string;
  w: number;
  l: number;
  t: number;
  pf: number;
  pct: number;
  titles: string[];
  playoffs: number;
  trades: number;
  seasons: {
    code: string;
    seed: number;
    w: number;
    l: number;
    t: number;
    pf: number;
    team: string;
    finish: string;
  }[];
};

export type LeagueData = {
  seasons: Season[];
  managers: Manager[];
  h2h: Record<string, Record<string, number>>;
  totals: { seasons: number; managers: number; trades: number };
  partners?: { a: string; b: string; n: number }[];
};

/** Built by scripts/build-extras.py from Sleeper. See that file for the scoring model. */
export type RawSeason = {
  code: string;
  season: string;
  weeks: number;
  status: string;
  draft: {
    no: number;
    round: number;
    pid: string;
    by: string;
    value: number;
    gp: number;
  }[];
  rosters: Record<string, Record<string, string[]>>;
  trades: { week: number; sides: Record<string, string[]>; gain?: Record<string, [number, number] | [number, number, number]> }[];
  adds: Record<string, number>;
  /** [week, actual, optimal] */
  lineups: Record<string, [number, number, number][]>;
  /** week -> games [a, b, aPts, bPts], top starters [who, pid, pts], waiver adds [who, pid, pts that week] */
  weekly?: Record<string, { games: [string, string, number, number][]; top: [string, string, number][]; adds: [string, string, number][] }>;
  /** manager -> pid -> [weeks rostered, starts, points as a starter], playoffs included */
  guys: Record<string, Record<string, [number, number, number]>>;
  /** Every player picked up that season (adds), including ones dropped before a week's rosters were taken. */
  added?: string[];
  /** Winners-bracket playoff games: each team's actual and best lineup and its starters. */
  playoffs: { week: number; who: string; mid: number; act: number; opt: number; starters: [string, number][] }[];
};
/** pid -> [name, positions, team, has headshot, height in inches (0 if unknown), birth date YYYY-MM-DD or ""] */
export type Players = Record<string, [string, string[], string, number, number, string]>;
export type ExtrasData = {
  asOf: string;
  seasons: RawSeason[];
  players: Players;
  /** Every NBA team each player has played for in the league's seasons (from box scores; Rafterlore). */
  teamsPlayed?: Record<string, string[]>;
  /** Each player's best single start for a league team (Sleeper's starter points; Rafterlore). */
  bigNights?: Record<string, number>;
};

/** Everything the shared features need about one league. `name` is how copy refers to it ("Trash"). */
export type Dataset = {
  name: string;
  league: LeagueData;
  extras: ExtrasData;
  /** Basketball when unset (Trash). */
  sport?: "nba" | "nfl";
  /** Dumpster Dive's written calendar (day -> prompts); days already played never change. */
  diveCalendar?: Record<string, string[]>;
  /** 2: the calendar is written with the league's custom-pack names (nicknames, short league name). */
  diveNames?: number;
};
