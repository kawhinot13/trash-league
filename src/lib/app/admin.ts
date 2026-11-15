import "server-only";
import { db } from "@/lib/app/db";

/**
 * The owner's view of Rafterlore: totals and league-level facts only. Never lists people: accounts
 * are counted, not shown, and nothing here reads IP hashes.
 */
export async function adminStats() {
  const sql = await db();
  const [totals] = await sql<
    {
      leagues: number;
      seasons: number;
      accounts: number;
      active7: number;
      new7: number;
      plays7: number;
      calls24: number;
      queued: number;
      running: number;
      failed7: number;
      removed: number;
    }[]
  >`
    select
      (select count(*)::int from families) as leagues,
      (select count(*)::int from leagues) as seasons,
      (select count(*)::int from accounts) as accounts,
      (select count(*)::int from accounts where seen_at > now() - interval '7 days') as active7,
      (select count(*)::int from accounts where created_at > now() - interval '7 days') as new7,
      (select count(*)::int from game_scores where created_at > now() - interval '7 days') as plays7,
      (select coalesce(sum(used), 0)::int from api_budget where window_start > now() - interval '24 hours') as calls24,
      (select count(*)::int from jobs where status = 'queued') as queued,
      (select count(*)::int from jobs where status = 'running') as running,
      (select count(*)::int from jobs where status = 'failed' and updated_at > now() - interval '7 days') as failed7,
      (select count(distinct family_id)::int from removals where not purged) as removed`;
  const leagues = await sql<{ id: string; name: string; sport: string; seasons: number; created_at: Date; refreshed_at: Date; pack: string | null; removed: boolean }[]>`
    select f.id, f.name, f.created_at, f.refreshed_at, f.custom_pack as pack,
      count(l.*)::int as seasons,
      coalesce(max(l.bundle->'league'->>'sport'), 'nba') as sport,
      exists (select 1 from removals r where r.family_id = f.id and not r.purged) as removed
    from families f left join leagues l on l.family_id = f.id
    group by f.id order by f.created_at desc limit 200`;
  const plays = await sql<{ game: string; n: number }[]>`
    select game, count(*)::int as n from game_scores where created_at > now() - interval '7 days' group by game order by n desc`;
  const failures = await sql<{ name: string; error: string | null; updated_at: Date }[]>`
    select f.name, j.error, j.updated_at from jobs j join families f on f.id = j.family_id
    where j.status = 'failed' order by j.updated_at desc limit 10`;
  const crons = await sql<{ started_at: Date; finished_at: Date | null; leagues: number; snapshots: number; failed: number }[]>`
    select started_at, finished_at, leagues, snapshots, failed from cron_runs order by started_at desc limit 7`;
  return { totals, leagues, plays, failures, crons };
}
