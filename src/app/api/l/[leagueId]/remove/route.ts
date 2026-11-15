import { hasDb } from "@/lib/app/db";
import { clientIp, take } from "@/lib/app/ratelimit";
import { createChallenge, verifyChallenge } from "@/lib/app/removal";
import { logError } from "@/lib/app/safe";
import { sleeperUser } from "@/lib/app/sleeper";
import { familyIdOf, newestSeason, removeFamily, restoreFamily } from "@/lib/app/store";
import { cleanUsername, isSleeperId } from "@/lib/app/validate";

/**
 * Remove a league from Rafterlore, or restore it within the grace period. Two steps, because a
 * Sleeper username is public and proves nothing on its own:
 *  1. { step: "start", username, intent } -> a one-time code for that manager.
 *  2. { step: "verify", challengeId } -> succeeds only once that manager's team name in the league's
 *     newest season contains the code (only they, or the commissioner, can change it in Sleeper).
 */
export async function POST(req: Request, ctx: RouteContext<"/api/l/[leagueId]/remove">) {
  const { leagueId } = await ctx.params;
  if (!isSleeperId(leagueId)) return Response.json({ error: "That isn't a Sleeper league id." }, { status: 400 });
  if (!hasDb()) return Response.json({ error: "Rafterlore isn't storing anything for this league." }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { step?: unknown; username?: unknown; intent?: unknown; challengeId?: unknown };
  const ip = await clientIp();

  try {
    const fid = await familyIdOf(leagueId);
    if (!fid) return Response.json({ error: "Rafterlore has nothing stored for this league." }, { status: 404 });

    if (body.step === "start") {
      const username = cleanUsername(body.username);
      if (!username) return Response.json({ error: "Enter your Sleeper username." }, { status: 400 });
      const ok = await take("removal", ip);
      if (!ok.ok) return Response.json({ error: `Too many requests. Try again in ${ok.minutes} minutes.` }, { status: 429 });
      const season = await newestSeason(fid);
      const user = await sleeperUser(username).catch(() => null);
      if (!season || !user?.user_id || !season.users.has(user.user_id))
        return Response.json(
          { error: `“${username}” isn't a manager in this league's latest season on Sleeper.` },
          { status: 403 },
        );
      const c = await createChallenge({
        familyId: fid,
        leagueId: season.leagueId,
        userId: user.user_id,
        intent: body.intent === "restore" ? "restore" : "remove",
      });
      return Response.json({
        challengeId: c.id,
        code: c.code,
        league: season.name,
        season: season.season,
        expiresAt: c.expiresAt.toISOString(),
      });
    }

    if (body.step === "verify") {
      if (typeof body.challengeId !== "string" || !/^[a-f0-9]{32}$/.test(body.challengeId))
        return Response.json({ error: "Start again: that code isn't valid." }, { status: 400 });
      const v = await verifyChallenge(body.challengeId);
      if (!v.ok) {
        const msg = {
          not_yet: "Rafterlore can't see the code in your team name yet. Save it in Sleeper, wait a few seconds, then check again.",
          expired: "That code expired. Start again for a new one.",
          too_many: "Too many checks for this code. Start again for a new one.",
          not_found: "Start again: that code isn't valid.",
        }[v.reason];
        return Response.json({ error: msg, retry: v.reason === "not_yet" }, { status: v.reason === "not_yet" ? 409 : 410 });
      }
      if (v.challenge.familyId !== fid) return Response.json({ error: "Start again: that code is for another league." }, { status: 400 });
      if (v.challenge.intent === "restore") {
        const done = await restoreFamily(fid);
        return Response.json(done ? { ok: true, restored: true } : { error: "It's too late to restore this league." }, { status: done ? 200 : 410 });
      }
      const purge = await removeFamily(fid);
      return Response.json({ ok: true, purgeAfter: purge.toISOString() });
    }

    return Response.json({ error: "Unknown step." }, { status: 400 });
  } catch (e) {
    logError(`remove ${leagueId}`, e);
    return Response.json({ error: "Something went wrong. Try again in a moment." }, { status: 500 });
  }
}
