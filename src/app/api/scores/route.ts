import type { NextRequest } from "next/server";
import { league } from "@/lib/league";

/**
 * Daily game leaderboards, stored in Redis over its REST API (Upstash / Vercel KV).
 * Set KV_REST_API_URL + KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN).
 * Without them the endpoint answers { enabled: false } and the boards stay hidden.
 *
 * Keys: dive:{game}:{YYYY-MM-DD} -> hash of manager -> JSON { score, label }.
 */
const URL_ = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const GAMES = new Set(["dive", "trashle", "lineup"]);
const MANAGERS = new Set(league.managers.map((m) => m.id));
const DAY = /^\d{4}-\d{2}-\d{2}$/;

async function redis(cmds: (string | number)[][]): Promise<{ result: unknown }[]> {
  const r = await fetch(`${URL_}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return r.json();
}

const days = (day: string, n: number) =>
  Array.from({ length: n }, (_, i) => new Date(Date.parse(day) - i * 86400000).toISOString().slice(0, 10));

const parse = (h: unknown): Record<string, { score: number; label: string }> => {
  const out: Record<string, { score: number; label: string }> = {};
  const arr = Array.isArray(h) ? (h as string[]) : [];
  for (let i = 0; i + 1 < arr.length; i += 2) {
    try {
      out[arr[i]] = JSON.parse(arr[i + 1]);
    } catch {}
  }
  return out;
};

export async function GET(req: NextRequest) {
  if (!URL_ || !TOKEN) return Response.json({ enabled: false });
  const game = req.nextUrl.searchParams.get("game") ?? "";
  const day = req.nextUrl.searchParams.get("day") ?? "";
  if (!GAMES.has(game) || !DAY.test(day)) return Response.json({ error: "bad request" }, { status: 400 });
  try {
    const week = days(day, 7);
    const res = await redis(week.map((d) => ["HGETALL", `dive:${game}:${d}`]));
    const perDay = res.map((r) => parse(r.result));
    const totals: Record<string, { points: number; played: number }> = {};
    for (const d of perDay)
      for (const [m, v] of Object.entries(d)) {
        const t = (totals[m] ??= { points: 0, played: 0 });
        t.points += v.score;
        t.played += 1;
      }
    return Response.json({ enabled: true, today: perDay[0], week: totals });
  } catch {
    return Response.json({ enabled: false });
  }
}

export async function POST(req: NextRequest) {
  if (!URL_ || !TOKEN) return Response.json({ enabled: false });
  const body = (await req.json().catch(() => null)) as { game?: string; day?: string; manager?: string; score?: number; label?: string } | null;
  if (
    !body ||
    !GAMES.has(body.game ?? "") ||
    !DAY.test(body.day ?? "") ||
    !MANAGERS.has(body.manager ?? "") ||
    typeof body.score !== "number" ||
    body.score < 0 ||
    body.score > 1000
  )
    return Response.json({ error: "bad request" }, { status: 400 });
  const key = `dive:${body.game}:${body.day}`;
  const value = JSON.stringify({ score: Math.round(body.score), label: String(body.label ?? "").slice(0, 40) });
  try {
    // First result of the day stands: no replays to improve a score.
    const [set] = await redis([
      ["HSETNX", key, body.manager!, value],
      ["EXPIRE", key, 60 * 60 * 24 * 40],
    ]);
    return Response.json({ enabled: true, saved: set.result === 1 });
  } catch {
    return Response.json({ enabled: false });
  }
}
