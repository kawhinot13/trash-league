import { cacheLife } from "next/cache";
import data from "@/data/extras.json";
import { weeklyRecap, type RecapWeek } from "@/lib/extras";
import { league } from "@/lib/league";

/**
 * Season 4 weekly recap read live from Sleeper (refreshed every few minutes).
 *
 * Sleeper keeps re-scoring finished weeks in this league (a week 3 score moved from 462 to 515
 * hours after the week ended), so a once-a-day snapshot drifts from what the app shows. Scores,
 * matchups, top performers and waiver adds all come from the live matchups. The "best possible
 * lineup" still comes from the nightly box-score replay, never shown below the live score.
 */
const API = "https://api.sleeper.app";
const s4 = league.seasons.find((s) => s.code === "s4")!;

type Matchup = { roster_id: number; matchup_id: number | null; points: number; starters: string[]; starters_points: number[] };
type Tx = { type: string; status: string; adds: Record<string, number> | null };

const get = async <T>(path: string): Promise<T> => {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json() as Promise<T>;
};

export async function liveRecap(): Promise<{ years: string; weeks: RecapWeek[]; live: boolean }> {
  "use cache";
  cacheLife("minutes");
  const snap = weeklyRecap("s4");
  try {
    const [state, users, rosters] = await Promise.all([
      get<{ week: number }>("/v1/state/nba"),
      get<{ user_id: string; display_name: string }[]>(`/v1/league/${s4.leagueId}/users`),
      get<{ roster_id: number; owner_id: string }[]>(`/v1/league/${s4.leagueId}/rosters`),
    ]);
    const name = new Map(users.map((u) => [u.user_id, u.display_name]));
    const who = new Map(rosters.map((r) => [r.roster_id, name.get(r.owner_id) ?? String(r.roster_id)]));
    const done = Array.from({ length: Math.max(0, state.week - 1) }, (_, i) => i + 1);
    const data = await Promise.all(
      done.map((w) => Promise.all([get<Matchup[]>(`/v1/league/${s4.leagueId}/matchups/${w}`), get<Tx[]>(`/v1/league/${s4.leagueId}/transactions/${w}`)])),
    );
    const weeks: RecapWeek[] = done.map((week, i) => {
      const [mus, txs] = data[i];
      const old = snap.weeks.find((x) => x.week === week);
      const pairs = new Map<number, Matchup[]>();
      for (const m of mus) if (m.matchup_id !== null) pairs.set(m.matchup_id, [...(pairs.get(m.matchup_id) ?? []), m]);
      const games = [...pairs.values()]
        .filter((p) => p.length === 2)
        .map(([a, b]) => (a.points >= b.points ? { w: who.get(a.roster_id)!, l: who.get(b.roster_id)!, ws: a.points, ls: b.points } : { w: who.get(b.roster_id)!, l: who.get(a.roster_id)!, ws: b.points, ls: a.points }))
        .sort((x, y) => y.ws - y.ls - (x.ws - x.ls));
      const scores = mus.map((m) => ({ id: who.get(m.roster_id)!, pts: m.points })).sort((a, b) => b.pts - a.pts);
      const starts = mus.flatMap((m) => m.starters.map((pid, k) => ({ id: who.get(m.roster_id)!, pid, pts: m.starters_points[k] ?? 0 })));
      const top = starts.filter((s) => s.pid && s.pid !== "0").sort((a, b) => b.pts - a.pts).slice(0, 3);
      // bench crime / most locked in: live actual score vs the replayed best lineup
      const s4lines = snapOpt.get(week);
      const lines = mus
        .map((m) => {
          const id = who.get(m.roster_id)!;
          const best = s4lines?.get(id);
          return best === undefined ? null : { id, act: m.points, opt: Math.max(best, m.points) };
        })
        .filter((x): x is { id: string; act: number; opt: number } => !!x);
      const crime = [...lines].sort((x, y) => y.opt - y.act - (x.opt - x.act))[0] ?? old?.crime ?? null;
      const locked = [...lines].sort((x, y) => y.act / y.opt - x.act / x.opt)[0] ?? old?.locked ?? null;
      const adds = txs
        .filter((t) => t.status === "complete" && t.type !== "trade")
        .flatMap((t) => Object.entries(t.adds ?? {}).map(([pid, rid]) => ({ id: who.get(rid)!, pid })))
        .map((a) => ({ ...a, pts: starts.find((s) => s.id === a.id && s.pid === a.pid)?.pts ?? 0 }))
        .sort((a, b) => b.pts - a.pts);
      return {
        week,
        blowout: games[0] ?? null,
        close: games[games.length - 1] ?? null,
        high: scores[0] ?? null,
        low: scores[scores.length - 1] ?? null,
        crime,
        locked,
        top,
        steal: adds[0]?.pts ? adds[0] : null,
      };
    });
    return { years: snap.years, weeks: weeks.reverse(), live: true };
  } catch {
    return { ...snap, live: false };
  }
}

/** Replayed best-lineup totals per week per manager, from the nightly build. */
const snapOpt = (() => {
  const seasons = (data as unknown as { seasons: { code: string; lineups: Record<string, [number, number, number][]> }[] }).seasons;
  const m = new Map<number, Map<string, number>>();
  for (const [id, rows] of Object.entries(seasons.find((s) => s.code === "s4")?.lineups ?? {}))
    for (const [w, , opt] of rows) (m.get(w) ?? m.set(w, new Map()).get(w)!).set(id, opt);
  return m;
})();
