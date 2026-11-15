import "server-only";
import { cacheLife } from "next/cache";
import { db, hasDb, todayET } from "@/lib/app/db";
import { discoverFamily, refreshSeason, walkForward, type Family, type SeasonBundle } from "@/lib/app/family";
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

/**
 * The family `leagueId` belongs to. With a database: read it, refreshing an in-progress season
 * that's more than a few minutes old; first sight discovers every season, saves it, and takes
 * day one's points-for snapshot. Without one: straight from Sleeper.
 */
export async function getFamily(leagueId: string): Promise<{ family: Family; isNew: boolean } | null> {
  if (!hasDb()) {
    const family = await discoverCached(leagueId);
    return family ? { family, isNew: false } : null;
  }
  const fid = await familyIdOf(leagueId);
  if (!fid) {
    const family = await discoverFamily(leagueId);
    if (!family) return null;
    await saveFamily(family);
    await snapshotFamily(family).catch(() => {});
    return { family, isNew: true };
  }
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
  return { family, isNew: false };
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

export async function allFamilies(): Promise<string[]> {
  const sql = await db();
  return (await sql<{ id: string }[]>`select id from families order by created_at`).map((r) => r.id);
}
