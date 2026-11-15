import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { db } from "@/lib/app/db";
import { sleeper, type SUser } from "@/lib/app/sleeper";

/**
 * Proof that someone really manages a team before they can remove (or restore) a league.
 *
 * Sleeper has no sign-in for outside apps, and usernames are public, so a username alone proves
 * nothing. Instead Rafterlore issues a one-time code and the manager puts it in their own team name
 * in the league's newest season, which only that team's owner (or the league's commissioner) can
 * change in the Sleeper app. Rafterlore then reads the league fresh from Sleeper and checks.
 * Codes expire after 30 minutes and allow a handful of checks.
 */
export type Intent = "remove" | "restore";
export type Challenge = {
  id: string;
  familyId: string;
  leagueId: string;
  userId: string;
  intent: Intent;
  code: string;
  expiresAt: Date;
};

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L
export const newCode = () => `RFL-${Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")}`;
const TTL_MIN = 30;
const MAX_CHECKS = 8;

/** Does this manager's team name in the league contain the code? Spaces and case don't matter. */
export function teamNameHasCode(users: Pick<SUser, "user_id" | "metadata">[], userId: string, code: string): boolean {
  const name = users.find((u) => u.user_id === userId)?.metadata?.team_name ?? "";
  const norm = (s: string) => s.toUpperCase().replace(/[\s_]/g, "");
  return norm(name).includes(norm(code));
}

export async function createChallenge(c: Omit<Challenge, "id" | "code" | "expiresAt">): Promise<Challenge> {
  const sql = await db();
  const id = randomBytes(16).toString("hex");
  const code = newCode();
  const expiresAt = new Date(Date.now() + TTL_MIN * 60_000);
  // One open code per manager and league: a new request replaces the old one.
  await sql`delete from removal_challenges where family_id = ${c.familyId} and user_id = ${c.userId}`;
  await sql`
    insert into removal_challenges (id, family_id, league_id, user_id, intent, code, expires_at)
    values (${id}, ${c.familyId}, ${c.leagueId}, ${c.userId}, ${c.intent}, ${code}, ${expiresAt})`;
  return { ...c, id, code, expiresAt };
}

/**
 * Check a challenge against Sleeper right now. Returns the challenge when the code is in the
 * manager's team name (and uses it up), or why not.
 */
export async function verifyChallenge(
  id: string,
): Promise<{ ok: true; challenge: Challenge } | { ok: false; reason: "expired" | "not_found" | "too_many" | "not_yet" }> {
  const sql = await db();
  const [row] = await sql<
    { id: string; family_id: string; league_id: string; user_id: string; intent: Intent; code: string; expires_at: Date; checks: number }[]
  >`update removal_challenges set checks = checks + 1 where id = ${id} and not used returning *`;
  if (!row) return { ok: false, reason: "not_found" };
  if (row.expires_at < new Date()) return { ok: false, reason: "expired" };
  if (row.checks > MAX_CHECKS) return { ok: false, reason: "too_many" };
  // Always read fresh from Sleeper (no cache), so the name reflects what's set right now.
  const users = (await sleeper<SUser[] | null>(`/v1/league/${row.league_id}/users`)) ?? [];
  if (!teamNameHasCode(users, row.user_id, row.code)) return { ok: false, reason: "not_yet" };
  await sql`update removal_challenges set used = true where id = ${id}`;
  return {
    ok: true,
    challenge: {
      id: row.id,
      familyId: row.family_id,
      leagueId: row.league_id,
      userId: row.user_id,
      intent: row.intent,
      code: row.code,
      expiresAt: row.expires_at,
    },
  };
}
