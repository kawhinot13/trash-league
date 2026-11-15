import "server-only";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { db, hasDb } from "@/lib/app/db";
import { cleanUsername, isSleeperId } from "@/lib/app/validate";

/**
 * Optional accounts: "Sign in with Google" so Rafterlore remembers your Sleeper username and the
 * leagues you open, on any device. No email or password is stored. Pages stay pre-built: the
 * session is only read by API routes (/api/me, the refresh ping), never while rendering a page.
 *
 * Needs AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET (a Google OAuth client) and AUTH_SECRET (random, 32+
 * characters, signs the session cookie). Without them sign-in is simply hidden.
 */
export const SESSION_COOKIE = "rl_session";
export const OAUTH_COOKIE = "rl_oauth";
const SESSION_DAYS = 180;

export const authConfigured = () =>
  !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET && (process.env.AUTH_SECRET?.length ?? 0) >= 32 && hasDb();

const b64 = (b: Buffer) => b.toString("base64url");
const mac = (s: string) => b64(createHmac("sha256", process.env.AUTH_SECRET!).update(s).digest());
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export const randomToken = () => b64(randomBytes(32));

/**
 * A signed, expiring value: "payload.signature" (payload is base64url JSON). `t` says what it's
 * for ("s" session, "o" sign-in flow), so one kind can never be used as the other.
 */
export function sign(t: "s" | "o", value: object, maxAgeSec: number) {
  const body = b64(Buffer.from(JSON.stringify({ ...value, t, exp: Math.floor(Date.now() / 1000) + maxAgeSec })));
  return `${body}.${mac(body)}`;
}
export function unsign<T>(t: "s" | "o", token: string | undefined | null): T | null {
  if (!token || !authConfigured()) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || !same(sig, mac(body))) return null;
  try {
    const v = JSON.parse(Buffer.from(body, "base64url").toString()) as T & { exp: number; t: string };
    return v.t === t && v.exp > Date.now() / 1000 ? v : null;
  } catch {
    return null;
  }
}

/** Sessions carry the account's session version; signing out bumps it, ending every session. */
export const sessionToken = (accountId: string, v: number) => sign("s", { a: accountId, v }, SESSION_DAYS * 86_400);
export const sessionMaxAge = SESSION_DAYS * 86_400;

export type Session = { id: string; v: number };
/** The session from a request's cookies (signature and expiry checked; version checked by the queries). */
export function sessionFrom(req: Request): Session | null {
  const raw = req.headers.get("cookie") ?? "";
  const m = raw.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  const s = unsign<{ a: string; v: number }>("s", m ? decodeURIComponent(m[1]) : null);
  return s && typeof s.a === "string" && typeof s.v === "number" ? { id: s.a, v: s.v } : null;
}

export const cookieFlags = (maxAge: number) =>
  `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;

/** Changes only from Rafterlore's own pages (the cookie is SameSite=Lax too). */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  return !origin || origin === new URL(req.url).origin;
}

/** Only same-site relative paths are allowed as a post-sign-in destination. */
export const safeNext = (s: string | null | undefined) => (s && /^\/(?!\/)[\w\-./?=&%#]*$/.test(s) ? s : "/l");

export type SavedLeague = { id: string; name: string };
export type Account = { id: string; name: string; sleeper: string | null; leagues: SavedLeague[] };

export async function upsertGoogleAccount(sub: string, name: string): Promise<Session> {
  const sql = await db();
  const first = name.trim().split(/\s+/)[0]?.slice(0, 40) ?? "";
  const [row] = await sql<{ id: string; session_v: number }[]>`
    insert into accounts (id, google_sub, name) values (${randomUUID()}, ${sub}, ${first})
    on conflict (google_sub) do update set seen_at = now()
    returning id, session_v`;
  return { id: row.id, v: row.session_v };
}

export async function getAccount(s: Session): Promise<Account | null> {
  const sql = await db();
  const [row] = await sql<Account[]>`select id, name, sleeper, leagues from accounts where id = ${s.id} and session_v = ${s.v}`;
  return row ?? null;
}

export async function saveSleeper(s: Session, username: string | null) {
  const v = username === null ? null : cleanUsername(username);
  if (username !== null && !v) return;
  const sql = await db();
  await sql`update accounts set sleeper = ${v}, seen_at = now() where id = ${s.id} and session_v = ${s.v}`;
}

/** Remember a league the person opened: most recent first, at most 12 (one atomic update). */
export async function rememberLeague(s: Session, league: SavedLeague) {
  if (!isSleeperId(league.id)) return;
  const sql = await db();
  const entry = sql.json([{ id: league.id, name: league.name.slice(0, 80) }] as never);
  await sql`
    update accounts set seen_at = now(), leagues = (
      select coalesce(jsonb_agg(x order by n), '[]'::jsonb) from (
        select x, n from jsonb_array_elements(${entry}::jsonb || coalesce(
          (select jsonb_agg(e) from jsonb_array_elements(leagues) e where e->>'id' <> ${league.id}), '[]'::jsonb)
        ) with ordinality as t(x, n) limit 12
      ) kept
    )
    where id = ${s.id} and session_v = ${s.v}`;
}

export async function forgetLeague(s: Session, leagueId: string) {
  const sql = await db();
  await sql`
    update accounts set leagues = coalesce((select jsonb_agg(e) from jsonb_array_elements(leagues) e where e->>'id' <> ${leagueId}), '[]'::jsonb)
    where id = ${s.id} and session_v = ${s.v}`;
}

/** Sign out everywhere: every session issued so far stops working. */
export async function endSessions(s: Session) {
  const sql = await db();
  await sql`update accounts set session_v = session_v + 1 where id = ${s.id} and session_v = ${s.v}`;
}

export async function deleteAccount(s: Session) {
  const sql = await db();
  await sql`delete from accounts where id = ${s.id} and session_v = ${s.v}`;
}
