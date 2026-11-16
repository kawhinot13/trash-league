import { connection } from "next/server";
import { cookieFlags, getAccount, randomToken, safeNext, sessionFrom, sign } from "@/lib/app/account";
import { YAHOO_COOKIE, authorizeUrl, yahooConfigured } from "@/lib/yahoo/oauth";

/** Start "Connect Yahoo" (signed-in Rafterlore accounts only): a one-time state in a signed cookie. */
export async function GET(req: Request) {
  await connection();
  if (!yahooConfigured()) return new Response("Yahoo isn't set up.", { status: 404 });
  const url = new URL(req.url);
  const s = sessionFrom(req);
  const account = s ? await getAccount(s).catch(() => null) : null;
  if (!account) return Response.redirect(new URL(`/api/auth/google?next=${encodeURIComponent("/l/yahoo")}`, url.origin), 302);
  const state = randomToken();
  const cookie = sign("o", { y: 1, state, a: account.id, next: safeNext(url.searchParams.get("next") ?? "/l/yahoo") }, 600);
  return new Response(null, {
    status: 302,
    headers: { location: authorizeUrl(url.origin, state), "set-cookie": `${YAHOO_COOKIE}=${cookie}; ${cookieFlags(600)}`, "cache-control": "no-store" },
  });
}
