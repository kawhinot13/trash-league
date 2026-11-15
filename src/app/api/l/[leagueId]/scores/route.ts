import { connection } from "next/server";
import { authConfigured, getAccount, sameOrigin, sessionFrom } from "@/lib/app/account";
import { db, hasDb } from "@/lib/app/db";
import { clientIp, take } from "@/lib/app/ratelimit";
import { logError } from "@/lib/app/safe";
import { familyIdOf, newestSeason } from "@/lib/app/store";
import { isSleeperId } from "@/lib/app/validate";

/**
 * Daily-game standings for one Rafterlore league, in Postgres:
 * { enabled, today: { manager: { score, label } }, week: { manager: { points, played } },
 *   all: { manager: { points, played, wins } }, viewer: { configured, signedIn, manager } }.
 * With sign-in switched on, only signed-in accounts post, each as the league manager it claimed
 * (one account per manager per league, so nobody plays as someone else). Without it, the old honor
 * system: pick who you are. The first result posted each day stands.
 */
// "dive2": the dive leaderboard since the no-repeat schedule and the 2026-11-15 reset.
const GAMES = new Set(["dive", "dive2", "trashle", "lineup"]);
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Who's looking. Each account is linked to one Sleeper user for every league (picked once), and can
 * only play as that user, only in leagues where they're a manager. Never returns the account id.
 */
async function viewerOf(req: Request, fid: string) {
  const none = { configured: authConfigured(), signedIn: false, linked: false, member: false, manager: null as string | null, taken: [] as string[] };
  if (!authConfigured()) return { ...none, accountId: null as string | null };
  const s = sessionFrom(req);
  const account = s ? await getAccount(s).catch(() => null) : null;
  if (!account) return { ...none, accountId: null };
  const sql = await db();
  const season = await newestSeason(fid);
  const users = [...(season?.users ?? [])];
  const [link] = await sql<{ sleeper_user: string }[]>`select sleeper_user from sleeper_links where account_id = ${account.id}`;
  const taken = users.length
    ? (await sql<{ sleeper_user: string }[]>`select sleeper_user from sleeper_links where sleeper_user in ${sql(users)}`).map((t) => t.sleeper_user)
    : [];
  const member = !!link && users.includes(link.sleeper_user);
  return { configured: true, signedIn: true, linked: !!link, member, manager: member ? link.sleeper_user : null, taken, accountId: account.id };
}

export async function GET(req: Request, ctx: RouteContext<"/api/l/[leagueId]/scores">) {
  await connection();
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
    // The dive's board moved to "dive2" on 2026-11-15; all-time standings count both.
    const games = game === "dive2" ? ["dive", "dive2"] : [game];
    const rows = await sql<{ day: Date; manager: string; score: number; label: string; game: string }[]>`
      select day, manager, score, label, game from game_scores where family_id = ${fid} and game in ${sql(games)} and day <= ${day}::date`;
    const today: Record<string, { score: number; label: string }> = {};
    const week: Record<string, { points: number; played: number }> = {};
    const all: Record<string, { points: number; played: number; wins: number }> = {};
    const best = new Map<string, number>();
    for (const r of rows) {
      const d = r.day.toISOString().slice(0, 10);
      best.set(d, Math.max(best.get(d) ?? -1, r.score));
    }
    for (const r of rows) {
      const d = r.day.toISOString().slice(0, 10);
      if (r.game === game && d === day) today[r.manager] = { score: r.score, label: r.label };
      if (r.game === game && Date.parse(d) > Date.parse(day) - 7 * 86_400_000) {
        const t = (week[r.manager] ??= { points: 0, played: 0 });
        t.points += r.score;
        t.played += 1;
      }
      const a = (all[r.manager] ??= { points: 0, played: 0, wins: 0 });
      a.points += r.score;
      a.played += 1;
      if (r.score === best.get(d)) a.wins += 1;
    }
    const { accountId: _account, ...viewer } = await viewerOf(req, fid);
    void _account;
    return Response.json({ enabled: true, today, week, all, viewer }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    logError(`scores ${leagueId}`, e);
    return Response.json({ enabled: false });
  }
}

export async function POST(req: Request, ctx: RouteContext<"/api/l/[leagueId]/scores">) {
  const { leagueId } = await ctx.params;
  if (!hasDb() || !isSleeperId(leagueId)) return Response.json({ enabled: false });
  // Posting rides on the session cookie, so only this site's own pages may post.
  if (authConfigured() && !sameOrigin(req)) return Response.json({ error: "bad request" }, { status: 403 });
  const b = (await req.json().catch(() => null)) as { game?: string; day?: string; manager?: string; score?: number; label?: string; claim?: boolean } | null;
  // { claim: true, manager }: pick who you are in this league before playing (signed in only).
  const claimOnly = b?.claim === true;
  if (!b || (claimOnly && typeof b.manager !== "string") || (!claimOnly && (!GAMES.has(b.game ?? "") || !DAY.test(b.day ?? "") || typeof b.score !== "number" || b.score < 0 || b.score > 1000)))
    return Response.json({ error: "bad request" }, { status: 400 });
  const ok = await take("lookup", await clientIp()).catch(() => ({ ok: true as const }));
  if (!ok.ok) return Response.json({ error: "slow down" }, { status: 429 });
  try {
    const fid = await familyIdOf(leagueId);
    const season = fid ? await newestSeason(fid) : null;
    if (!fid || !season || !season.users.has(String(b.manager))) return Response.json({ error: "bad request" }, { status: 400 });
    const sql = await db();
    if (authConfigured()) {
      // Standings are for signed-in accounts, each as its one linked Sleeper user, in leagues they're in.
      const v = await viewerOf(req, fid);
      if (!v.accountId) return Response.json({ error: "Sign in to post to the standings." }, { status: 401 });
      if (v.linked && !v.member) return Response.json({ error: "You're not a manager in this league." }, { status: 403 });
      if (v.linked && v.manager !== b.manager) return Response.json({ error: "Your account plays as someone else." }, { status: 409 });
      if (!v.linked) {
        const linked = await sql`
          insert into sleeper_links (sleeper_user, account_id) values (${b.manager!}, ${v.accountId})
          on conflict do nothing returning 1`;
        if (!linked.length) {
          // Either that manager is taken, or this account was just linked in another tab.
          const [mine] = await sql<{ sleeper_user: string }[]>`select sleeper_user from sleeper_links where account_id = ${v.accountId}`;
          if (!mine) return Response.json({ error: "Another account already plays as that manager." }, { status: 409 });
          if (mine.sleeper_user !== b.manager) return Response.json({ error: "Your account plays as someone else." }, { status: 409 });
        }
      }
    }
    if (claimOnly) return authConfigured() ? Response.json({ enabled: true, claimed: true }) : Response.json({ error: "bad request" }, { status: 400 });
    // First result of the day stands: no replays to improve a score.
    const saved = await sql`
      insert into game_scores (family_id, game, day, manager, score, label)
      values (${fid}, ${b.game!}, ${b.day!}, ${b.manager!}, ${Math.round(b.score!)}, ${String(b.label ?? "").slice(0, 40)})
      on conflict do nothing returning 1`;
    return Response.json({ enabled: true, saved: saved.length > 0 });
  } catch (e) {
    logError(`scores ${leagueId}`, e);
    return Response.json({ enabled: false });
  }
}
