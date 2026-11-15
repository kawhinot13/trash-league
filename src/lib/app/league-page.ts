import "server-only";
import { after } from "next/server";
import { ANALYSIS_VERSION } from "@/lib/app/analysis";
import { hasDb } from "@/lib/app/db";
import { enqueueImport, kick, latestJob, progress, runJobs } from "@/lib/app/jobs";
import { familyView } from "@/lib/app/model";
import { formatOf } from "@/lib/app/family";
import { clientIp } from "@/lib/app/ratelimit";
import { logError } from "@/lib/app/safe";
import { analysisOf, getFamily, snapshots, type Snapshot } from "@/lib/app/store";
import { packIdFor } from "@/packs/ids";
import { loadPack } from "@/packs";

export type LoadResult =
  | { status: "ok"; page: LeaguePage }
  | { status: "not_found" }
  | { status: "limited"; minutes: number }
  | { status: "removed"; purgeAfter: string | null }
  | { status: "error" };

/** Everything a league's pages show, in one load. */
export async function loadLeague(leagueId: string, opts: { snapshots?: boolean } = {}): Promise<LoadResult> {
  let got;
  try {
    got = await getFamily(leagueId, await clientIp());
  } catch (e) {
    logError(`league ${leagueId}`, e);
    return { status: "error" };
  }
  if (got.status === "not_found") return { status: "not_found" };
  if (got.status === "limited") return { status: "limited", minutes: got.minutes };
  if (got.status === "removed") return { status: "removed", purgeAfter: got.purgeAfter?.toISOString() ?? null };
  const view = familyView(got.family);
  const ids = got.family.seasons.map((s) => s.league.league_id);
  const [analysis, snaps, job, pack] = await Promise.all([
    analysisOf(view.id).catch(() => null),
    opts.snapshots ? snapshots(view.current.leagueId).catch(() => [] as Snapshot[]) : Promise.resolve([] as Snapshot[]),
    latestJob(view.id).catch(() => null),
    loadPack(packIdFor(ids)),
  ]);
  // Results from an older version of the grading: regrade in the background (no new weeks to fetch).
  const open = job && (job.status === "queued" || job.status === "running");
  if (hasDb() && analysis && (analysis.version ?? 1) < ANALYSIS_VERSION && !open)
    after(async () => {
      await enqueueImport(view.id);
      const r = await runJobs(50_000);
      if (r.more) await kick();
    });
  // Names: newest display name per Sleeper user, or the pack's nickname for them.
  const names = new Map<string, string>();
  for (const c of view.careers) names.set(c.ownerId, pack?.nicknames[c.name] ?? c.name);
  for (const s of view.seasons) for (const t of s.teams) if (!t.ownerId) names.set(`r${t.rosterId}`, t.team);
  const nameOf = (who: string | null | undefined) => (who ? (names.get(who) ?? "Open team") : "Open team");
  return {
    status: "ok",
    page: {
      leagueId,
      view,
      format: formatOf(got.family.seasons[got.family.seasons.length - 1].league),
      analysis: analysis && (analysis.version ?? 1) >= 1 ? { ...analysis, games: analysis.games ?? [] } : null,
      weekly: exactWeekly(snaps),
      nights: new Set(snaps.map((s) => s.day)).size,
      firstNight: snaps[0]?.day ?? null,
      progress: progress(job),
      db: hasDb(),
      pack,
      nameOf,
    },
  };
}
export type LeaguePage = {
  leagueId: string;
  view: ReturnType<typeof familyView>;
  format: ReturnType<typeof formatOf>;
  analysis: (NonNullable<Awaited<ReturnType<typeof analysisOf>>> & { games: NonNullable<Awaited<ReturnType<typeof analysisOf>>>["games"] }) | null;
  weekly: Map<number, Map<number, number>>;
  nights: number;
  firstNight: string | null;
  progress: ReturnType<typeof progress>;
  db: boolean;
  pack: Awaited<ReturnType<typeof loadPack>>;
  nameOf: (who: string | null | undefined) => string;
};

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
