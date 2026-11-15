import "server-only";
import { db, hasDb } from "@/lib/app/db";
import type { SeasonBundle } from "@/lib/app/family";
import { analyse, seasonWeeks } from "@/lib/app/analysis";
import { buildDataset } from "@/lib/app/dataset";
import { invalidateFamily } from "@/lib/app/store";
import { REPLAY_VERSION, replayWeek, type WeekData } from "@/lib/app/replay";
import { consensusMatchups, nbaState, sleeper, type STransaction } from "@/lib/app/sleeper";
import { playerDirectory, weekStats, type PlayerDir } from "@/lib/app/sleeper-cache";
import { safeMessage } from "@/lib/app/safe";

/**
 * Background jobs in Postgres: no extra service. A job is a list of small steps with its progress
 * in `state`, so it survives timeouts and restarts: each run claims a job (FOR UPDATE SKIP LOCKED
 * with a lease), works until its time budget runs out, saves progress and lets go.
 *
 * Runs are started by: the import request (after the response), the league page's progress poll,
 * the nightly cron, and the runner itself, which pings /api/jobs/tick to keep going while work is left.
 *
 * kind "import": replay every league-week not yet stored (box scores + transactions + matchups),
 * then grade (lineup efficiency, trade grades, pickups) into `analyses`.
 */
type ImportState = {
  phase: "plan" | "weeks" | "grade" | "done";
  items?: [string, number, boolean][]; // league id, week, final
  i?: number;
  total?: number;
};
export type JobRow = {
  id: number;
  kind: string;
  family_id: string;
  status: string;
  state: ImportState;
  attempts: number;
  error: string | null;
  updated_at: Date;
  locked_until: Date | null;
};

const LEASE_S = 90;
const MAX_ATTEMPTS = 5;

/** Queue an import for the family unless one is already open. Returns the open job. */
export async function enqueueImport(familyId: string): Promise<JobRow> {
  const sql = await db();
  await sql`
    insert into jobs (kind, family_id, state) values ('import', ${familyId}, ${sql.json({ phase: "plan" })})
    on conflict (kind, family_id) where status in ('queued', 'running') do nothing`;
  return (await latestJob(familyId))!;
}

export async function latestJob(familyId: string): Promise<JobRow | null> {
  if (!hasDb()) return null;
  const sql = await db();
  const [row] = await sql<JobRow[]>`
    select * from jobs where family_id = ${familyId} and kind = 'import' order by id desc limit 1`;
  return row ?? null;
}

/** At most this many imports run at once across every instance; the rest wait their turn. */
const MAX_RUNNING = Math.max(1, Number(process.env.MAX_IMPORT_JOBS) || 2);

