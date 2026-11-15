import { after } from "next/server";
import { hasDb } from "@/lib/app/db";
import { kick, latestJob, progress, runJobs } from "@/lib/app/jobs";
import { familyIdOf } from "@/lib/app/store";

export const maxDuration = 60;

/** Import progress. Polling also nudges the worker when a job is waiting and nobody holds it. */
export async function GET(req: Request, ctx: RouteContext<"/api/l/[leagueId]/status">) {
  const { leagueId } = await ctx.params;
  if (!hasDb()) return Response.json({ progress: null, db: false });
  const fid = await familyIdOf(leagueId);
  const job = fid ? await latestJob(fid) : null;
  const idle =
    job && (job.status === "queued" || (job.status === "running" && (!job.locked_until || job.locked_until < new Date())));
  if (idle) {
    const origin = new URL(req.url).origin;
    after(async () => {
      const r = await runJobs(50_000);
      if (r.more) await kick(origin);
    });
  }
  return Response.json({ progress: progress(job), db: true }, { headers: { "cache-control": "no-store" } });
}
