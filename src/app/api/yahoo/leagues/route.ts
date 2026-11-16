import { connection } from "next/server";
import { getAccount, sessionFrom } from "@/lib/app/account";
import { logError } from "@/lib/app/safe";
import { myNflLeagues } from "@/lib/yahoo/api";
import { importedFor } from "@/lib/yahoo/import";
import { accessToken, linkOf, yahooConfigured } from "@/lib/yahoo/oauth";

/** The signed-in member's Yahoo football leagues (newest season of each), and which are imported. */
export async function GET(req: Request) {
  await connection();
  if (!yahooConfigured()) return Response.json({ configured: false });
  const s = sessionFrom(req);
  const account = s ? await getAccount(s).catch(() => null) : null;
  if (!account) return Response.json({ configured: true, signedIn: false });
  const link = await linkOf(account.id);
  if (!link) return Response.json({ configured: true, signedIn: true, connected: false });
  const token = await accessToken(account.id);
  if (!token) return Response.json({ configured: true, signedIn: true, connected: false, expired: true });
  try {
    const [leagues, imported] = await Promise.all([myNflLeagues(token), importedFor(link.guid)]);
    const have = new Map(imported.map((r) => [r.id, r.status]));
    return Response.json(
      {
        configured: true,
        signedIn: true,
        connected: true,
        leagues: leagues
          .filter((l) => !l.renewed)
          .map((l) => ({ key: l.key, name: l.name, season: l.season, teams: l.teams, supported: l.scoring === "headpoint", status: have.get(l.key) ?? null })),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    logError("yahoo leagues", e);
    return Response.json({ configured: true, signedIn: true, connected: true, error: "Yahoo didn't answer. Try again in a moment." }, { status: 502 });
  }
}
