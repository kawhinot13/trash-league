import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { authConfigured } from "@/lib/app/account";
import { db } from "@/lib/app/db";

/**
 * Yahoo Fantasy connection (OAuth 2.0, Yahoo's official API). A signed-in Rafterlore account links one
 * Yahoo account; its tokens are stored encrypted (AES-256-GCM, key derived from AUTH_SECRET) and only
 * ever used server-side to read that person's own leagues. Needs YAHOO_CLIENT_ID and
 * YAHOO_CLIENT_SECRET (a Yahoo developer app with Fantasy Sports read access); without them every
 * Yahoo feature is hidden.
 */
export const yahooConfigured = () => !!process.env.YAHOO_CLIENT_ID && !!process.env.YAHOO_CLIENT_SECRET && authConfigured();

export const YAHOO_COOKIE = "rl_yoauth";
const AUTH = "https://api.login.yahoo.com/oauth2";

/** Yahoo requires the redirect URI registered on the app; YAHOO_REDIRECT_URI pins it (else this origin). */
export const redirectUri = (origin: string) => process.env.YAHOO_REDIRECT_URI || new URL("/api/yahoo/callback", origin).toString();

export function authorizeUrl(origin: string, state: string) {
  const u = new URL(`${AUTH}/request_auth`);
  u.search = new URLSearchParams({
    client_id: process.env.YAHOO_CLIENT_ID!,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    state,
    language: "en-us",
  }).toString();
  return u.toString();
}

type TokenResponse = { access_token: string; refresh_token: string; expires_in: number; xoauth_yahoo_guid?: string };
export type Tokens = { access: string; refresh: string; exp: number; /** Redirect URI the connection used (Yahoo wants it again on refresh). */ ru?: string };

async function tokenCall(body: Record<string, string>): Promise<TokenResponse> {
  const basic = Buffer.from(`${process.env.YAHOO_CLIENT_ID}:${process.env.YAHOO_CLIENT_SECRET}`).toString("base64");
  const r = await fetch(`${AUTH}/get_token`, {
    method: "POST",
    headers: { authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  if (!r.ok) throw new Error(`yahoo token ${r.status}`);
  return (await r.json()) as TokenResponse;
}

export async function exchangeCode(code: string, origin: string) {
  const ru = redirectUri(origin);
  const t = await tokenCall({ grant_type: "authorization_code", code, redirect_uri: ru });
  return { tokens: { ...toTokens(t), ru }, guid: t.xoauth_yahoo_guid ?? null };
}

const toTokens = (t: TokenResponse): Tokens => ({ access: t.access_token, refresh: t.refresh_token, exp: Date.now() + (t.expires_in - 60) * 1000 });

/* ── Encryption at rest ─────────────────────────────────────────────── */
const key = () => createHash("sha256").update(`${process.env.AUTH_SECRET}|yahoo-tokens`).digest();
function seal(v: Tokens) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(JSON.stringify(v), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}
function open(s: string): Tokens | null {
  try {
    const [iv, tag, enc] = s.split(".").map((x) => Buffer.from(x, "base64url"));
    const d = createDecipheriv("aes-256-gcm", key(), iv);
    d.setAuthTag(tag);
    return JSON.parse(Buffer.concat([d.update(enc), d.final()]).toString("utf8")) as Tokens;
  } catch {
    return null;
  }
}

/* ── Links: one Yahoo account per Rafterlore account ─────────────────── */
export async function saveLink(accountId: string, guid: string, tokens: Tokens) {
  const sql = await db();
  await sql.begin(async (tx) => {
    // A Yahoo account links to one Rafterlore account at a time: the latest sign-in wins.
    await tx`delete from yahoo_links where guid = ${guid} and account_id <> ${accountId}`;
    await tx`
      insert into yahoo_links (account_id, guid, tokens) values (${accountId}, ${guid}, ${seal(tokens)})
      on conflict (account_id) do update set guid = excluded.guid, tokens = excluded.tokens, linked_at = now()`;
  });
}

export async function linkOf(accountId: string): Promise<{ guid: string } | null> {
  const sql = await db();
  const [row] = await sql<{ guid: string }[]>`select guid from yahoo_links where account_id = ${accountId}`;
  return row ?? null;
}

export async function unlink(accountId: string) {
  const sql = await db();
  await sql`delete from yahoo_links where account_id = ${accountId}`;
}

/** A fresh access token for this account (refreshed and re-saved when it's about to expire). */
export async function accessToken(accountId: string): Promise<string | null> {
  const sql = await db();
  const [row] = await sql<{ tokens: string }[]>`select tokens from yahoo_links where account_id = ${accountId}`;
  const t = row ? open(row.tokens) : null;
  if (!t) return null;
  if (t.exp > Date.now()) return t.access;
  try {
    const fresh = toTokens(await tokenCall({ grant_type: "refresh_token", refresh_token: t.refresh, redirect_uri: t.ru || process.env.YAHOO_REDIRECT_URI || "oob" }));
    if (!fresh.refresh) fresh.refresh = t.refresh;
    fresh.ru = t.ru;
    await sql`update yahoo_links set tokens = ${seal(fresh)} where account_id = ${accountId}`;
    return fresh.access;
  } catch {
    return null; // revoked or expired: the person reconnects
  }
}