async function claim(): Promise<JobRow | null> {
  const sql = await db();
  // One claim at a time (advisory lock), so the running count can't be overshot by a race.
  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(727275)`;
    const [{ n }] = await tx<{ n: number }[]>`
      select count(*)::int as n from jobs where status = 'running' and locked_until > now()`;
    if (n >= MAX_RUNNING) return null;
    const [row] = await tx<JobRow[]>`
    update jobs set status = 'running', locked_until = now() + ${`${LEASE_S} seconds`}::interval,
      attempts = attempts + 1, updated_at = now()
    where id = (
      select id from jobs
      where (status = 'queued' and run_after <= now()) or (status = 'running' and locked_until < now())
      order by id for update skip locked limit 1)
    returning *`;
    return row ?? null;
  });
}

async function save(job: JobRow, patch: { status?: string; state?: ImportState; error?: string | null }) {
  const sql = await db();
  await sql`
    update jobs set status = ${patch.status ?? job.status}, state = ${sql.json((patch.state ?? job.state) as never)},
      error = ${patch.error === undefined ? job.error : patch.error}, updated_at = now(),
      locked_until = ${patch.status === "running" ? sql`now() + ${`${LEASE_S} seconds`}::interval` : null},
      attempts = ${patch.status === "queued" ? 0 : job.attempts}
    where id = ${job.id}`;
}

async function bundles(familyId: string): Promise<SeasonBundle[]> {
  const sql = await db();
  const rows = await sql<{ bundle: SeasonBundle }[]>`
    select bundle from leagues where family_id = ${familyId} order by season, league_id`;
  return rows.map((r) => r.bundle);
}

async function plan(familyId: string): Promise<[string, number, boolean][]> {
  const sql = await db();
  const state = await nbaState();
  const have = new Set(
    (
      await sql<{ league_id: string; week: number }[]>`
        select w.league_id, w.week from league_weeks w join leagues l using (league_id)
        where l.family_id = ${familyId} and w.final and coalesce((w.data->>'v')::int, 1) >= ${REPLAY_VERSION}`
    ).map((r) => `${r.league_id}|${r.week}`),
  );
  const items: [string, number, boolean][] = [];
  for (const b of await bundles(familyId)) {
    const { weeks, finalUpTo } = seasonWeeks(b.league, state.league_season || state.season, state.week);
    for (const w of weeks)
      if (!have.has(`${b.league.league_id}|${w}`)) items.push([b.league.league_id, w, w <= finalUpTo]);
  }
  return items;
}

async function replayOne(b: SeasonBundle, week: number, final: boolean) {
  const lid = b.league.league_id;
  const [mus, txs, stats] = await Promise.all([
    consensusMatchups(lid, week, b.league.status === "complete" ? 3 : 10),
    sleeper<STransaction[] | null>(`/v1/league/${lid}/transactions/${week}`).then((x) => x ?? []),
    weekStats(b.league.season, week, final),
  ]);
  const data = replayWeek(b.league, week, mus, txs, stats);
  const sql = await db();
  await sql`
    insert into league_weeks (league_id, week, data, final) values (${lid}, ${week}, ${sql.json(data as never)}, ${final})
    on conflict (league_id, week) do update set data = excluded.data, final = excluded.final, updated_at = now()`;
}

/** Exact weekly scores from the nightly snapshots: the official total after k finished weeks
 * minus the total after k-1 (zero before week one). */
async function exactWeeks(bs: SeasonBundle[]): Promise<Map<string, number>> {
  const sql = await db();
  const ids = bs.map((b) => b.league.league_id);
  const rows = await sql<{ league_id: string; roster_id: number; weeks_done: number; pf: string }[]>`
    select distinct on (league_id, roster_id, weeks_done) league_id, roster_id, weeks_done, pf
    from pf_snapshots where league_id in ${sql(ids)} order by league_id, roster_id, weeks_done, taken_on desc`;
  const at = new Map(rows.map((r) => [`${r.league_id}|${r.roster_id}|${r.weeks_done}`, Number(r.pf)]));
  const out = new Map<string, number>();
  for (const b of bs) {
    const start = Math.max(1, b.league.settings?.start_week || 1);
    for (const r of rows.filter((x) => x.league_id === b.league.league_id && x.weeks_done > 0)) {
      const before = r.weeks_done === 1 ? 0 : at.get(`${r.league_id}|${r.roster_id}|${r.weeks_done - 1}`);
      if (before !== undefined)
        out.set(`${r.league_id}|${r.roster_id}|${start + r.weeks_done - 1}`, Math.round((Number(r.pf) - before) * 10) / 10);
    }
  }
  return out;
}

async function grade(familyId: string) {
  const sql = await db();
  const state = await nbaState();
  const bs = await bundles(familyId);
  const rows = await sql<{ league_id: string; data: WeekData }[]>`
    select w.league_id, w.data from league_weeks w join leagues l using (league_id)
    where l.family_id = ${familyId} order by w.week`;
  const cur = state.league_season || state.season;
  const inputs = await Promise.all(
    bs.map(async (b) => {
      const sw = seasonWeeks(b.league, cur, state.week);
      // The week in progress: only its trades count (a trade is final when made; lineups aren't).
      const live = b.league.status === "in_season" && b.league.season === cur && state.week > (sw.weeks.at(-1) ?? 0);
      const txs = live
        ? await sleeper<STransaction[] | null>(`/v1/league/${b.league.league_id}/transactions/${state.week}`).then((x) => x ?? []).catch(() => [])
        : [];
      return {
        bundle: b,
        weeks: rows.filter((r) => r.league_id === b.league.league_id).map((r) => r.data),
        regEnd: sw.regEnd,
        current: txs.length ? replayWeek(b.league, state.week, [], txs, []) : undefined,
      };
    }),
  );
  const exact = await exactWeeks(bs);
  const a = analyse(inputs, exact);
  const dir = await playerDirectory().catch(() => ({}) as PlayerDir);
  // Names for traded players who never logged a game in a replayed week.
  for (const p of new Set(a.trades.flatMap((t) => t.sides.flatMap((s) => s.got))))
    if (!p.startsWith("pick:") && !a.players[p]) a.players[p] = dir[p] ? [dir[p][0], dir[p][1]] : ["Unknown player", []];
  // The full dataset (Trash's league.json + extras.json shapes) that the league's pages are built from.
  const ds = buildDataset(bs[bs.length - 1]?.league.name ?? "League", inputs, a, exact, dir);
  await sql.begin(async (tx) => {
    await tx`
      insert into analyses (family_id, kind, data) values (${familyId}, 'v1', ${tx.json(a as never)})
      on conflict (family_id, kind) do update set data = excluded.data, computed_at = now()`;
    await tx`
      insert into analyses (family_id, kind, data) values (${familyId}, 'dataset', ${tx.json(ds as never)})
      on conflict (family_id, kind) do update set data = excluded.data, computed_at = now()`;
  });
  invalidateFamily(familyId);
}

/** Work one job until `deadline`. Returns true when the job has more to do. */
async function step(job: JobRow, deadline: number): Promise<boolean> {
  let st = job.state;
  if (st.phase === "plan") {
    const items = await plan(job.family_id);
    st = { phase: items.length ? "weeks" : "grade", items, i: 0, total: items.length };
    await save(job, { status: "running", state: st });
  }
  if (st.phase === "weeks") {
    const bs = new Map((await bundles(job.family_id)).map((b) => [b.league.league_id, b]));
    const items = st.items ?? [];
    let i = st.i ?? 0;
    // A few weeks at a time, saving progress after each batch.
    while (i < items.length && Date.now() < deadline) {
      const batch = items.slice(i, i + 3);
      await Promise.all(batch.map(([lid, w, final]) => (bs.has(lid) ? replayOne(bs.get(lid)!, w, final) : null)));
      i += batch.length;
      st = { ...st, i };
      await save(job, { status: "running", state: st });
    }
    if (i < items.length) return true;
    st = { phase: "grade", total: st.total, i };
    await save(job, { status: "running", state: st });
    if (Date.now() > deadline - 5_000) return true;
  }
  if (st.phase === "grade") {
    await grade(job.family_id);
    st = { phase: "done", total: st.total, i: st.total };
  }
  await save(job, { status: "done", state: st, error: null });
  return false;
}

/** Run queued jobs for up to `budgetMs`. Returns whether work remains. */
export async function runJobs(budgetMs = 45_000): Promise<{ ran: number; more: boolean }> {
  if (!hasDb()) return { ran: 0, more: false };
  const deadline = Date.now() + budgetMs;
  let ran = 0;
  let more = false;
  while (Date.now() < deadline - 3_000) {
    const job = await claim();
    if (!job) break;
    ran += 1;
    try {
      if (job.attempts > MAX_ATTEMPTS) {
        await save(job, { status: "failed" });
        continue;
      }
      if (await step(job, deadline)) {
        await save(job, { status: "queued" });
        more = true;
        break;
      }
    } catch (e) {
      const msg = safeMessage(e);
      console.error(`[jobs] job ${job.id} failed: ${msg}`);
      // Back off and retry; the lease expiring would also release it.
      const sql = await db();
      await sql`
        update jobs set status = ${job.attempts >= MAX_ATTEMPTS ? "failed" : "queued"}, error = ${msg.slice(0, 500)},
          run_after = now() + ${`${15 * job.attempts} seconds`}::interval, locked_until = null, updated_at = now()
        where id = ${job.id}`;
    }
  }
  if (!more) {
    const sql = await db();
    const [r] = await sql<{ n: number }[]>`select count(*)::int as n from jobs where status = 'queued' and run_after <= now()`;
    more = (r?.n ?? 0) > 0;
  }
  return { ran, more };
}

/**
 * Where to send the job-runner ping. Never taken from the request: the secret goes along, so it
 * only ever goes to this deployment's own production domain (or localhost in development).
 */
function selfOrigin(): string | null {
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (process.env.VERCEL_ENV === "production" && prod) return `https://${prod}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NODE_ENV !== "production") return `http://localhost:${process.env.PORT || 3000}`;
  return null;
}

/** Ask the deployment to run another round of jobs in a fresh invocation (fire and forget). */
export async function kick() {
  const origin = selfOrigin();
  if (!origin) return;
  const secret = process.env.CRON_SECRET || process.env.JOBS_SECRET;
  await fetch(`${origin}/api/jobs/tick`, {
    method: "POST",
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
    signal: AbortSignal.timeout(2_500),
  }).catch(() => {});
}

export function progress(job: JobRow | null) {
  if (!job) return null;
  const total = job.state.total ?? 0;
  const done = job.state.i ?? 0;
  return {
    status: job.status as "queued" | "running" | "done" | "failed",
    phase: job.state.phase,
    done,
    total,
    pct: job.status === "done" ? 1 : total ? Math.min(0.97, done / total) : 0.02,
    error: job.status === "failed" ? "Sleeper didn't answer" : null,
  };
}
export type Progress = NonNullable<ReturnType<typeof progress>>;
