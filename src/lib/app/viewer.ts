import "server-only";
import { authConfigured, getAccount, sessionFrom } from "@/lib/app/account";
import { db } from "@/lib/app/db";
import { newestSeason } from "@/lib/app/store";

/**
 * Who's looking. Each account is linked to one Sleeper user for every league (picked once), and can
 * only play as that user, only in leagues where they're a manager. Never returns the account id.
 */
export async function viewerOf(req: Request, fid: string) {
  const none = { configured: authConfigured(), signedIn: false, linked: false, member: false, manager: null as string | null, suggest: null as string | null };
  if (!authConfigured()) return { ...none, accountId: null as string | null };
  const s = sessionFrom(req);
  const account = s ? await getAccount(s).catch(() => null) : null;
  if (!account) return { ...none, accountId: null };
  const sql = await db();
  const season = await newestSeason(fid);
  const users = [...(season?.users ?? [])];
  const [link] = await sql<{ sleeper_user: string }[]>`select sleeper_user from sleeper_links where account_id = ${account.id}`;
  const member = !!link && users.includes(link.sleeper_user);
  // Not linked yet: the manager whose Sleeper username matches the one saved on the account, if any.
  const saved = account.sleeper?.toLowerCase();
  const suggest = !link && saved ? ([...(season?.names ?? [])].find(([, n]) => n?.toLowerCase() === saved)?.[0] ?? null) : null;
  return { configured: true, signedIn: true, linked: !!link, member, manager: member ? link.sleeper_user : null, suggest, accountId: account.id };
}

