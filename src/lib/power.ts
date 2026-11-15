import data from "@/data/extras.json";
import { frontOffice } from "@/lib/front-office";
import { league, liveStandings } from "@/lib/league";
import { officialWeek } from "@/lib/recap-live";
import * as core from "@/lib/core/power";

/** Season 4 power rankings for the Trash site. The formula is in core/power.ts. */
export type { PowerRow } from "@/lib/core/power";

type Lines = Record<string, [number, number, number][]>;
const s4lines = (): Lines =>
  (data as unknown as { seasons: { code: string; lineups: Lines }[] }).seasons.find((s) => s.code === "s4")?.lineups ?? {};

export async function powerRankings() {
  const [{ rows: table, week }, fo] = await Promise.all([liveStandings(), frontOffice()]);
  return core.powerRankings({
    table,
    week,
    fo,
    lines: s4lines(),
    officialWeek,
    nick: (id) => league.managers.find((m) => m.id === id)?.nick ?? id,
  });
}
