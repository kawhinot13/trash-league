import "server-only";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { db, hasDb, todayET } from "@/lib/app/db";
import { discoverFamily, refreshSeason, sanitizeBundle, walkForward, type Family, type SeasonBundle } from "@/lib/app/family";
import { take } from "@/lib/app/ratelimit";
import { isSleeperId } from "@/lib/app/validate";
import { official } from "@/lib/app/sleeper";
import type { Analysis } from "@/lib/app/analysis";
import type { Dataset } from "@/lib/core/types";
import { packIdFor } from "@/packs/ids";

const STALE_MS = 10 * 60_000;

/** Without a database, keep discovery results for a few minutes (it's a dozen Sleeper calls). */
async function discoverCached(leagueId: string): Promise<Family | null> {
  "use cache";
  cacheLife("minutes");
  return discoverFamily(leagueId);
}
const live = (b: SeasonBundle) => b.league.status !== "complete";

/**
 * How cached pages learn about new data. "now": the next visit rebuilds before it's shown (first
 * import, removal, restore: stale content would be wrong). "soon": visitors keep getting the cached
 * page instantly while a fresh one is built in the background (routine refreshes and regrades).
 */
export type Freshness = "now" | "soon";

export async function saveFamily(f: Family, freshness: Freshness = "now"): Promise<void> {
  const sql = await db();
  f = { ...f, seasons: f.seasons.map(sanitizeBundle) };
  const newest = f.seasons[f.seasons.length - 1].league;
  const pack = packIdFor(f.seasons.map((s) => s.league.league_id));
  await sql.begin(async (tx) => {
    // A longer chain can turn up later (an older season found): fold the old family into this one.
    const ids = f.seasons.map((s) => s.league.league_id);
    const old = (await tx<{ family_id: string }[]>`
      select distinct family_id from leagues where league_id in ${tx(ids)} and family_id <> ${f.id}`).map((r) => r.family_id);
    await tx`
      insert into families (id, name, custom_pack) values (${f.id}, ${newest.name}, ${pack})
      on conflict (id) do update set name = excluded.name, custom_pack = excluded.custom_pack, refreshed_at = now()`;
    for (const s of f.seasons)
      await tx`
        insert into leagues (league_id, family_id, season, status, name, bundle, fetched_at)
        values (${s.league.league_id}, ${f.id}, ${s.league.season}, ${s.league.status}, ${s.league.name},
                ${tx.json(s as never)}, ${s.fetchedAt})
        on conflict (league_id) do update set family_id = excluded.family_id, season = excluded.season,
          status = excluded.status, name = excluded.name, bundle = excluded.bundle, fetched_at = excluded.fetched_at`;
    if (old.length) await tx`delete from families where id in ${tx(old)}`;
  });
  // Pages cached while a season wasn't stored yet ("import this league") now have data.
  for (const s of f.seasons) dropTag(leagueTag(s.league.league_id), freshness);
  dropTag(familyTag(f.id), freshness);
}

async function readFamily(familyId: string): Promise<Family | null> {
  const sql = await db();
  const rows = await sql<{ bundle: SeasonBundle }[]>`
    select bundle from leagues where family_id = ${familyId} order by season, league_id`;
  return rows.length ? { id: familyId, seasons: rows.map((r) => r.bundle) } : null;
}

export async function familyIdOf(leagueId: string): Promise<string | null> {
  const sql = await db();
  const [row] = await sql<{ family_id: string }[]>`select family_id from leagues where league_id = ${leagueId}`;
  return row?.family_id ?? null;
}

/** Cache tag for everything stored about one league family. */
export const familyTag = (familyId: string) => `family:${familyId}`;

/** Cache tag for one Sleeper league id, stored or not (pages cache "not imported yet" too). */
export const leagueTag = (leagueId: string) => `league:${leagueId}`;

function dropTag(tag: string, freshness: Freshness = "now") {
  try {
    revalidateTag(tag, freshness === "now" ? { expire: 0 } : "max");
  } catch {
    // Outside a request (a script or test): nothing cached to drop.
  }
}

/** Drop a family's cached pages so the next visit reads fresh data (after an import, a removal...). */
export function invalidateFamily(familyId: string, freshness: Freshness = "soon") {
  dropTag(familyTag(familyId), freshness);
}

