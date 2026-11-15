import "server-only";
import { cacheLife } from "next/cache";
import { db, hasDb, todayET } from "@/lib/app/db";
import { discoverFamily, refreshSeason, sanitizeBundle, walkForward, type Family, type SeasonBundle } from "@/lib/app/family";
import { take } from "@/lib/app/ratelimit";
import { isSleeperId } from "@/lib/app/validate";
import { official } from "@/lib/app/sleeper";
import type { Analysis } from "@/lib/app/analysis";
import { packIdFor } from "@/packs/ids";

const STALE_MS = 10 * 60_000;

/** Without a database, keep discovery results for a few minutes (it's a dozen Sleeper calls). */
async function discoverCached(leagueId: string): Promise<Family | null> {
  "use cache";
  cacheLife("minutes");
  return discoverFamily(leagueId);
}
const live = (b: SeasonBundle) => b.league.status !== "complete";

export async function saveFamily(f: Family): Promise<void> {
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
      await saveFamily(family);
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
  return purge;
}

/** Undo a removal during the grace period. */
export async function restoreFamily(familyId: string): Promise<boolean> {
  const sql = await db();
  const rows = await sql`delete from removals where family_id = ${familyId} and not purged returning league_id`;
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
  await sql`delete from api_budget where window_start < now() - interval '1 day'`;
  return { purged: due.length };
}

/** The family's newest season: where a manager proves who they are (their current team name). */
export async function newestSeason(familyId: string): Promise<{ leagueId: string; name: string; season: string; users: Set<string> } | null> {
  const f = await readFamily(familyId);
  const s = f?.seasons[f.seasons.length - 1];
  return s ? { leagueId: s.league.league_id, name: s.league.name, season: s.league.season, users: new Set(s.users.map((u) => u.user_id)) } : null;
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
  await saveFamily(next);
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

export type Snapshot = { rosterId: number; ownerId: string | null; day: string; pf: number; weeksDone: number };

export async function snapshots(leagueId: string): Promise<Snapshot[]> {
  if (!hasDb()) return [];
  const sql = await db();
  const rows = await sql<{ roster_id: number; owner_id: string | null; taken_on: Date | string; pf: string; weeks_done: number }[]>`
    select roster_id, owner_id, taken_on, pf, weeks_done from pf_snapshots where league_id = ${leagueId}
    order by taken_on, roster_id`;
  return rows.map((r) => ({
    rosterId: r.roster_id,
    ownerId: r.owner_id,
    day: typeof r.taken_on === "string" ? r.taken_on : r.taken_on.toISOString().slice(0, 10),
    pf: Number(r.pf),
    weeksDone: r.weeks_done,
  }));
}

export async function analysisOf(familyId: string): Promise<Analysis | null> {
  if (!hasDb()) return null;
  const sql = await db();
  const [row] = await sql<{ data: Analysis }[]>`select data from analyses where family_id = ${familyId} and kind = 'v1'`;
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
