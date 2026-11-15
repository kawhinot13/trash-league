import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppNav } from "@/components/app/chrome";
import { db, hasDb } from "@/lib/app/db";
import { logError } from "@/lib/app/safe";

export const metadata: Metadata = { title: "Status", robots: { index: false } };

/**
 * Is Rafterlore healthy? Last night's job (points-for snapshots, refreshes, imports), the import
 * queue and the Sleeper budget. Counts only: nothing here identifies a league or a person.
 */
type Run = { started_at: Date; finished_at: Date | null; leagues: number; snapshots: number; failed: number };

/** Everything the page shows, or null when the database is unreachable. */
async function statusData() {
  try {
    const sql = await db();
    const runs = await sql<Run[]>`
      select started_at, finished_at, leagues, snapshots, failed from cron_runs order by id desc limit 7`;
    const [q] = await sql<{ queued: number; running: number; failed: number; leagues: number }[]>`
      select count(*) filter (where status = 'queued')::int as queued,
             count(*) filter (where status = 'running' and locked_until > now())::int as running,
             count(*) filter (where status = 'failed' and updated_at > now() - interval '1 day')::int as failed,
             (select count(*)::int from families) as leagues
      from jobs`;
    const [budget] = await sql<{ used: number | null }[]>`select max(used) as used from api_budget where window_start > now() - interval '1 hour'`;
    const last = runs[0];
    const fresh = !!last?.finished_at && Date.now() - last.finished_at.getTime() < 26 * 3600_000;
    return { runs, q, used: budget?.used ?? 0, last, fresh, ok: fresh && last.failed === 0 && q.failed === 0 };
  } catch (e) {
    logError("status", e);
    return null;
  }
}

const t = (d: Date) =>
  d.toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

async function Status() {
  await connection();
  if (!hasDb()) return <p className="text-[var(--muted)]">No database configured.</p>;
  const x = await statusData();
  if (!x) return <p className="text-[var(--ticket)]">The database didn&apos;t answer.</p>;
  const { runs, q, used, last, fresh, ok } = x;
  return (
    <div className="space-y-10">
      <p className="font-display text-4xl font-black md:text-6xl" style={{ color: ok ? "#7fd49a" : "var(--ticket)" }}>
        {ok ? "All good" : !last ? "The nightly job hasn't run yet" : !fresh ? "The nightly job missed a night" : "Something failed"}
      </p>
      <dl className="grid grid-cols-2 gap-6 text-sm sm:grid-cols-4">
        <Stat k="Leagues tracked" v={String(q.leagues)} />
        <Stat k="Imports waiting" v={`${q.queued} queued, ${q.running} running`} />
        <Stat k="Imports failed today" v={String(q.failed)} />
        <Stat k="Sleeper calls, busiest minute this hour" v={`${used} of 500`} />
      </dl>
      <div>
        <p className="font-semibold">Nightly runs (times in ET)</p>
        <ol className="mt-3 divide-y divide-[var(--line)] border-y border-[var(--line)] text-sm tabular-nums">
          {runs.length ? (
            runs.map((r) => (
              <li key={r.started_at.toISOString()} className="flex flex-wrap justify-between gap-2 py-3">
                <span>{t(r.started_at)}</span>
                <span className="text-[var(--muted)]">
                  {r.finished_at ? `${r.leagues} leagues, ${r.snapshots} totals saved` : "did not finish"}
                  {r.failed ? <span className="text-[var(--ticket)]">, {r.failed} failed</span> : null}
                </span>
              </li>
            ))
          ) : (
            <li className="py-3 text-[var(--muted)]">No runs recorded yet. The first one is tonight at 5:17am ET.</li>
          )}
        </ol>
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[var(--muted)]">{k}</dt>
      <dd className="mt-1 text-lg font-semibold">{v}</dd>
    </div>
  );
}

export default function StatusPage() {
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-6xl px-4 py-16 md:px-10 md:py-24">
        <h1 className="font-display text-6xl font-black md:text-8xl">Status</h1>
        <div className="mt-10">
          <Suspense fallback={<p className="text-[var(--muted)]">Checking…</p>}>
            <Status />
          </Suspense>
        </div>
      </main>
    </>
  );
}