export type StoredLeague = {
  family: Family;
  analysis: Analysis | null;
  dataset: Dataset | null;
  snapshots: Snapshot[];
  removed: { purgeAfter: string | null } | null;
  /** Latest import job, reduced to what pages show. */
  job: { status: string; phase: string; i: number; total: number } | null;
};

/**
 * Everything stored about the league `leagueId` belongs to, in one read, kept in the shared remote
 * cache (every server instance, all visitors) so league pages don't wait on the database. Cleared by
 * invalidateFamily when new data lands; otherwise refreshed in the background every few minutes.
 * Returns null for a league Rafterlore hasn't stored (the caller discovers it).
 */
export async function storedLeague(leagueId: string): Promise<StoredLeague | null> {
  "use cache: remote";
  cacheLife({ stale: 60, revalidate: 300, expire: 86_400 });
  if (!hasDb() || !isSleeperId(leagueId)) return null;
  cacheTag(leagueTag(leagueId));
  const fid = await familyIdOf(leagueId);
  if (!fid) return null;
  cacheTag(familyTag(fid));
  const sql = await db();
  const family = await readFamily(fid);
  if (!family) return null;
  const current = family.seasons[family.seasons.length - 1].league.league_id;
  const [analysis, dataset, snaps, gone, jobs] = await Promise.all([
    analysisOf(fid),
    datasetOf(fid),
    snapshots(current),
    removalOf([leagueId], fid),
    sql<{ status: string; state: { phase?: string; i?: number; total?: number } }[]>`
      select status, state from jobs where family_id = ${fid} and kind = 'import' order by id desc limit 1`,
  ]);
  const j = jobs[0];
  return {
    family,
    analysis,
    dataset,
    snapshots: snaps,
    removed: gone ? { purgeAfter: gone.purgeAfter?.toISOString() ?? null } : null,
    job: j ? { status: j.status, phase: j.state.phase ?? "plan", i: j.state.i ?? 0, total: j.state.total ?? 0 } : null,
  };
}

const refreshing = new Set<string>();
/** Refresh in-progress seasons from Sleeper in the background (visits never wait for it). */
export async function refreshStale(family: Family) {
  const stale = family.seasons.filter((s) => live(s) && Date.now() - Date.parse(s.fetchedAt) > STALE_MS);
  if (!stale.length || refreshing.has(family.id)) return;
  refreshing.add(family.id);
  try {
    const fresh = await Promise.all(stale.map((s) => refreshSeason(s.league.league_id).catch(() => null)));
    const byId = new Map(fresh.filter(Boolean).map((b) => [b!.league.league_id, b!]));
    if (byId.size) {
      // Background refresh: visitors keep the cached pages while fresh ones build.
      await saveFamily({ ...family, seasons: family.seasons.map((s) => byId.get(s.league.league_id) ?? s) }, "soon");
    }
  } finally {
    refreshing.delete(family.id);
  }
}

export type FamilyResult =
  | { status: "ok"; family: Family; isNew: boolean }
  | { status: "not_found" }
  | { status: "limited"; minutes: number }
  | { status: "removed"; familyId: string; purgeAfter: Date | null };

/** Leagues that asked to be removed: any of these ids, or the family. */
async function removalOf(ids: string[], familyId?: string): Promise<{ familyId: string; purgeAfter: Date | null } | null> {
  const sql = await db();
  const [r] = await sql<{ family_id: string; purge_after: Date; purged: boolean }[]>`
    select family_id, purge_after, purged from removals
    where league_id in ${sql(ids)} ${familyId ? sql`or family_id = ${familyId}` : sql``} limit 1`;
  return r ? { familyId: r.family_id, purgeAfter: r.purged ? null : r.purge_after } : null;
}

/**
 * The family `leagueId` belongs to. With a database: read it, refreshing an in-progress season
 * that's more than a few minutes old. A league Rafterlore hasn't seen is discovered (every season),
 * saved, and gets day one's points-for snapshot, as long as the visitor is within the import
 * rate limit (`ip`; internal callers pass null to skip it). Without a database: straight from Sleeper.
 */
