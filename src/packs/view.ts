import type { Dataset } from "@/lib/core/types";
import type { LoadedPack } from "@/packs/types";

/**
 * A league's dataset as its custom pack shows it: managers by nickname and, once the league's
 * Dumpster Dive calendar is written in the pack's names (`diveNames` 2), the pack's short league
 * name. The grade step and the pages use this one function, so the questions they plan and show
 * are worded identically.
 */
export function packDataset(d: Dataset, pack: Pick<LoadedPack, "nicknames" | "leagueName"> | null | undefined, packNames = d.diveNames === 2): Dataset {
  if (!pack) return d;
  const nicks = pack.nicknames;
  const out = { ...d, league: { ...d.league, managers: d.league.managers.map((m) => ({ ...m, nick: nicks[m.nick] ?? m.nick })) } };
  return packNames && pack.leagueName ? { ...out, name: pack.leagueName } : out;
}
