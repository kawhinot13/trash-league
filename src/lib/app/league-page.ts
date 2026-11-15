import "server-only";
import { hasDb } from "@/lib/app/db";
import { latestJob, progress } from "@/lib/app/jobs";
import { familyView } from "@/lib/app/model";
import { formatOf } from "@/lib/app/family";
import { analysisOf, getFamily, snapshots, type Snapshot } from "@/lib/app/store";
import { packIdFor } from "@/packs/ids";
import { loadPack } from "@/packs";

/** Everything the league page shows, in one load. */
export async function leaguePage(leagueId: string) {
  const got = await getFamily(leagueId);
  if (!got) return null;
  const view = familyView(got.family);
  const ids = got.family.seasons.map((s) => s.league.league_id);
  const [analysis, snaps, job, pack] = await Promise.all([
    analysisOf(view.id).catch(() => null),
    snapshots(view.current.leagueId).catch(() => [] as Snapshot[]),
    latestJob(view.id).catch(() => null),
    loadPack(packIdFor(ids)),
  ]);
  // Names: newest display name per Sleeper user, or the pack's nickname for them.
  const names = new Map<string, string>();
  for (const c of view.careers) names.set(c.ownerId, pack?.nicknames[c.name] ?? c.name);
  for (const s of view.seasons) for (const t of s.teams) names.set(`r${t.rosterId}`, t.team);
  const nameOf = (who: string | null | undefined) => (who ? (names.get(who) ?? "Open team") : "Open team");
  return {
    view,
    format: formatOf(got.family.seasons[got.family.seasons.length - 1].league),
    analysis,
    weekly: exactWeekly(snaps),
    nights: new Set(snaps.map((s) => s.day)).size,
    firstNight: snaps[0]?.day ?? null,
    progress: progress(job),
    db: hasDb(),
    pack,
    nameOf,
  };
}
export type LeaguePage = NonNullable<Awaited<ReturnType<typeof leaguePage>>>;

/** roster id -> week number (1-based count of finished weeks) -> exact official score. */
function exactWeekly(snaps: Snapshot[]) {
  const at = new Map<number, Map<number, number>>();
  for (const s of snaps) (at.get(s.rosterId) ?? at.set(s.rosterId, new Map()).get(s.rosterId)!).set(s.weeksDone, s.pf);
  const out = new Map<number, Map<number, number>>();
  for (const [rid, m] of at) {
    const w = new Map<number, number>();
    for (const [k, pf] of m) {
      if (k < 1) continue;
      const before = k === 1 ? 0 : m.get(k - 1);
      if (before !== undefined) w.set(k, Math.round((pf - before) * 10) / 10);
    }
    out.set(rid, w);
  }
  return out;
}
