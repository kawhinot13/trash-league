import { db, hasDb } from "@/lib/app/db";
import { clientIp, take } from "@/lib/app/ratelimit";
import { logError } from "@/lib/app/safe";
import { familyIdOf, newestSeason } from "@/lib/app/store";
import { isSleeperId } from "@/lib/app/validate";

/**
 * Daily-game leaderboards for a Rafterlore league, in Postgres. Same answers as the Trash site's
 * /api/scores: { enabled, today: { manager: { score, label } }, week: { manager: { points, played } } }.
 * Like Trash's, it's an honor system for friends: you pick who you are, and the first result
 * posted each day stands. Only managers in the league's current season can be picked.
 */
// "dive2": the dive leaderboard since the no-repeat schedule and the 2026-11-15 reset.
const GAMES = new Set(["dive", "dive2", "trashle", "lineup"]);
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request, ctx: RouteContext<"/api/l/[leagueId]/scores">) {
  const { leagueId } = await ctx.params;
  const u = new URL(req.url);
  const game = u.searchParams.get("game") ?? "";
  const day = u.searchParams.get("day") ?? "";
  if (!hasDb() || !isSleeperId(leagueId)) return Response.json({ enabled: false });
  if (!GAMES.has(game) || !DAY.test(day)) return Response.json({ error: "bad request" }, { status: 400 });
  try {
    const fid = await familyIdOf(leagueId);
    if (!fid) return Response.json({ enabled: false });
    const sql = await db();
    const rows = await sql<{ day: Date; manager: string; score: number; label: string }[]>`
      select day, manager, score, label from game_scores
      where family_id = ${fid} and game = ${game} and day > ${day}::date - 7 and day <= ${day}::date`;
    const today: Record<string, { score: number; label: string }> = {};
    const week: Record<string, { points: number; played: number }> = {};
    for (const r of rows) {
      if (r.day.toISOString().slice(0, 10) === day) today[r.manager] = { score: r.score, label: r.label };
      const t = (week[r.manager] ??= { points: 0, played: 0 });
      t.points += r.score;
      t.played += 1;
    }
    return Response.json({ enabled: true, today, week }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    logError(`scores ${leagueId}`, e);
    return Response.json({ enabled: false });
  }
}

export async function POST(req: Request, ctx: RouteContext<"/api/l/[leagueId]/scores">) {
  const { leagueId } = await ctx.params;
  if (!hasDb() || !isSleeperId(leagueId)) return Response.json({ enabled: false });
  const b = (await req.json().catch(() => null)) as { game?: string; day?: string; manager?: string; score?: number; label?: string } | null;
  if (!b || !GAMES.has(b.game ?? "") || !DAY.test(b.day ?? "") || typeof b.score !== "number" || b.score < 0 || b.score > 1000)
    return Response.json({ error: "bad request" }, { status: 400 });
  const ok = await take("lookup", await clientIp()).catch(() => ({ ok: true as const }));
  if (!ok.ok) return Response.json({ error: "slow down" }, { status: 429 });
  try {
    const fid = await familyIdOf(leagueId);
    const season = fid ? await newestSeason(fid) : null;
    if (!fid || !season || !season.users.has(String(b.manager)))
      return Response.json({ error: "bad request" }, { status: 400 });
    const sql = await db();
    // First result of the day stands: no replays to improve a score.
    const saved = await sql`
      insert into game_scores (family_id, game, day, manager, score, label)
      values (${fid}, ${b.game!}, ${b.day!}, ${b.manager!}, ${Math.round(b.score)}, ${String(b.label ?? "").slice(0, 40)})
      on conflict do nothing returning 1`;
    return Response.json({ enabled: true, saved: saved.length > 0 });
  } catch (e) {
    logError(`scores ${leagueId}`, e);
    return Response.json({ enabled: false });
  }
}
