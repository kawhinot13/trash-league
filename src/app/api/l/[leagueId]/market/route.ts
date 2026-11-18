import { connection } from "next/server";
import { authConfigured, sameOrigin } from "@/lib/app/account";
import { hasDb } from "@/lib/app/db";
import { logError } from "@/lib/app/safe";
import { isSleeperId } from "@/lib/app/validate";
import { viewerOf } from "@/lib/app/viewer";
import { marketSeason, marketState, placeOrder, type Order } from "@/packs/trash/market/server";

/**
 * The Trash Exchange (Trash pack only; every other league gets enabled: false). Play money:
 * nothing here can be bought with, or turned into, anything real. Trading needs a signed-in
 * account playing as one of the league's managers, the same identity the daily games use.
 */
const off = () => Response.json({ enabled: false }, { headers: { "cache-control": "no-store" } });

export async function GET(req: Request, ctx: RouteContext<"/api/l/[leagueId]/market">) {
  await connection();
  const { leagueId } = await ctx.params;
  if (!hasDb() || !isSleeperId(leagueId) || !authConfigured()) return off();
  try {
    const season = await marketSeason(leagueId);
    if (!season) return off();
    const v = await viewerOf(req, season.familyId);
    const state = await marketState(leagueId, season, v.member ? v.manager : null);
    return Response.json({ enabled: true, me: v.member ? v.manager : null, ...state }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    logError(`market ${leagueId}`, e);
    return Response.json({ enabled: true, error: "The market is closed for a minute. Try again shortly." }, { status: 503 });
  }
}

export async function POST(req: Request, ctx: RouteContext<"/api/l/[leagueId]/market">) {
  const { leagueId } = await ctx.params;
  if (!hasDb() || !isSleeperId(leagueId) || !authConfigured()) return off();
  if (!sameOrigin(req)) return Response.json({ error: "bad request" }, { status: 403 });
  const b = (await req.json().catch(() => null)) as { kind?: string; team?: string; qty?: number } | null;
  const kind = b?.kind;
  if (!b || !["buy", "sell", "coin", "uncoin", "hoodie"].includes(kind ?? "") || typeof b.qty !== "number") return Response.json({ error: "bad request" }, { status: 400 });
  if ((kind === "buy" || kind === "sell") && !(typeof b.team === "string" && /^\d{1,24}$/.test(b.team))) return Response.json({ error: "bad request" }, { status: 400 });
  try {
    const season = await marketSeason(leagueId);
    if (!season) return off();
    const v = await viewerOf(req, season.familyId);
    if (!v.member || !v.manager) return Response.json({ error: "Only the league's managers can trade, as themselves." }, { status: 403 });
    const order = (kind === "buy" || kind === "sell" ? { kind, team: b.team!, qty: b.qty } : { kind, qty: b.qty }) as Order;
    const r = await placeOrder(season, v.manager, order);
    if (!r.ok) return Response.json({ error: r.error }, { status: 409 });
    return Response.json({ ok: true });
  } catch (e) {
    logError(`market order ${leagueId}`, e);
    return Response.json({ error: "That order didn't go through. Try again." }, { status: 503 });
  }
}
