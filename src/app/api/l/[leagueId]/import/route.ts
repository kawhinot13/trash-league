import { after } from "next/server";
import { hasDb } from "@/lib/app/db";
import { enqueueImport, kick, progress, runJobs } from "@/lib/app/jobs";
import { getFamily } from "@/lib/app/store";

export const maxDuration = 60;

/** Find every season of the league, save it, and queue the heavy import (lineup replay, trade grades). */
export async function POST(req: Request, ctx: RouteContext<"/api/l/[leagueId]/import">) {
  const { leagueId } = await ctx.params;
  const got = await getFamily(leagueId).catch(() => null);
  if (!got) return Response.json({ error: "That isn't a Sleeper NBA league." }, { status: 404 });
  if (!hasDb()) return Response.json({ familyId: got.family.id, progress: null, db: false });
  const job = await enqueueImport(got.family.id);
  const origin = new URL(req.url).origin;
  after(async () => {
    const r = await runJobs(50_000);
    if (r.more) await kick(origin);
  });
  return Response.json({ familyId: got.family.id, progress: progress(job), db: true });
}
