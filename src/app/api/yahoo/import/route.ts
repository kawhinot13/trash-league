import { connection } from "next/server";
import { getAccount, sameOrigin, sessionFrom } from "@/lib/app/account";
import { clientIp, take } from "@/lib/app/ratelimit";
import { logError, safeMessage } from "@/lib/app/safe";
import { isLeagueKey } from "@/lib/yahoo/api";
import { USE_ACK_VERSION } from "@/lib/app/use-ack";
import { failImport, importStep, removeYahooLeague, startImport, yahooLeague } from "@/lib/yahoo/import";
import { accessToken, linkOf, yahooConfigured } from "@/lib/yahoo/oauth";

export const maxDuration = 60;

/**
 * Members only. { start: key } begins importing a league the member is in; { step: id } fetches the
 * next season (call until ready); { refresh: id } re-fetches the newest season and regrades.
 */
export async function POST(req: Request) {
  await connection();
  if (!yahooConfigured() || !sameOrigin(req)) return Response.json({ error: "bad request" }, { status: 400 });
  const s = sessionFrom(req);
  const account = s ? await getAccount(s).catch(() => null) : null;
  if (!account) return Response.json({ error: "Sign in first." }, { status: 401 });
  const link = await linkOf(account.id);
  const token = link ? await accessToken(account.id) : null;
  if (!link || !token) return Response.json({ error: "Connect your Yahoo account first." }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { start?: string; step?: string; refresh?: string; ack?: string; remove?: string } | null;
  try {
    if (b?.start !== undefined) {
      if (!isLeagueKey(b.start)) return Response.json({ error: "bad request" }, { status: 400 });
      if (b.ack !== USE_ACK_VERSION) return Response.json({ error: "Confirm Rafterlore is for recreational and informational use first." }, { status: 428 });
      const ok = await take("new_league", await clientIp()).catch(() => ({ ok: true as const }));
      if (!ok.ok) return Response.json({ error: "Too many new leagues from your network. Try again later." }, { status: 429 });
      const r = await startImport(token, link.guid, b.start, USE_ACK_VERSION);
      return "error" in r ? Response.json(r, { status: 400 }) : Response.json(r);
    }
    if (b?.remove !== undefined) {
      if (!isLeagueKey(b.remove)) return Response.json({ error: "bad request" }, { status: 400 });
      const removed = await removeYahooLeague(b.remove, link.guid);
      return removed ? Response.json({ removed: true }) : Response.json({ error: "Only a manager in its current season can remove it." }, { status: 403 });
    }
    const id = b?.step ?? b?.refresh;
    if (!isLeagueKey(id)) return Response.json({ error: "bad request" }, { status: 400 });
    const row = await yahooLeague(id);
    if (!row || !row.members.includes(link.guid)) return Response.json({ error: "Not found." }, { status: 404 });
    if (b?.refresh !== undefined) {
      // Refreshes re-read a whole season from Yahoo: keep them occasional.
      const ok = await take("lookup", await clientIp()).catch(() => ({ ok: true as const }));
      if (!ok.ok) return Response.json({ error: "slow down" }, { status: 429 });
    }
    try {
      return Response.json(await importStep(token, id, b?.refresh !== undefined));
    } catch (e) {
      logError(`yahoo import ${id}`, e);
      await failImport(id, safeMessage(e));
      return Response.json({ error: "Yahoo didn't answer. Try again in a moment." }, { status: 502 });
    }
  } catch (e) {
    logError("yahoo import", e);
    return Response.json({ error: "Something went wrong. Try again in a moment." }, { status: 500 });
  }
}
