import "server-only";

/**
 * Yahoo Fantasy Sports API v2 (official): https://fantasysports.yahooapis.com/fantasy/v2/... with
 * ?format=json and the member's own OAuth token. Its JSON is awkward: lists come as objects keyed
 * "0", "1", ... plus "count", and one record is often split across an array of small objects.
 * `list` and `merge` turn those into plain arrays and objects.
 */
const BASE = "https://fantasysports.yahooapis.com/fantasy/v2";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Y = any;

/** Yahoo's numbered-object lists ({"0": ..., "1": ..., "count": n}) as an array. */
export function list(o: Y): Y[] {
  if (Array.isArray(o)) return o;
  if (!o || typeof o !== "object") return [];
  return Object.keys(o)
    .filter((k) => /^\d+$/.test(k))
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => o[k]);
}

/** One record from Yahoo's split form: [[{a}, {b}, []], {c}] -> {a, b, c}. */
export function merge(x: Y): Record<string, Y> {
  if (Array.isArray(x)) return x.reduce((acc: Record<string, Y>, el: Y) => Object.assign(acc, merge(el)), {});
  if (x && typeof x === "object") return x;
  return {};
}

/** Plain list of records: list(o).map((e) => merge(e[key])). */
export const records = (o: Y, key: string) => list(o).map((e) => merge(e?.[key]));

/** At most `n` requests in flight per process, and a short backoff on rate limiting. */
let inFlight = 0;
const queue: (() => void)[] = [];
async function slot<T>(f: () => Promise<T>, n = 4): Promise<T> {
  if (inFlight >= n) await new Promise<void>((r) => queue.push(r));
  inFlight++;
  try {
    return await f();
  } finally {
    inFlight--;
    queue.shift()?.();
  }
}

export class YahooError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** GET a Yahoo resource as JSON (`fantasy_content`). Throws YahooError on failure. */
export async function yget(token: string, path: string): Promise<Y> {
  const url = `${BASE}/${path}${path.includes("?") ? "&" : "?"}format=json`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await slot(() => fetch(url, { headers: { authorization: `Bearer ${token}`, accept: "application/json" }, cache: "no-store" }));
    if (r.status === 429 || r.status === 999 || r.status >= 500) {
      await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
      continue;
    }
    if (!r.ok) throw new YahooError(r.status, `yahoo ${r.status}`);
    const j = (await r.json()) as { fantasy_content?: Y };
    return j.fantasy_content ?? {};
  }
  throw new YahooError(429, "yahoo busy");
}

/** The signed-in Yahoo user's guid (when the token response didn't include it). */
export async function yahooGuid(token: string): Promise<string | null> {
  const c = await yget(token, "users;use_login=1");
  const u = merge(list(c.users)[0]?.user);
  return u.guid ?? null;
}

export type YLeague = { key: string; name: string; season: string; teams: number; scoring: string; finished: boolean; renew: string | null; renewed: boolean };

const leagueMeta = (l: Record<string, Y>): YLeague => ({
  key: String(l.league_key),
  name: String(l.name ?? "Yahoo league"),
  season: String(l.season ?? ""),
  teams: Number(l.num_teams ?? 0),
  scoring: String(l.scoring_type ?? ""),
  finished: String(l.is_finished ?? "0") === "1",
  // "renew" is the previous season as "<game_key>_<league_id>".
  renew: l.renew ? String(l.renew).replace("_", ".l.") : null,
  // Set when the league carried on into a later season (so this isn't its newest).
  renewed: !!l.renewed,
});

/** A Yahoo league key: "<game_key>.l.<league_id>". */
export const isLeagueKey = (k: unknown): k is string => typeof k === "string" && /^\d{2,4}\.l\.\d{1,10}$/.test(k);

/** Every NFL league this Yahoo user has been in, newest first. */
export async function myNflLeagues(token: string): Promise<YLeague[]> {
  const c = await yget(token, "users;use_login=1/games;game_codes=nfl/leagues");
  const user = merge(list(c.users)[0]?.user);
  const out: YLeague[] = [];
  for (const g of list(user.games)) {
    const game = merge(g?.game);
    for (const l of records(game.leagues, "league")) out.push(leagueMeta(l));
  }
  return out.sort((a, b) => Number(b.season) - Number(a.season));
}

export async function leagueSettings(token: string, key: string) {
  const c = await yget(token, `league/${key}/settings`);
  const l = merge(c.league);
  const settings = merge(list(l.settings)[0] ?? l.settings);
  const positions = list(settings.roster_positions).map((p) => merge(p?.roster_position ?? p));
  return {
    meta: leagueMeta(l),
    startWeek: Number(l.start_week ?? 1),
    endWeek: Number(l.end_week ?? 17),
    currentWeek: Number(l.current_week ?? 1),
    playoffStart: Number(settings.playoff_start_week ?? 0),
    playoffTeams: Number(settings.num_playoff_teams ?? 0),
    usesPlayoff: String(settings.uses_playoff ?? "1") === "1",
    draftDone: String(l.draft_status ?? "postdraft") === "postdraft",
    positions: positions.map((p) => ({ pos: String(p.position), count: Number(p.count ?? 1), type: String(p.position_type ?? "") })),
    gameKey: String(l.league_key).split(".")[0],
  };
}

export type YTeam = { key: string; id: number; name: string; guid: string; nick: string; w: number; l: number; t: number; pf: number; pa: number; seed: number; rank: number };

