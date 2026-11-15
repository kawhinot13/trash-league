import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { db, hasDb } from "@/lib/app/db";

/**
 * Per-address limits on the expensive things (importing a league Rafterlore hasn't seen, looking up
 * usernames, removal requests), plus a site-wide ceiling on new imports. Addresses are never
 * stored: only a salted hash, deleted after two days.
 */
export type Kind = "new_league" | "lookup" | "removal";
const LIMITS: Record<Kind, { hour: number; day: number; siteHour?: number }> = {
  new_league: { hour: 4, day: 10, siteHour: 120 },
  lookup: { hour: 40, day: 200 },
  removal: { hour: 5, day: 10 },
};

export async function clientIp(): Promise<string> {
  const h = await headers();
  // On Vercel these are set by the platform, not the client.
  return h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

const hash = (ip: string) =>
  createHash("sha256")
    .update(`${process.env.RATE_LIMIT_SALT || process.env.CRON_SECRET || "rafterlore"}:${ip}`)
    .digest("hex")
    .slice(0, 32);

const mem = new Map<string, number[]>();

/** Count one `kind` event for this visitor if allowed. Returns minutes to wait when not. */
export async function take(kind: Kind, ip: string): Promise<{ ok: true } | { ok: false; minutes: number }> {
  const lim = LIMITS[kind];
  const id = hash(ip);
  if (!hasDb()) {
    const now = Date.now();
    const list = (mem.get(`${kind}:${id}`) ?? []).filter((t) => now - t < 86_400_000);
    const hour = list.filter((t) => now - t < 3_600_000);
    if (hour.length >= lim.hour || list.length >= lim.day) return { ok: false, minutes: 60 };
    mem.set(`${kind}:${id}`, [...list, now]);
    return { ok: true };
  }
  const sql = await db();
  const [r] = await sql<{ hour: number; day: number; site: number; oldest_hour: Date | null }[]>`
    select
      count(*) filter (where ip_hash = ${id} and at > now() - interval '1 hour')::int as hour,
      count(*) filter (where ip_hash = ${id})::int as day,
      count(*) filter (where at > now() - interval '1 hour')::int as site,
      min(at) filter (where ip_hash = ${id} and at > now() - interval '1 hour') as oldest_hour
    from rate_events where kind = ${kind} and at > now() - interval '1 day'`;
  if (r.day >= lim.day) return { ok: false, minutes: 12 * 60 };
  if (r.hour >= lim.hour || (lim.siteHour && r.site >= lim.siteHour)) {
    const mins = r.oldest_hour ? Math.ceil((r.oldest_hour.getTime() + 3_600_000 - Date.now()) / 60_000) : 60;
    return { ok: false, minutes: Math.max(1, mins) };
  }
  await sql`insert into rate_events (ip_hash, kind) values (${id}, ${kind})`;
  return { ok: true };
}
