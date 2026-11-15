/**
 * Custom packs: league-specific features (in-jokes, mascots, lore) that sit on top of the
 * generic league app for one league only. This file only maps leagues to packs, so the generic
 * app never imports a pack's content unless that league is being viewed.
 */
export type PackId = "trash";

/** Every season's league id, for each pack. A family matches if any of its seasons is listed. */
const PACK_LEAGUES: Record<PackId, string[]> = {
  trash: ["1020516596416155648", "1136878464449273856", "1269480040253358080", "1400952185902120960"],
};

export function packIdFor(leagueIds: string[]): PackId | null {
  for (const [pack, ids] of Object.entries(PACK_LEAGUES) as [PackId, string[]][])
    if (leagueIds.some((id) => ids.includes(id))) return pack;
  return null;
}

/** Leagues the nightly job always tracks, even before anyone opens them in the app. */
export const ALWAYS_TRACKED = [PACK_LEAGUES.trash[PACK_LEAGUES.trash.length - 1]];
