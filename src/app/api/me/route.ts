import { connection } from "next/server";
import { MAX_LEAGUES, SESSION_COOKIE, addLeagues, authConfigured, cookieFlags, deleteAccount, forgetLeague, getAccount, sameOrigin, saveSleeper, sessionFrom } from "@/lib/app/account";
import { isSleeperId } from "@/lib/app/validate";
import { logError } from "@/lib/app/safe";

const json = (body: unknown, init: ResponseInit = {}) =>
  Response.json(body, { ...init, headers: { "cache-control": "no-store", ...(init.headers ?? {}) } });

/** Who's signed in (if anyone), with what they asked Rafterlore to remember. */
export async function GET(req: Request) {
  await connection(); // per request: fresh state, cookies and settings, never prerendered
  if (!authConfigured()) return json({ configured: false, account: null });
  const id = sessionFrom(req);
  try {
    const account = id ? await getAccount(id) : null;
    return json({ configured: true, account: account && { name: account.name, sleeper: account.sleeper, leagues: account.leagues } });
  } catch (e) {
    logError("me", e);
    return json({ configured: true, account: null });
  }
}

/** Save or clear the Sleeper username, or forget a league. */
export async function PATCH(req: Request) {
  const id = sessionFrom(req);
  if (!id || !sameOrigin(req)) return json({ error: "Not signed in." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { sleeper?: string | null; forget?: string; add?: unknown } | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Bad request." }, { status: 400 });
  try {
    if ("sleeper" in body) await saveSleeper(id, body.sleeper ?? null);
    if (typeof body.forget === "string") await forgetLeague(id, body.forget);
    if (Array.isArray(body.add))
      await addLeagues(
        id,
        body.add
          .filter((l): l is { id: string; name: string } => !!l && typeof l === "object" && isSleeperId((l as { id?: unknown }).id) && typeof (l as { name?: unknown }).name === "string")
          .slice(0, MAX_LEAGUES),
      );
    const a = await getAccount(id);
    return json({ account: a && { name: a.name, sleeper: a.sleeper, leagues: a.leagues } });
  } catch (e) {
    logError("me update", e);
    return json({ error: "Couldn't save that. Try again." }, { status: 500 });
  }
}

/** Delete the account and everything it remembered, then sign out. */
export async function DELETE(req: Request) {
  const id = sessionFrom(req);
  if (!id || !sameOrigin(req)) return json({ error: "Not signed in." }, { status: 401 });
  try {
    await deleteAccount(id);
    return json({ ok: true }, { headers: { "set-cookie": `${SESSION_COOKIE}=; ${cookieFlags(0)}` } });
  } catch (e) {
    logError("me delete", e);
    return json({ error: "Couldn't delete the account. Try again." }, { status: 500 });
  }
}