function teamOf(t: Y): YTeam {
  const m = merge(t);
  const mgr = merge(list(m.managers)[0]?.manager ?? m.managers?.[0]?.manager);
  const st = merge(m.team_standings);
  const o = merge(st.outcome_totals);
  return {
    key: String(m.team_key),
    id: Number(m.team_id),
    name: String(m.name ?? `Team ${m.team_id}`),
    guid: String(mgr.guid ?? `t${m.team_id}`),
    nick: String(mgr.nickname ?? m.name ?? "Manager"),
    w: Number(o.wins ?? 0),
    l: Number(o.losses ?? 0),
    t: Number(o.ties ?? 0),
    pf: Number(st.points_for ?? merge(m.team_points).total ?? 0),
    pa: Number(st.points_against ?? 0),
    seed: Number(st.playoff_seed ?? 0),
    rank: Number(st.rank ?? 0),
  };
}

export async function standings(token: string, key: string): Promise<YTeam[]> {
  const c = await yget(token, `league/${key}/standings`);
  const l = merge(c.league);
  const st = merge(list(l.standings)[0] ?? l.standings);
  return list(st.teams).map((e) => teamOf(e?.team));
}

export type YMatchup = { week: number; playoffs: boolean; consolation: boolean; final: boolean; winner: string | null; tied: boolean; teams: { key: string; pts: number }[] };

export async function scoreboard(token: string, key: string, week: number): Promise<YMatchup[]> {
  const c = await yget(token, `league/${key}/scoreboard;week=${week}`);
  const l = merge(c.league);
  const sb = merge(list(l.scoreboard)[0] ?? l.scoreboard);
  return list(sb.matchups).map((e) => {
    const m = merge(e?.matchup);
    const teams = list(merge(list(m)[0] ?? m["0"]).teams ?? m["0"]?.teams).map((t) => {
      const tm = merge(t?.team);
      return { key: String(tm.team_key), pts: Number(merge(tm.team_points).total ?? 0) };
    });
    return {
      week: Number(m.week ?? week),
      playoffs: String(m.is_playoffs ?? "0") === "1",
      consolation: String(m.is_consolation ?? "0") === "1",
      final: String(m.status ?? "") === "postevent",
      winner: m.winner_team_key ? String(m.winner_team_key) : null,
      tied: String(m.is_tied ?? "0") === "1",
      teams,
    };
  });
}

export type YPlayer = { yid: string; name: string; pos: string[]; team: string; slot: string; pts: number };

/** One team's roster for one week, with each player's points and lineup slot that week. */
export async function teamWeek(token: string, teamKey: string, week: number): Promise<YPlayer[]> {
  const c = await yget(token, `team/${teamKey}/roster;week=${week}/players/stats;type=week;week=${week}`);
  const t = merge(c.team);
  const roster = merge(t.roster);
  const players = merge(list(roster)[0] ?? roster["0"]).players ?? roster.players;
  return list(players).map((e) => {
    const p = merge(e?.player);
    return {
      yid: String(p.player_id),
      name: String(merge(p.name).full ?? p.player_id),
      pos: list(p.eligible_positions)
        .map((x) => String(merge(x).position ?? ""))
        .filter(Boolean),
      team: String(p.editorial_team_abbr ?? "").toUpperCase(),
      slot: String(merge(p.selected_position).position ?? "BN"),
      pts: Number(merge(p.player_points).total ?? 0),
    };
  });
}

export type YPick = { pick: number; round: number; team: string; yid: string };

export async function draftResults(token: string, key: string): Promise<YPick[]> {
  const c = await yget(token, `league/${key}/draftresults`);
  const l = merge(c.league);
  return records(l.draft_results, "draft_result")
    .filter((d) => d.player_key)
    .map((d) => ({ pick: Number(d.pick), round: Number(d.round), team: String(d.team_key), yid: String(d.player_key).split(".p.")[1] ?? "" }));
}

export type YTxn = { type: string; ts: number; moves: { yid: string; name: string; pos: string[]; kind: "add" | "drop"; from: string | null; to: string | null }[] };

/** Every completed transaction in a league (paged, 25 at a time). */
export async function transactions(token: string, key: string): Promise<YTxn[]> {
  const out: YTxn[] = [];
  for (let start = 0; start < 2000; start += 25) {
    const c = await yget(token, `league/${key}/transactions;start=${start};count=25`);
    const l = merge(c.league);
    const page = list(l.transactions);
    for (const e of page) {
      const t = merge(e?.transaction);
      if (String(t.status ?? "successful") !== "successful") continue;
      const moves = list(t.players).map((pe) => {
        const p = merge(pe?.player);
        const d = merge(p.transaction_data);
        return {
          yid: String(p.player_id),
          name: String(merge(p.name).full ?? p.player_id),
          pos: String(p.display_position ?? "").split(",").filter(Boolean),
          kind: (String(d.type) === "drop" ? "drop" : "add") as "add" | "drop",
          from: d.source_team_key ? String(d.source_team_key) : null,
          to: d.destination_team_key ? String(d.destination_team_key) : null,
        };
      });
      out.push({ type: String(t.type), ts: Number(t.timestamp ?? 0), moves });
    }
    if (page.length < 25) break;
  }
  return out;
}

/** Week start/end dates for an NFL season (for placing transactions in weeks). */
export async function gameWeeks(token: string, gameKey: string): Promise<{ week: number; start: string; end: string }[]> {
  const c = await yget(token, `game/${gameKey}/game_weeks`);
  const g = merge(c.game);
  return records(g.game_weeks, "game_week").map((w) => ({ week: Number(w.week), start: String(w.start), end: String(w.end) }));
}
