import { after } from "next/server";
import { hasDb } from "@/lib/app/db";
import { enqueueImport, kick, progress, runJobs } from "@/lib/app/jobs";
import { clientIp } from "@/lib/app/ratelimit";
import { logError } from "@/lib/app/safe";
import { getFamily } from "@/lib/app/store";
import { isSleeperId } from "@/lib/app/validate";

export const maxDuration = 60;

/** Find every season of the league, save it, and queue the heavy import (lineup replay, trade grades). */
export async function POST(_req: Request, ctx: RouteContext<"/api/l/[leagueId]/import">) {
  const { leagueId } = await ctx.params;
  if (!isSleeperId(leagueId)) return Response.json({ error: "That isn't a Sleeper league id." }, { status: 400 });
  try {
    const got = await getFamily(leagueId, await clientIp());
    if (got.status === "not_found") return Response.json({ error: "That isn't a Sleeper basketball or football league." }, { status: 404 });
    if (got.status === "removed") return Response.json({ error: "This league asked to be removed from Rafterlore." }, { status: 410 });
    if (got.status === "limited")
      return Response.json({ error: `Too many new leagues from your network. Try again in ${got.minutes} minutes.` }, { status: 429 });
    if (!hasDb()) return Response.json({ progress: null, db: false });
    const job = await enqueueImport(got.family.id);
    after(async () => {
      const r = await runJobs(50_000);
      if (r.more) await kick();
    });
    return Response.json({ progress: progress(job), db: true });
  } catch (e) {
    logError(`import ${leagueId}`, e);
    return Response.json({ error: "Couldn't start the import. Try again in a moment." }, { status: 500 });
  }
}
