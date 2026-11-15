import { after } from "next/server";
import { enqueueImport, kick, progress, runJobs } from "@/lib/app/jobs";
import { clientIp } from "@/lib/app/ratelimit";
import { logError } from "@/lib/app/safe";
import { db, hasDb } from "@/lib/app/db";
import { familyIdOf, getFamily } from "@/lib/app/store";
import { USE_ACK_VERSION } from "@/lib/app/use-ack";
import { isSleeperId } from "@/lib/app/validate";

export const maxDuration = 60;

/** Find every season of the league, save it, and queue the heavy import (lineup replay, trade grades). */
export async function POST(req: Request, ctx: RouteContext<"/api/l/[leagueId]/import">) {
  const { leagueId } = await ctx.params;
  if (!isSleeperId(leagueId)) return Response.json({ error: "That isn't a Sleeper league id." }, { status: 400 });
  // A league's first import needs the recreational-use acknowledgement (see use-ack.ts).
  const ack = ((await req.json().catch(() => null)) as { ack?: string } | null)?.ack === USE_ACK_VERSION;
  try {
    if (!ack && hasDb() && !(await familyIdOf(leagueId)))
      return Response.json({ error: "Confirm Rafterlore is for recreational and informational use to open this league." }, { status: 428 });
    const got = await getFamily(leagueId, await clientIp());
    if (got.status === "not_found") return Response.json({ error: "That isn't a Sleeper basketball or football league." }, { status: 404 });
    if (got.status === "removed") return Response.json({ error: "This league asked to be removed from Rafterlore." }, { status: 410 });
    if (got.status === "limited")
      return Response.json({ error: `Too many new leagues from your network. Try again in ${got.minutes} minutes.` }, { status: 429 });
    if (!hasDb()) return Response.json({ progress: null, db: false });
    if (ack) {
      const sql = await db();
      await sql`update families set use_ack = coalesce(use_ack, ${USE_ACK_VERSION}), use_ack_at = coalesce(use_ack_at, now()) where id = ${got.family.id}`;
    }
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
