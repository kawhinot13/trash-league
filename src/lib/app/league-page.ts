import "server-only";
import { hasDb } from "@/lib/app/db";
import { latestJob, type Progress } from "@/lib/app/jobs";
import { familyView } from "@/lib/app/model";
import { formatOf } from "@/lib/app/family";
import { clientIp } from "@/lib/app/ratelimit";
import { logError } from "@/lib/app/safe";
import { analysisOf, datasetOf, getFamily, snapshots, storedLeague, type Snapshot, type StoredLeague } from "@/lib/app/store";
import type { BrandConfig } from "@/components/trash/brand";
import type { Dataset } from "@/lib/core/types";
import { packIdFor } from "@/packs/ids";
import { loadPack } from "@/packs";

export type LoadResult =
  | { status: "ok"; page: LeaguePage }
  | { status: "not_found" }
  /** Not stored yet: the page asks the import API (rate limited per network) to fetch it. */
  | { status: "missing" }
  | { status: "limited"; minutes: number }
  | { status: "removed"; purgeAfter: string | null }
  | { status: "error" };

/** Everything a league's pages show, in one load. */
export async function loadLeague(leagueId: string, opts: { snapshots?: boolean; dataset?: boolean } = {}): Promise<LoadResult> {
  // Fast path: the league is stored. One read from the shared cache, no database round trips;
  // in-season data is refreshed from Sleeper in the background.
  let stored: StoredLeague | null = null;
  try {
    stored = await storedLeague(leagueId);
  } catch (e) {
    logError(`cached league ${leagueId}`, e);
  }
  let family;
  if (stored) {
    if (stored.removed) return { status: "removed", purgeAfter: stored.removed.purgeAfter };
    family = stored.family; // refreshed from Sleeper via /api/l/[id]/refresh (the page is cached)
  } else if (hasDb()) {
    // Not stored yet. Pages stay cacheable (no per-visitor work here); the browser starts the
    // import through the rate-limited API and the page refreshes once the league is saved.
    return { status: "missing" };
  } else {
    // No database (local development): discover the league on every visit.
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
    family = got.family;
  }
  const view = familyView(family);
  const ids = family.seasons.map((s) => s.league.league_id);
  const [analysis, snaps, job, pack, dataset] = await Promise.all([
    stored ? stored.analysis : analysisOf(view.id).catch(() => null),
    !opts.snapshots ? [] : stored ? stored.snapshots : snapshots(view.current.leagueId).catch(() => [] as Snapshot[]),
    stored ? stored.job : latestJob(view.id).then((j) => (j ? { status: j.status, phase: j.state.phase, i: j.state.i ?? 0, total: j.state.total ?? 0 } : null)).catch(() => null),
    loadPack(packIdFor(ids)),
    !opts.dataset ? null : stored ? stored.dataset : datasetOf(view.id).catch(() => null),
  ]);
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
      format: formatOf(family.seasons[family.seasons.length - 1].league),
      analysis: analysis && (analysis.version ?? 1) >= 1 ? { ...analysis, games: analysis.games ?? [] } : null,
      weekly: exactWeekly(snaps),
      nights: new Set(snaps.map((s) => s.day)).size,
      firstNight: snaps[0]?.day ?? null,
      progress: progressOf(job),
      db: hasDb(),
      pack,
      nameOf,
      dataset: dataset ? withTeams(withNicknames(dataset, pack?.nicknames), view) : null,
      brand: brandFor(leagueId, view, dataset),
    },
  };
}

/** Each manager's newest team name (datasets graded before it was stored carry the handle there). */
function withTeams(d: Dataset, view: ReturnType<typeof familyView>): Dataset {
  const team = new Map<string, string>();
  for (const s of view.seasons) for (const t of s.teams) if (t.ownerId) team.set(t.ownerId, t.team);
  return { ...d, league: { ...d.league, managers: d.league.managers.map((m) => ({ ...m, team: team.get(m.id) ?? m.team })) } };
}

/** A custom pack's nicknames replace display names in the league's dataset. */
function withNicknames(d: Dataset, nicks?: Record<string, string>): Dataset {
  if (!nicks) return d;
  return { ...d, league: { ...d.league, managers: d.league.managers.map((m) => ({ ...m, nick: nicks[m.nick] ?? m.nick })) } };
}

/** How the shared league components render for this league. */
function brandFor(leagueId: string, view: ReturnType<typeof familyView>, d: Dataset | null): BrandConfig {
  return {
    name: view.name,
    tag: "League",
    base: `/l/${leagueId}`,
    storage: `rl:${view.id}:`,
    scores: `/api/l/${leagueId}/scores`,
    avatars: Object.fromEntries(view.careers.map((c) => [c.ownerId, c.avatar])),
    headshots: "sleeper",
    games: { dive: "Deep Cut", wordle: "Rosterdle", lineup: "The Lineup" },
    names: Object.fromEntries(view.careers.map((c) => [c.ownerId, c.name])),
    short: Object.fromEntries(
      (d?.league.seasons ?? []).map((s) => [s.code, `’${s.years.slice(2, 4)}`]),
    ),
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
  progress: Progress | null;
  db: boolean;
  pack: Awaited<ReturnType<typeof loadPack>>;
  nameOf: (who: string | null | undefined) => string;
  /** Trash-shaped dataset for the shared features (null until the first import finishes). */
  dataset: Dataset | null;
  brand: BrandConfig;
};

/** The import progress bar's starting state, from the latest job. */
function progressOf(j: StoredLeague["job"]): Progress | null {
  if (!j) return null;
  return {
    status: j.status as Progress["status"],
    phase: j.phase as Progress["phase"],
    done: j.i,
    total: j.total,
    pct: j.status === "done" ? 1 : j.total ? Math.min(0.97, j.i / j.total) : 0.02,
    error: j.status === "failed" ? "Sleeper didn't answer" : null,
  };
}

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
