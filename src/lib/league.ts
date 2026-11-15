import { cacheLife } from "next/cache";
import data from "@/data/league.json";
import official from "@/data/official.json";

export type { Standing, Pick, TradeSide, Trade, Season, Manager } from "@/lib/core/types";
import type { LeagueData } from "@/lib/core/types";
import * as coreLeague from "@/lib/core/league";
import * as coreStandings from "@/lib/core/standings";
import type { LiveSource } from "@/lib/core/live-source";

export const league = data as unknown as LeagueData;

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
export const h2h = (a: string, b: string): [number, number] => coreLeague.h2h(league, a, b);

/** The most lopsided head-to-head records, owner first. */
export const ownership = (min = 6) => coreLeague.ownership(league, min);

const current = league.seasons.find((s) => s.code === "s4")!;
const TRASH_LIVE: LiveSource = {
  leagueId: current.leagueId,
  get: async <T,>(path: string): Promise<T> => (await fetch(`https://api.sleeper.app${path}`)).json() as Promise<T>,
  idOf: (u) => u.display_name,
};

/** Live Season 4 table straight from Sleeper, refreshed every few minutes. Falls back to the snapshot.
 * The logic is in core/standings.ts and works for any league. */
export async function liveStandings() {
  "use cache";
  cacheLife("minutes");
  return coreStandings.liveStandings(
    TRASH_LIVE,
    current.standings,
    (k) => (official as unknown as Record<string, Record<string, Record<string, number>>>).s4?.[String(k)] ?? null,
  );
}
