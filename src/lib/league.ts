import { cacheLife } from "next/cache";
import data from "@/data/league.json";

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
};
export type Pick = { no: number; pid: string; player: string; by: string };
export type TradeSide = { pid: string | null; name: string };
export type Trade = {
  season: string;
  week: number;
  sides: Record<string, TradeSide[]>;
};
export type Season = {
  code: "s1" | "s2" | "s3" | "s4";
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

export const league = data as unknown as {
  seasons: Season[];
  managers: Manager[];
  h2h: Record<string, Record<string, number>>;
  totals: { seasons: number; managers: number; trades: number };
};

export const seasonLabel: Record<string, string> = {
  s1: "Season 1",
  s2: "Season 2",
  s3: "Season 3",
  s4: "Season 4",
};
export const manager = (id: string) => league.managers.find((m) => m.id === id);
export const avatar = (id: string) => `/avatars/${id}.jpg`;
export const headshot = (pid: string) => `/players/${pid}.jpg`;
export const record = (x: { w: number; l: number; t: number }) =>
  `${x.w}–${x.l}${x.t ? `–${x.t}` : ""}`;

/** Head to head (per Sleeper weekly data): [wins, losses] of a against b. */
export const h2h = (a: string, b: string): [number, number] => [
  league.h2h[a]?.[b] ?? 0,
  league.h2h[b]?.[a] ?? 0,
];

/** The most lopsided head-to-head records, owner first. */
export const ownership = (min = 6) => {
  const out: { owner: string; owned: string; w: number; l: number }[] = [];
  for (const a of Object.keys(league.h2h))
    for (const b of Object.keys(league.h2h[a])) {
      const [w, l] = h2h(a, b);
      if (w + l >= min && w > l) out.push({ owner: a, owned: b, w, l });
    }
  return out.sort((x, y) => y.w - y.l - (x.w - x.l) || y.w - x.w);
};

const current = league.seasons.find((s) => s.code === "s4")!;

/** Live Season 4 table straight from Sleeper, refreshed every few minutes. Falls back to the snapshot.
 * Movement vs last week comes from each roster's official week-by-week record string ("LWW"):
 * drop the latest result to get last week's record; points for drops last week's matchup score. */
export async function liveStandings(): Promise<{
  rows: Standing[];
  live: boolean;
  week: number | null;
  asOf: string;
}> {
  "use cache";
  cacheLife("minutes");
  try {
    const base = `https://api.sleeper.app/v1`;
    const [rosters, users, state] = await Promise.all([
      fetch(`${base}/league/${current.leagueId}/rosters`).then((r) => r.json()),
      fetch(`${base}/league/${current.leagueId}/users`).then((r) => r.json()),
      fetch(`${base}/state/nba`).then((r) => r.json()),
    ]);
    const week: number | null =
      typeof state?.week === "number" ? state.week : null;
    type R = {
      roster_id: number;
      owner_id: string;
      settings: Record<string, number>;
      metadata?: { record?: string; streak?: string };
    };
    const lastDone = Math.max(
      0,
      ...rosters.map((r: R) => (r.metadata?.record ?? "").length),
    );
    const prevMatch: { roster_id: number; points: number }[] =
      lastDone > 0
        ? await fetch(
            `${base}/league/${current.leagueId}/matchups/${lastDone}`,
          ).then((r) => r.json())
        : [];
    const byUser = new Map<
      string,
      { display_name: string; metadata?: { team_name?: string } }
    >(users.map((u: { user_id: string }) => [u.user_id, u]));
    const base_ = rosters.map((r: R) => {
      const u = byUser.get(r.owner_id);
      const s = r.settings;
      const rec = r.metadata?.record ?? "";
      const pf =
        Math.round(((s.fpts ?? 0) + (s.fpts_decimal ?? 0) / 100) * 10) / 10;
      const prev = rec.slice(0, -1);
      const lastPts =
        prevMatch.find((m) => m.roster_id === r.roster_id)?.points ?? 0;
      return {
        row: {
          manager: u?.display_name ?? "unknown",
          team: u?.metadata?.team_name || u?.display_name || "",
          w: s.wins ?? 0,
          l: s.losses ?? 0,
          t: s.ties ?? 0,
          pf,
          seed: 0,
          streak: r.metadata?.streak,
        } as Standing,
        prevW:
          [...prev].filter((c) => c === "W").length +
          [...prev].filter((c) => c === "T").length / 2,
        prevPf: pf - lastPts,
      };
    });
    const rank = (key: (x: (typeof base_)[number]) => [number, number]) =>
      new Map(
        [...base_]
          .sort((a, b) => key(b)[0] - key(a)[0] || key(b)[1] - key(a)[1])
          .map((x, i) => [x.row.manager, i + 1] as const),
      );
    const nowRank = rank((x) => [x.row.w + x.row.t / 2, x.row.pf]);
    const prevRank = rank((x) => [x.prevW, x.prevPf]);
    const rows: Standing[] = base_
      .map((x: (typeof base_)[number]) => ({
        ...x.row,
        seed: nowRank.get(x.row.manager)!,
        move:
          lastDone > 1
            ? prevRank.get(x.row.manager)! - nowRank.get(x.row.manager)!
            : 0,
      }))
      .sort((a: Standing, b: Standing) => a.seed - b.seed);
    return { rows, live: true, week, asOf: new Date().toISOString() };
  } catch {
    return {
      rows: current.standings,
      live: false,
      week: null,
      asOf: new Date().toISOString(),
    };
  }
}
