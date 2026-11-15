import { authorized } from "@/lib/app/auth";
import { hasDb } from "@/lib/app/db";
import { enqueueImport, kick, runJobs } from "@/lib/app/jobs";
import { logError, safeMessage } from "@/lib/app/safe";
import { pruneCache } from "@/lib/app/sleeper-cache";
import { allFamilies, getFamily, housekeeping, refreshFamily, snapshotFamily } from "@/lib/app/store";
import { ALWAYS_TRACKED } from "@/packs/ids";

export const maxDuration = 300;

/**
 * Every night (vercel.json): for every league still on Rafterlore, refresh in-progress seasons, look
 * for a renewed season, save Sleeper's official points-for totals, and queue the incremental
 * import. Delete leagues whose removal grace period is over. Then work the queue with the time left.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return new Response("unauthorized", { status: 401 });
  if (!hasDb()) return Response.json({ ok: false, reason: "no database" }, { status: 503 });
  const started = Date.now();
  const house = await housekeeping().catch((e) => ({ error: safeMessage(e) }));
  await pruneCache().catch(() => {});
  for (const id of ALWAYS_TRACKED) await getFamily(id, null).catch(() => null);
  const ids = await allFamilies();
  let snaps = 0;
  const failed: string[] = [];
  // A few leagues at a time; each is a handful of Sleeper calls (all through the shared throttle).
  for (let i = 0; i < ids.length; i += 4)
    await Promise.all(
      ids.slice(i, i + 4).map(async (id) => {
        try {
          const f = await refreshFamily(id);
          if (!f) return;
          snaps += await snapshotFamily(f);
          await enqueueImport(id);
        } catch (e) {
          failed.push(id);
          logError(`nightly ${id}`, e);
        }
      }),
    );
  const left = 280_000 - (Date.now() - started);
  const r = left > 20_000 ? await runJobs(left - 10_000) : { ran: 0, more: true };
  if (r.more) await kick();
  return Response.json({ ok: true, leagues: ids.length, snapshots: snaps, failed: failed.length, housekeeping: house, jobs: r });
}