export async function getFamily(leagueId: string, ip: string | null): Promise<FamilyResult> {
  if (!isSleeperId(leagueId)) return { status: "not_found" };
  if (!hasDb()) {
    const family = await discoverCached(leagueId);
    return family ? { status: "ok", family, isNew: false } : { status: "not_found" };
  }
  const fid = await familyIdOf(leagueId);
  if (!fid) {
    const gone = await removalOf([leagueId]);
    if (gone) return { status: "removed", ...gone };
    if (ip !== null) {
      const ok = await take("new_league", ip);
      if (!ok.ok) return { status: "limited", minutes: ok.minutes };
    }
    const family = await discoverFamily(leagueId);
    if (!family) return { status: "not_found" };
    // A renewed season of a league that opted out stays out.
    const goneFamily = await removalOf(family.seasons.map((s) => s.league.league_id));
    if (goneFamily) return { status: "removed", ...goneFamily };
    await saveFamily(family);
    await snapshotFamily(family).catch(() => {});
    return { status: "ok", family, isNew: true };
  }
  const gone = await removalOf([leagueId], fid);
  if (gone) return { status: "removed", ...gone };
  const family = (await readFamily(fid))!;
  const stale = family.seasons.filter((s) => live(s) && Date.now() - Date.parse(s.fetchedAt) > STALE_MS);
  if (stale.length) {
    const fresh = await Promise.all(stale.map((s) => refreshSeason(s.league.league_id).catch(() => null)));
    const byId = new Map(fresh.filter(Boolean).map((b) => [b!.league.league_id, b!]));
    if (byId.size) {
      family.seasons = family.seasons.map((s) => byId.get(s.league.league_id) ?? s);
      await saveFamily(family, "soon");
    }
  }
  return { status: "ok", family, isNew: false };
}

/**
 * A league asks to be removed. Its pages disappear and tracking stops right away; the stored data
 * is deleted after a seven-day grace period (in case of a mistake), and its ids are kept so it
 * isn't imported again.
 */
export async function removeFamily(familyId: string): Promise<Date> {
  const sql = await db();
  const ids = (await sql<{ league_id: string }[]>`select league_id from leagues where family_id = ${familyId}`).map((r) => r.league_id);
  const purge = new Date(Date.now() + 7 * 86_400_000);
  await sql.begin(async (tx) => {
    for (const id of ids)
      await tx`
        insert into removals (league_id, family_id, purge_after) values (${id}, ${familyId}, ${purge})
        on conflict (league_id) do update set requested_at = now(), purge_after = excluded.purge_after, purged = false`;
    await tx`update jobs set status = 'done', state = ${tx.json({ phase: "done" })} where family_id = ${familyId} and status in ('queued','running')`;
  });
  invalidateFamily(familyId, "now"); // hidden at once
  return purge;
}

/** Undo a removal during the grace period. */
export async function restoreFamily(familyId: string): Promise<boolean> {
  const sql = await db();
  const rows = await sql`delete from removals where family_id = ${familyId} and not purged returning league_id`;
  invalidateFamily(familyId, "now");
  return rows.length > 0;
}

/** Nightly: delete removed leagues past their grace period, and old rate-limit and budget rows. */
export async function housekeeping() {
  const sql = await db();
  const due = await sql<{ family_id: string }[]>`
    select distinct family_id from removals where not purged and purge_after < now()`;
  for (const { family_id } of due) {
    await sql`delete from families where id = ${family_id}`; // cascades to seasons, weeks, snapshots, jobs
    await sql`update removals set purged = true where family_id = ${family_id}`;
  }
  await sql`delete from rate_events where at < now() - interval '2 days'`;
  await sql`delete from removal_challenges where created_at < now() - interval '1 day'`;
  // Kept a year: the all-time daily-game standings read them.
  await sql`delete from game_scores where day < now() - interval '400 days'`;
  await sql`delete from api_budget where window_start < now() - interval '1 day'`;
  return { purged: due.length };
}

/** The family's newest season: where a manager proves who they are (their current team name). */
export async function newestSeason(
  familyId: string,
): Promise<{ leagueId: string; name: string; season: string; users: Set<string>; names: Map<string, string>; teams: Map<string, string> } | null> {
  const f = await readFamily(familyId);
  const s = f?.seasons[f.seasons.length - 1];
  return s
    ? {
        leagueId: s.league.league_id,
        name: s.league.name,
        season: s.league.season,
        users: new Set(s.users.map((u) => u.user_id)),
        // Sleeper user id -> username (display name), to match an account's saved Sleeper username.
        names: new Map(s.users.map((u) => [u.user_id, u.display_name])),
        // Sleeper user id -> this season's team name (public on Sleeper), when they set one.
        teams: new Map(s.users.flatMap((u) => (u.metadata?.team_name ? [[u.user_id, String(u.metadata.team_name)] as [string, string]] : []))),
      }
    : null;
}

