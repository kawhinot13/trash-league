import { cacheLife } from "next/cache";
import data from "@/data/extras.json";
import official from "@/data/official.json";
import type { RecapWeek } from "@/lib/extras";
import { league } from "@/lib/league";
import { verifiedWeeks } from "@/lib/core/official";

/**
 * Season 4 weekly recap, built only from numbers Sleeper reports reliably.
 *
 * Sleeper's weekly matchup endpoint is NOT reliable for this league (daily lineups): the same
 * finished week comes back with different team scores on different requests, none of which
 * match the app (KawhiNot's week 3: API 286–515, app 533.5). So team scores are never read
 * from it. Instead:
 *  - results (who beat whom) come from each roster's official record string;
 *  - a team's weekly score is the change in its official points-for between two nightly
 *    snapshots (src/data/official.json). Weeks without both snapshots show no team scores;
 *  - player performances come from NBA box scores.
 */
const API = "https://api.sleeper.app";
const s4 = league.seasons.find((s) => s.code === "s4")!;

type Matchup = { roster_id: number; matchup_id: number | null; players: string[] | null };
type Tx = { type: string; status: string; adds: Record<string, number> | null; status_updated?: number; created: number };
type Row = { player_id: string; date: string | null; stats: Record<string, number> };

const get = async <T>(path: string): Promise<T> => {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json() as Promise<T>;
};

/** Official points for / against after N completed weeks: { "3": { manager: total } } (first capture). */
const off = official as unknown as Record<string, Record<string, Record<string, number>>>;
const verified = verifiedWeeks(
  Object.entries(off.s4 ?? {}).flatMap(([k, m]) =>
    Object.entries(m).map(([key, pf]) => ({ key, weeksDone: Number(k), pf, pa: off.s4_pa?.[k]?.[key] ?? null, day: "" })),
  ),
);
/** Exact weekly team scores, only when every team's score is proven (core/official.ts), else null. */
export function officialWeek(week: number): Map<string, number> | null {
  const m = verified.get(week);
  const teams = Object.keys(off.s4?.[String(week)] ?? {}).length;
  return m && teams && m.size === teams ? m : null;
}

/** Best possible lineup per week per manager, from the nightly box-score replay. */
const optimal = (() => {
  const seasons = (data as unknown as { seasons: { code: string; lineups: Record<string, [number, number, number][]> }[] }).seasons;
  const m = new Map<number, Map<string, number>>();
  for (const [id, rows] of Object.entries(seasons.find((s) => s.code === "s4")?.lineups ?? {}))
    for (const [w, , opt] of rows) (m.get(w) ?? m.set(w, new Map()).get(w)!).set(id, opt);
  return m;
})();

export async function liveRecap(): Promise<{ years: string; weeks: RecapWeek[]; live: boolean }> {
  "use cache";
  cacheLife("minutes");
  try {
    const [state, users, rosters, lg] = await Promise.all([
      get<{ week: number; season: string }>("/v1/state/nba"),
      get<{ user_id: string; display_name: string }[]>(`/v1/league/${s4.leagueId}/users`),
      get<{ roster_id: number; owner_id: string; metadata?: { record?: string } }[]>(`/v1/league/${s4.leagueId}/rosters`),
      get<{ scoring_settings: Record<string, number> }>(`/v1/league/${s4.leagueId}`),
    ]);
    const sc = lg.scoring_settings;
    const fp = (st: Record<string, number>) => Object.entries(sc).reduce((t, [k, w]) => t + (st[k] ?? 0) * w, 0);
    const name = new Map(users.map((u) => [u.user_id, u.display_name]));
    const who = new Map(rosters.map((r) => [r.roster_id, name.get(r.owner_id) ?? String(r.roster_id)]));
    const record = new Map(rosters.map((r) => [r.roster_id, r.metadata?.record ?? ""]));
    const done = Array.from({ length: Math.max(0, state.week - 1) }, (_, i) => i + 1);
    const raw = await Promise.all(
      done.map((w) =>
        Promise.all([
          get<Matchup[]>(`/v1/league/${s4.leagueId}/matchups/${w}`),
          get<Tx[]>(`/v1/league/${s4.leagueId}/transactions/${w}`),
          get<Row[]>(`/stats/nba/${state.season}/${w}?season_type=regular`),
        ]),
      ),
    );
    const weeks: RecapWeek[] = done.map((week, i) => {
      const [mus, txs, stats] = raw[i];
      // pairings are stable even when scores aren't; results come from the official record
      const pairs = new Map<number, number[]>();
      for (const m of mus) if (m.matchup_id !== null) pairs.set(m.matchup_id, [...(pairs.get(m.matchup_id) ?? []), m.roster_id]);
      const results = [...pairs.values()]
        .filter((p) => p.length === 2)
        .map(([a, b]) => {
          const r = record.get(a)?.[week - 1];
          return r === "W" ? { w: who.get(a)!, l: who.get(b)! } : r === "L" ? { w: who.get(b)!, l: who.get(a)! } : null;
        })
        .filter((x): x is { w: string; l: string } => !!x);
      const exact = officialWeek(week);
      const scored = exact
        ? results.map((g) => ({ ...g, ws: exact.get(g.w) ?? 0, ls: exact.get(g.l) ?? 0 })).sort((x, y) => y.ws - y.ls - (x.ws - x.ls))
        : [];
      const scores = exact ? [...exact].map(([id, pts]) => ({ id, pts })).sort((a, b) => b.pts - a.pts) : [];
      const lines = exact
        ? [...exact]
            .map(([id, act]) => {
              const opt = optimal.get(week)?.get(id);
              return opt === undefined ? null : { id, act, opt: Math.max(opt, act) };
            })
            .filter((x): x is { id: string; act: number; opt: number } => !!x)
        : [];
      // player performances: best single game by a player on each roster that week
      const owner = new Map<string, string>();
      for (const m of mus) for (const pid of m.players ?? []) owner.set(pid, who.get(m.roster_id)!);
      const bestGame = new Map<string, number>();
      for (const r of stats) if (r.date && (r.stats.min ?? 0)) bestGame.set(r.player_id, Math.max(bestGame.get(r.player_id) ?? 0, fp(r.stats)));
      const top = [...bestGame]
        .filter(([pid]) => owner.has(pid))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([pid, pts]) => ({ id: owner.get(pid)!, pid, pts: Math.round(pts * 10) / 10 }));
      const steal =
        txs
          .filter((t) => t.status === "complete" && t.type !== "trade")
          .flatMap((t) => Object.entries(t.adds ?? {}).map(([pid, rid]) => ({ id: who.get(rid)!, pid, pts: Math.round((bestGame.get(pid) ?? 0) * 10) / 10 })))
          .sort((a, b) => b.pts - a.pts)[0] ?? null;
      return {
        week,
        results,
        exact: !!exact,
        blowout: scored[0] ?? null,
        close: scored[scored.length - 1] ?? null,
        high: scores[0] ?? null,
        low: scores[scores.length - 1] ?? null,
        crime: [...lines].sort((x, y) => y.opt - y.act - (x.opt - x.act))[0] ?? null,
        locked: [...lines].sort((x, y) => y.act / y.opt - x.act / x.opt)[0] ?? null,
        top,
        steal: steal && steal.pts > 0 ? steal : null,
      };
    });
    return { years: s4.years, weeks: weeks.reverse(), live: true };
  } catch {
    return { years: s4.years, weeks: [], live: false };
  }
}
