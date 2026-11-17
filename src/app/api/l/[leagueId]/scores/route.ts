import { connection } from "next/server";
import { authConfigured, getAccount, sameOrigin, sessionFrom } from "@/lib/app/account";
import { db, hasDb } from "@/lib/app/db";
import { clientIp, take } from "@/lib/app/ratelimit";
import { logError } from "@/lib/app/safe";
import { verifyChallenge } from "@/lib/app/removal";
import { familyIdOf, newestSeason } from "@/lib/app/store";
import { isSleeperId } from "@/lib/app/validate";
import { cleanState } from "@/lib/core/game-state";

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
  const none = { configured: authConfigured(), signedIn: false, linked: false, member: false, manager: null as string | null, suggest: null as string | null };
  if (!authConfigured()) return { ...none, accountId: null as string | null };
  const s = sessionFrom(req);
  const account = s ? await getAccount(s).catch(() => null) : null;
  if (!account) return { ...none, accountId: null };
  const sql = await db();
  const season = await newestSeason(fid);
  const users = [...(season?.users ?? [])];
  const [link] = await sql<{ sleeper_user: string }[]>`select sleeper_user from sleeper_links where account_id = ${account.id}`;
  const member = !!link && users.includes(link.sleeper_user);
  // Not linked yet: the manager whose Sleeper username matches the one saved on the account, if any.
  const saved = account.sleeper?.toLowerCase();
  const suggest = !link && saved ? ([...(season?.names ?? [])].find(([, n]) => n?.toLowerCase() === saved)?.[0] ?? null) : null;
  return { configured: true, signedIn: true, linked: !!link, member, manager: member ? link.sleeper_user : null, suggest, accountId: account.id };
}

export async function GET(req: Request, ctx: RouteContext<"/api/l/[leagueId]/scores">) {
  await connection();
  const { leagueId } = await ctx.params;
  const u = new URL(req.url);
  const game = u.searchParams.get("game") ?? "";
  const day = u.searchParams.get("day") ?? "";
  if (!hasDb() || !isSleeperId(leagueId)) return Response.json({ enabled: false });
  // ?who=1: just who's looking (the games ask before you play).
  if (u.searchParams.get("who") === "1") {
    const fid = await familyIdOf(leagueId).catch(() => null);
    if (!fid) return Response.json({ enabled: false });
    const { accountId: _a, ...viewer } = await viewerOf(req, fid);
    void _a;
    // With ?day: the games this manager already finished that day, so every device shows the same result.
    let played: Record<string, { score: number; label: string; state: Record<string, unknown> | null }> = {};
    if (viewer.member && viewer.manager && DAY.test(day)) {
      const sql = await db();
      const rows = await sql<{ game: string; score: number; label: string; state: Record<string, unknown> | null }[]>`
        select game, score, label, state from game_scores where family_id = ${fid} and manager = ${viewer.manager} and day = ${day}::date`;
      played = Object.fromEntries(rows.map((r) => [r.game, { score: r.score, label: r.label, state: r.state }]));
    }
    // Not linked yet and no saved username to go on: the league's managers to pick from (ids only), and
    // which of them another account already plays as.
    let pick: { current: string[]; taken: string[] } | null = null;
    if (viewer.signedIn && !viewer.linked && !viewer.suggest) {
      const season = await newestSeason(fid);
      const current = [...(season?.users ?? [])];
      if (current.length) {
        const sql = await db();
        const rows = await sql<{ sleeper_user: string }[]>`select sleeper_user from sleeper_links where sleeper_user in ${sql(current)}`;
        pick = { current, taken: rows.map((r) => r.sleeper_user) };
      }
    }
    return Response.json({ enabled: true, viewer, played, pick }, { headers: { "cache-control": "no-store" } });
  }
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
    // Each manager's best single day ever in this game (high score), with the date.
    const best: Record<string, { score: number; day: string; label: string }> = {};
    const topOfDay = new Map<string, number>();
    for (const r of rows) {
      const d = r.day.toISOString().slice(0, 10);
      topOfDay.set(d, Math.max(topOfDay.get(d) ?? -1, r.score));
    }
    for (const r of rows) {
      const d = r.day.toISOString().slice(0, 10);
      if (r.game === game && d === day) today[r.manager] = { score: r.score, label: r.label };
      if (r.game === game && Date.parse(d) > Date.parse(day) - 7 * 86_400_000) {
        const t = (week[r.manager] ??= { points: 0, played: 0 });
        t.points += r.score;
        t.played += 1;
      }
      {
        const b = best[r.manager];
        if (!b || r.score > b.score) best[r.manager] = { score: r.score, day: d, label: r.label };
      }
      const a = (all[r.manager] ??= { points: 0, played: 0, wins: 0 });
      a.points += r.score;
      a.played += 1;
      if (r.score === topOfDay.get(d)) a.wins += 1;
    }
    const { accountId: _account, ...viewer } = await viewerOf(req, fid);
    void _account;
    // Each player's Sleeper team name this season (public league data), for managers on the board.
    const season = await newestSeason(fid).catch(() => null);
    const teams: Record<string, string> = {};
    for (const m of Object.keys(all)) {
      const t = season?.teams.get(m);
      if (t) teams[m] = t;
    }
    return Response.json({ enabled: true, today, week, all, best, teams, viewer }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    logError(`scores ${leagueId}`, e);
    return Response.json({ enabled: false });
  }
}

