import { connection } from "next/server";
import { getAccount, sameOrigin, sessionFrom } from "@/lib/app/account";
import { unlink, yahooConfigured } from "@/lib/yahoo/oauth";

/** Forget this account's Yahoo tokens (it stops seeing members-only Yahoo leagues until it reconnects). */
export async function POST(req: Request) {
  await connection();
  if (!yahooConfigured() || !sameOrigin(req)) return Response.json({ error: "bad request" }, { status: 400 });
  const s = sessionFrom(req);
  const account = s ? await getAccount(s).catch(() => null) : null;
  if (!account) return Response.json({ error: "Sign in first." }, { status: 401 });
  await unlink(account.id);
  return Response.json({ ok: true });
}
