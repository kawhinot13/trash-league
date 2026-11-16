import { connection } from "next/server";
import { cookieFlags, getAccount, sessionFrom, unsign } from "@/lib/app/account";
import { logError } from "@/lib/app/safe";
import { yahooGuid } from "@/lib/yahoo/api";
import { YAHOO_COOKIE, exchangeCode, saveLink, yahooConfigured } from "@/lib/yahoo/oauth";

const back = (origin: string, path: string) =>
  new Response(null, {
    status: 302,
    headers: [["location", new URL(path, origin).toString()], ["cache-control", "no-store"], ["set-cookie", `${YAHOO_COOKIE}=; ${cookieFlags(0)}`]],
  });

/** Yahoo sends the person back here: check the state, swap the code for tokens, link the account. */
export async function GET(req: Request) {
  await connection();
  const url = new URL(req.url);
  if (!yahooConfigured()) return new Response("Yahoo isn't set up.", { status: 404 });
  const raw = req.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${YAHOO_COOKIE}=([^;]+)`))?.[1];
  const flow = unsign<{ y: number; state: string; a: string; next: string }>("o", raw ? decodeURIComponent(raw) : null);
  const code = url.searchParams.get("code");
  const s = sessionFrom(req);
  const account = s ? await getAccount(s).catch(() => null) : null;
  if (!flow?.y || !code || url.searchParams.get("state") !== flow.state || !account || account.id !== flow.a)
    return back(url.origin, "/l/yahoo?connect=failed");
  try {
    const { tokens, guid } = await exchangeCode(code, url.origin);
    const id = guid ?? (await yahooGuid(tokens.access));
    if (!id) throw new Error("no yahoo guid");
    await saveLink(account.id, id, tokens);
    return back(url.origin, flow.next);
  } catch (e) {
    logError("yahoo connect", e);
    return back(url.origin, "/l/yahoo?connect=failed");
  }
}
