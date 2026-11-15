import { SESSION_COOKIE, cookieFlags, endSessions, sameOrigin, sessionFrom } from "@/lib/app/account";
import { logError } from "@/lib/app/safe";

/** Sign out: end every session for the account (not just this browser's) and drop the cookie. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return new Response(null, { status: 403 });
  const s = sessionFrom(req);
  if (s) await endSessions(s).catch((e) => logError("sign out", e));
  return new Response(null, { status: 204, headers: { "set-cookie": `${SESSION_COOKIE}=; ${cookieFlags(0)}`, "cache-control": "no-store" } });
}
