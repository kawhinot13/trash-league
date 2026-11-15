import { after } from "next/server";
import { ANALYSIS_VERSION } from "@/lib/app/analysis";
import { hasDb } from "@/lib/app/db";
import { enqueueImport, kick, runJobs } from "@/lib/app/jobs";
import { logError } from "@/lib/app/safe";
import { refreshStale, storedLeague } from "@/lib/app/store";
import { isSleeperId } from "@/lib/app/validate";

export const maxDuration = 60;
const CATCH_UP_MS = 30 * 60_000;

/**
 * League pages are served pre-built, so they can't refresh themselves. A visit pings this after
 * the page loads: in-progress seasons older than ten minutes are re-read from Sleeper; in season the
 * league's trades, lineups and records are caught up every half hour; older gradings are regraded. Both run after the response; the page cache is dropped when
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
      const old = !!s.analysis && (s.analysis.version ?? 1) < ANALYSIS_VERSION;
      // In season, catch up trades, lineups and records every half hour (only unfinished weeks are re-read).
      const inSeason = fam.seasons.some((b) => b.league.status === "in_season");
      const behind = inSeason && !!s.analysis && Date.now() - Date.parse(s.analysis.computedAt) > CATCH_UP_MS;
      // Queue a catch-up when needed; either way, work any job left waiting (a queued job whose worker
      // stopped would otherwise sit until the nightly run). Claims are leased, so this never doubles up.
      if ((old || behind) || open)
        after(async () => {
          if (!open) await enqueueImport(fam.id);
          const r = await runJobs(50_000);
          if (r.more) await kick();
        });
    }
  } catch (e) {
    logError(`refresh ${leagueId}`, e);
  }
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
