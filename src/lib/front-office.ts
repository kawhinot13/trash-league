import { cacheLife } from "next/cache";
import { league } from "@/lib/league";
import * as core from "@/lib/core/front-office";
import type { LiveSource } from "@/lib/core/live-source";

/** Front Office for the Trash site: every Season 4 roster with player values, live from Sleeper.
 * The analysis itself is in core/front-office.ts and works for any league. */
export type { FOPlayer, FOTeam, FrontOffice } from "@/lib/core/front-office";

const API = "https://api.sleeper.app";
const LEAGUE = league.seasons.find((s) => s.code === "s4")!.leagueId;
const get = async <T>(path: string): Promise<T> => {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json() as Promise<T>;
};
const TRASH_LIVE: LiveSource = { leagueId: LEAGUE, get, idOf: (u) => u.display_name };

export async function frontOffice() {
  "use cache";
  cacheLife("hours");
  return core.frontOffice(TRASH_LIVE);
}
