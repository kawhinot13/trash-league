/**
 * Where live league data comes from: one league on Sleeper, a way to fetch from Sleeper's API, and
 * how managers are named (Trash uses display names; Rafterlore uses Sleeper user ids).
 * Each site builds its own source; the shared live features only use this.
 */
export type SleeperUserLike = { user_id: string; display_name: string };
export type LiveSource = {
  /** The current season's league id. */
  leagueId: string;
  /** GET a Sleeper API path (e.g. "/v1/state/nba"), parsed JSON; throws on failure. */
  get: <T>(path: string) => Promise<T>;
  /** A manager's id in this site's data. */
  idOf: (u: SleeperUserLike) => string;
};