/** Nightly: refresh in-progress seasons and look for a renewed season. */
export async function refreshFamily(familyId: string): Promise<Family | null> {
  const family = await readFamily(familyId);
  if (!family) return null;
  const seasons = await Promise.all(
    family.seasons.map(async (s) => (live(s) ? ((await refreshSeason(s.league.league_id).catch(() => null)) ?? s) : s)),
  );
  const newest = seasons[seasons.length - 1];
  const forward = await walkForward(
    newest.league,
    newest.users.map((u) => u.user_id),
  ).catch(() => []);
  for (const l of forward) {
    const b = await refreshSeason(l.league_id).catch(() => null);
    if (b) seasons.push(b);
  }
  const next = { id: familyId, seasons };
  await saveFamily(next, "soon");
  return next;
}

/** Save today's official totals for every in-progress season of the family. Idempotent per day. */
export async function snapshotFamily(f: Family): Promise<number> {
  const sql = await db();
  const day = todayET();
  let n = 0;
  for (const s of f.seasons) {
    if (s.league.status !== "in_season" && s.league.status !== "post_season") continue;
    for (const r of s.rosters) {
      const o = official(r.settings ?? {});
      const rec = r.metadata?.record ?? "";
      await sql`
        insert into pf_snapshots (league_id, roster_id, taken_on, owner_id, pf, pa, ppts, wins, losses, ties, record, weeks_done)
        values (${s.league.league_id}, ${r.roster_id}, ${day}, ${r.owner_id ?? null}, ${o.pf}, ${o.pa}, ${o.ppts},
                ${r.settings?.wins ?? 0}, ${r.settings?.losses ?? 0}, ${r.settings?.ties ?? 0}, ${rec}, ${rec.length})
        on conflict (league_id, roster_id, taken_on) do update set owner_id = excluded.owner_id, pf = excluded.pf,
          pa = excluded.pa, ppts = excluded.ppts, wins = excluded.wins, losses = excluded.losses, ties = excluded.ties,
          record = excluded.record, weeks_done = excluded.weeks_done, taken_at = now()`;
      n += 1;
    }
  }
  return n;
}

export type Snapshot = { rosterId: number; ownerId: string | null; day: string; pf: number; pa?: number | null; weeksDone: number };

export async function snapshots(leagueId: string): Promise<Snapshot[]> {
  if (!hasDb()) return [];
  const sql = await db();
  const rows = await sql<{ roster_id: number; owner_id: string | null; taken_on: Date | string; pf: string; pa: string | null; weeks_done: number }[]>`
    select roster_id, owner_id, taken_on, pf, pa, weeks_done from pf_snapshots where league_id = ${leagueId}
    order by taken_on, roster_id`;
  return rows.map((r) => ({
    rosterId: r.roster_id,
    ownerId: r.owner_id,
    day: typeof r.taken_on === "string" ? r.taken_on : r.taken_on.toISOString().slice(0, 10),
    pf: Number(r.pf),
    pa: r.pa === null ? null : Number(r.pa),
    weeksDone: r.weeks_done,
  }));
}

export async function analysisOf(familyId: string): Promise<Analysis | null> {
  if (!hasDb()) return null;
  const sql = await db();
  const [row] = await sql<{ data: Analysis }[]>`select data from analyses where family_id = ${familyId} and kind = 'v1'`;
  return row?.data ?? null;
}

/** The league's dataset (Trash-shaped league + extras), built by the import's grading step. */
export async function datasetOf(familyId: string): Promise<Dataset | null> {
  if (!hasDb()) return null;
  const sql = await db();
  const [row] = await sql<{ data: Dataset }[]>`select data from analyses where family_id = ${familyId} and kind = 'dataset'`;
  return row?.data ?? null;
}

export async function packOf(familyId: string): Promise<string | null> {
  if (!hasDb()) return null;
  const sql = await db();
  const [row] = await sql<{ custom_pack: string | null }[]>`select custom_pack from families where id = ${familyId}`;
  return row?.custom_pack ?? null;
}

/** Families still tracked (not removed). */
export async function allFamilies(): Promise<string[]> {
  const sql = await db();
  return (
    await sql<{ id: string }[]>`
      select id from families f where not exists (select 1 from removals r where r.family_id = f.id)
      order by created_at`
  ).map((r) => r.id);
}
