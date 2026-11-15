import { after } from "next/server";
import { hasDb } from "@/lib/app/db";
import { kick, latestJob, progress, runJobs } from "@/lib/app/jobs";
import { logError } from "@/lib/app/safe";
import { familyIdOf } from "@/lib/app/store";
import { isSleeperId } from "@/lib/app/validate";

export const maxDuration = 60;

/** Import progress. Polling also nudges the worker when a job is waiting and nobody holds it. */
export async function GET(_req: Request, ctx: RouteContext<"/api/l/[leagueId]/status">) {
  const { leagueId } = await ctx.params;
  if (!isSleeperId(leagueId)) return Response.json({ error: "bad id" }, { status: 400 });
  if (!hasDb()) return Response.json({ progress: null, db: false });
  try {
    const fid = await familyIdOf(leagueId);
    const job = fid ? await latestJob(fid) : null;
    const idle =
      job && (job.status === "queued" || (job.status === "running" && (!job.locked_until || job.locked_until < new Date())));
    if (idle)
      after(async () => {
        const r = await runJobs(50_000);
        if (r.more) await kick();
      });
    return Response.json({ progress: progress(job), db: true }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    logError(`status ${leagueId}`, e);
    return Response.json({ progress: null, db: true }, { status: 500 });
  }
}
