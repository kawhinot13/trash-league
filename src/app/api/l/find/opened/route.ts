import { connection } from "next/server";
import { createHmac } from "node:crypto";
import { sameOrigin } from "@/lib/app/account";
import { db, hasDb } from "@/lib/app/db";
import { clientIp, take } from "@/lib/app/ratelimit";
import { logError } from "@/lib/app/safe";
import { cleanUsername, isSleeperId } from "@/lib/app/validate";

/**
 * Someone searched a Sleeper username and opened one of its leagues: count that username once, ever
 * (another league later doesn't count again). Stores only a keyed hash, so the admin page can count
 * unique people without anyone's username being kept.
 */
export async function POST(req: Request) {
  await connection();
  const secret = process.env.AUTH_SECRET || process.env.CRON_SECRET;
  if (!hasDb() || !secret || !sameOrigin(req)) return new Response(null, { status: 204 });
  const b = (await req.json().catch(() => null)) as { u?: string; league?: string } | null;
  const u = cleanUsername(b?.u);
  if (!u || !isSleeperId(b?.league)) return new Response(null, { status: 204 });
  const ok = await take("lookup", await clientIp()).catch(() => ({ ok: true as const }));
  if (!ok.ok) return new Response(null, { status: 204 });
  try {
    const h = createHmac("sha256", `${secret}|finder-people`).update(u.toLowerCase()).digest("base64url");
    const sql = await db();
    await sql`insert into finder_people (h) values (${h}) on conflict (h) do update set last_at = now(), opens = finder_people.opens + 1`;
  } catch (e) {
    logError("finder count", e);
  }
  return new Response(null, { status: 204 });
}
