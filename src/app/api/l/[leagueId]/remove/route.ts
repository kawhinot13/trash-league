import { hasDb } from "@/lib/app/db";
import { clientIp, take } from "@/lib/app/ratelimit";
import { logError } from "@/lib/app/safe";
import { sleeperUser } from "@/lib/app/sleeper";
import { familyIdOf, familyUsers, removeFamily, restoreFamily } from "@/lib/app/store";
import { cleanUsername, isSleeperId } from "@/lib/app/validate";

/**
 * Remove a league from Rafterlore (or undo that within the grace period). Only someone who has managed
 * a team in the league can do it: they give their Sleeper username and it must be one of the
 * league's members in some season.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/l/[leagueId]/remove">) {
  const { leagueId } = await ctx.params;
  if (!isSleeperId(leagueId)) return Response.json({ error: "That isn't a Sleeper league id." }, { status: 400 });
  if (!hasDb()) return Response.json({ error: "Rafterlore isn't storing anything for this league." }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { username?: unknown; action?: unknown };
  const username = cleanUsername(body.username);
  const action = body.action === "restore" ? "restore" : "remove";
  if (!username) return Response.json({ error: "Enter your Sleeper username." }, { status: 400 });
  const ok = await take("removal", await clientIp());
  if (!ok.ok) return Response.json({ error: `Too many requests. Try again in ${ok.minutes} minutes.` }, { status: 429 });
  try {
    const fid = await familyIdOf(leagueId);
    if (!fid) return Response.json({ error: "Rafterlore has nothing stored for this league." }, { status: 404 });
    const user = await sleeperUser(username).catch(() => null);
    const members = await familyUsers(fid);
    if (!user?.user_id || !members.has(user.user_id))
      return Response.json({ error: `“${username}” isn't a manager in this league on Sleeper.` }, { status: 403 });
    if (action === "restore") {
      const done = await restoreFamily(fid);
      return Response.json(done ? { ok: true, restored: true } : { error: "It's too late to restore this league." }, { status: done ? 200 : 410 });
    }
    const purge = await removeFamily(fid);
    return Response.json({ ok: true, purgeAfter: purge.toISOString() });
  } catch (e) {
    logError(`remove ${leagueId}`, e);
    return Response.json({ error: "Something went wrong. Try again in a moment." }, { status: 500 });
  }
}
