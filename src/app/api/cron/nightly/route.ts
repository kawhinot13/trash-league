import { authorized } from "@/lib/app/auth";
import { hasDb } from "@/lib/app/db";
import { enqueueImport, kick, runJobs } from "@/lib/app/jobs";
import { allFamilies, getFamily, refreshFamily, snapshotFamily } from "@/lib/app/store";
import { ALWAYS_TRACKED } from "@/packs/ids";

export const maxDuration = 300;

/**
 * Every night (vercel.json): for every league family, refresh in-progress seasons, look for a
 * renewed season, save Sleeper's official points-for totals, and queue the incremental import
 * (newly finished weeks, regraded trades). Then work the queue with what time is left.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return new Response("unauthorized", { status: 401 });
  if (!hasDb()) return Response.json({ ok: false, reason: "no database" }, { status: 503 });
  const started = Date.now();
  for (const id of ALWAYS_TRACKED) await getFamily(id).catch(() => null);
  const ids = await allFamilies();
  const report: Record<string, { snapshots: number; seasons: number } | { error: string }> = {};
  // A few families at a time; each is a handful of Sleeper requests.
  for (let i = 0; i < ids.length; i += 4)
    await Promise.all(
      ids.slice(i, i + 4).map(async (id) => {
        try {
          const f = await refreshFamily(id);
          if (!f) return;
          report[id] = { snapshots: await snapshotFamily(f), seasons: f.seasons.length };
          await enqueueImport(id);
        } catch (e) {
          report[id] = { error: e instanceof Error ? e.message : String(e) };
        }
      }),
    );
  const left = 280_000 - (Date.now() - started);
  const r = left > 20_000 ? await runJobs(left - 10_000) : { ran: 0, more: true };
  if (r.more) await kick(new URL(req.url).origin);
  return Response.json({ ok: true, families: ids.length, report, jobs: r });
}