/**
 * POST, three kinds (all signed in when sign-in is on):
 *  - { claim: true, manager } -> { code, challenge, expiresAt }: a one-time code to put in that
 *    manager's team name in this league on Sleeper (proof you're them; see removal.ts).
 *  - { verify: challenge } -> { linked: true } once the code is in the team name. Proof wins: it
 *    replaces any earlier link to that manager and this account's earlier link.
 *  - { game, day, manager, score, label }: a result, only as your linked manager.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/l/[leagueId]/scores">) {
  const { leagueId } = await ctx.params;
  if (!hasDb() || !isSleeperId(leagueId)) return Response.json({ enabled: false });
  // Posting rides on the session cookie, so only this site's own pages may post.
  if (authConfigured() && !sameOrigin(req)) return Response.json({ error: "bad request" }, { status: 403 });
  const b = (await req.json().catch(() => null)) as {
    game?: string;
    day?: string;
    manager?: string;
    state?: unknown;
    score?: number;
    label?: string;
    claim?: boolean;
    username?: string;
    verify?: string;
  } | null;
  if (!b) return Response.json({ error: "bad request" }, { status: 400 });
  const ok = await take("lookup", await clientIp()).catch(() => ({ ok: true as const }));
  if (!ok.ok) return Response.json({ error: "Slow down a little and try again." }, { status: 429 });
  try {
    const fid = await familyIdOf(leagueId);
    const season = fid ? await newestSeason(fid) : null;
    if (!fid || !season) return Response.json({ error: "bad request" }, { status: 400 });
    const sql = await db();

    if (b.claim === true || typeof b.verify === "string") {
      if (!authConfigured()) return Response.json({ error: "bad request" }, { status: 400 });
      const v = await viewerOf(req, fid);
      if (!v.accountId) return Response.json({ error: "Sign in first." }, { status: 401 });
      if (b.claim === true) {
        // Owner's rules: no code, but you can only be the manager whose Sleeper username is on your account
        // (saved when you search it, or typed here once). First account to claim a manager keeps them.
        if (typeof b.username === "string") {
          const want = b.username.trim().toLowerCase();
          b.manager = [...season.names].find(([, n]) => n?.toLowerCase() === want)?.[0];
          if (!b.manager) return Response.json({ error: `${b.username.trim()} isn't a manager in this league.` }, { status: 404 });
        }
        if (!season.users.has(String(b.manager))) return Response.json({ error: "bad request" }, { status: 400 });
        const [acct] = await sql<{ sleeper: string | null }[]>`select sleeper from accounts where id = ${v.accountId}`;
        const target = season.names.get(b.manager!) ?? "";
        if (acct?.sleeper && acct.sleeper.toLowerCase() !== target.toLowerCase())
          return Response.json({ error: `Your account plays as ${acct.sleeper}. You can only play as your own Sleeper username.` }, { status: 409 });
        const [taken] = await sql<{ account_id: string }[]>`select account_id from sleeper_links where sleeper_user = ${b.manager!}`;
        if (taken && taken.account_id !== v.accountId)
          return Response.json({ error: `Another account already plays as ${season.names.get(b.manager!) ?? "that manager"}.` }, { status: 409 });
        await sql.begin(async (tx) => {
          await tx`delete from sleeper_links where account_id = ${v.accountId}`;
          await tx`insert into sleeper_links (sleeper_user, account_id) values (${b.manager!}, ${v.accountId})`;
          if (target) await tx`update accounts set sleeper = coalesce(sleeper, ${target}) where id = ${v.accountId}`;
        });
        return Response.json({ linked: true });
      }
      if (!/^[a-f0-9]{32}$/.test(b.verify!)) return Response.json({ error: "Start again: that code isn't valid." }, { status: 400 });
      const r = await verifyChallenge(b.verify!, ["link"]);
      if (!r.ok) {
        const msg = {
          not_yet: "Rafterlore can't see the code in your team name yet. Save it in Sleeper, wait a few seconds, then check again.",
          expired: "That code expired. Pick yourself again for a new one.",
          too_many: "Too many checks for this code. Pick yourself again for a new one.",
          not_found: "Pick yourself again: that code isn't valid.",
        }[r.reason];
        return Response.json({ error: msg, retry: r.reason === "not_yet" }, { status: r.reason === "not_yet" ? 409 : 410 });
      }
      if (r.challenge.familyId !== fid || r.challenge.accountId !== v.accountId)
        return Response.json({ error: "Pick yourself again: that code isn't valid." }, { status: 400 });
      await sql.begin(async (tx) => {
        await tx`delete from sleeper_links where account_id = ${v.accountId} or sleeper_user = ${r.challenge.userId}`;
        await tx`insert into sleeper_links (sleeper_user, account_id) values (${r.challenge.userId}, ${v.accountId})`;
        // The proven manager's username becomes the account's saved one, if it has none yet.
        const name = season.names.get(r.challenge.userId);
        if (name) await tx`update accounts set sleeper = coalesce(sleeper, ${name}) where id = ${v.accountId}`;
      });
      return Response.json({ linked: true });
    }

    if (!GAMES.has(b.game ?? "") || !DAY.test(b.day ?? "") || typeof b.score !== "number" || b.score < 0 || b.score > 1000)
      return Response.json({ error: "bad request" }, { status: 400 });
    if (!season.users.has(String(b.manager))) return Response.json({ error: "bad request" }, { status: 400 });
    if (authConfigured()) {
      // Standings are for signed-in accounts, each as its one proven Sleeper user, in leagues they're in.
      const v = await viewerOf(req, fid);
      if (!v.accountId) return Response.json({ error: "Sign in to post to the standings." }, { status: 401 });
      if (!v.linked) return Response.json({ error: "Prove which manager you are first." }, { status: 403 });
      if (!v.member) return Response.json({ error: "You're not a manager in this league." }, { status: 403 });
      if (v.manager !== b.manager) return Response.json({ error: "Your account plays as someone else." }, { status: 409 });
    }
    // First result of the day stands: no replays to improve a score.
    const saved = await sql`
      insert into game_scores (family_id, game, day, manager, score, label, state)
      values (${fid}, ${b.game!}, ${b.day!}, ${b.manager!}, ${Math.round(b.score)}, ${String(b.label ?? "").slice(0, 40)}, ${cleanState(b.state) ? sql.json(cleanState(b.state) as never) : null})
      on conflict do nothing returning 1`;
    return Response.json({ enabled: true, saved: saved.length > 0 });
  } catch (e) {
    logError(`scores ${leagueId}`, e);
    return Response.json({ enabled: false });
  }
}
