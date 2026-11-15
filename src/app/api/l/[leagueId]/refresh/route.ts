import { after } from "next/server";
import { ANALYSIS_VERSION } from "@/lib/app/analysis";
import { hasDb } from "@/lib/app/db";
import { enqueueImport, kick, runJobs } from "@/lib/app/jobs";
import { logError } from "@/lib/app/safe";
import { refreshStale, storedLeague } from "@/lib/app/store";
import { isSleeperId } from "@/lib/app/validate";

export const maxDuration = 60;

/**
 * League pages are served pre-built, so they can't refresh themselves. A visit pings this after
 * the page loads: in-progress seasons older than ten minutes are re-read from Sleeper, and results
 * from an older grading are regraded. Both run after the response; the page cache is dropped when
 * new data lands. Cheap when nothing is stale (one cached read).
 */
export async function POST(_req: Request, ctx: RouteContext<"/api/l/[leagueId]/refresh">) {
  const { leagueId } = await ctx.params;
  if (!isSleeperId(leagueId) || !hasDb()) return new Response(null, { status: 204 });
  try {
    const s = await storedLeague(leagueId);
    if (s && !s.removed) {
      const fam = s.family;
      after(() => refreshStale(fam).catch((e) => logError(`refresh ${fam.id}`, e)));
      const open = !!s.job && (s.job.status === "queued" || s.job.status === "running");
      if (s.analysis && (s.analysis.version ?? 1) < ANALYSIS_VERSION && !open)
        after(async () => {
          await enqueueImport(fam.id);
          const r = await runJobs(50_000);
          if (r.more) await kick();
        });
    }
  } catch (e) {
    logError(`refresh ${leagueId}`, e);
  }
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
