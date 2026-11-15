import { sportPath, type LiveSource } from "@/lib/core/live-source";
import type { Standing } from "@/lib/core/types";

type R = {
  roster_id: number;
  owner_id: string;
  settings: Record<string, number>;
  metadata?: { record?: string; streak?: string };
};
type U = { user_id: string; display_name: string; metadata?: { team_name?: string } };

/** Live Season 4 table straight from Sleeper, refreshed every few minutes. Falls back to the snapshot.
 * Movement vs last week comes from each roster's official week-by-week record string ("LWW"):
 * drop the latest result to get last week's record; last week's points for is the official snapshot. */
/** `totalsAfter(k)`: each manager's official points for after k finished weeks (from saved
 * snapshots), or null when there's no snapshot for that week. */
export async function liveStandings(
  src: LiveSource,
  fallback: Standing[],
  totalsAfter: (weeksDone: number) => Record<string, number> | null,
): Promise<{
  rows: Standing[];
  live: boolean;
  week: number | null;
  asOf: string;
}> {
  try {
    const [rosters, users, state] = await Promise.all([
      src.get<R[]>(`/v1/league/${src.leagueId}/rosters`),
      src.get<U[]>(`/v1/league/${src.leagueId}/users`),
      src.get<{ week?: number }>(`/v1/state/${sportPath(src)}`),
    ]);
    const week: number | null =
      typeof state?.week === "number" ? state.week : null;
    const lastDone = Math.max(
      0,
      ...rosters.map((r: R) => (r.metadata?.record ?? "").length),
    );
    // Last week's points for comes from the official snapshots, never the matchup feed, which
    // reports different scores on different requests.
    const prevSnap = totalsAfter(lastDone - 1);
    const byUser = new Map<string, U>(users.map((u) => [u.user_id, u]));
    const base_ = rosters.map((r: R) => {
      const u = byUser.get(r.owner_id);
      const s = r.settings;
      const rec = r.metadata?.record ?? "";
      const pf =
        Math.round(((s.fpts ?? 0) + (s.fpts_decimal ?? 0) / 100) * 10) / 10;
      const prev = rec.slice(0, -1);
      return {
        row: {
          manager: u ? src.idOf(u) : "unknown",
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
        prevPf: prevSnap?.[u ? src.idOf(u) : ""] ?? 0,
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
          lastDone > 1 && prevSnap
            ? prevRank.get(x.row.manager)! - nowRank.get(x.row.manager)!
            : 0,
      }))
      .sort((a: Standing, b: Standing) => a.seed - b.seed);
    return { rows, live: true, week, asOf: new Date().toISOString() };
  } catch {
    return {
      rows: fallback,
      live: false,
      week: null,
      asOf: new Date().toISOString(),
    };
  }
}
