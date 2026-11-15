import { cacheLife } from "next/cache";
import { league } from "@/lib/league";
import * as core from "@/lib/core/live";
import type { LiveSource } from "@/lib/core/live-source";

/**
 * Live intel built on Sleeper's public endpoints (pairings, per-game projections,
 * per-game stats, trending adds). Team scores never come from here.
 */
const API = "https://api.sleeper.app";
const LEAGUE = league.seasons.find((s) => s.code === "s4")!.leagueId;

const get = async <T>(path: string): Promise<T> => {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json() as Promise<T>;
};

export type { Pickup } from "@/lib/core/live";

/** Trash's live source: its Season 4 league, plain fetch, display names as ids. */
const TRASH_LIVE: LiveSource = { leagueId: LEAGUE, get, idOf: (u) => u.display_name };

/**
 * This week's pairings (who plays whom), nothing else. Sleeper's matchup feed reports
 * different team scores on different requests for this daily-lineup league, so its points are
 * never shown; only the matchup_id pairing is used.
 */
export async function weekPairings(): Promise<{ week: number; opp: Record<string, string> } | null> {
  "use cache";
  cacheLife("minutes");
  return core.weekPairings(TRASH_LIVE);
}

export async function waiverIntel() {
  "use cache";
  cacheLife("minutes");
  return core.waiverIntel(TRASH_LIVE);
}

