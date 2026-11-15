import { findLeagues } from "@/lib/app/find";
import { clientIp, take } from "@/lib/app/ratelimit";
import { logError } from "@/lib/app/safe";
import { cleanUsername } from "@/lib/app/validate";

export async function GET(req: Request) {
  const u = cleanUsername(new URL(req.url).searchParams.get("u"));
  if (!u) return Response.json({ error: "Enter a Sleeper username: letters, numbers and underscores." }, { status: 400 });
  const ok = await take("lookup", await clientIp()).catch(() => ({ ok: true as const }));
  if (!ok.ok) return Response.json({ error: `Too many lookups from your network. Try again in ${ok.minutes} minutes.` }, { status: 429 });
  try {
    const out = await findLeagues(u);
    if (!out.user) return Response.json({ error: `No Sleeper user called “${u}”.` }, { status: 404 });
    return Response.json(out, { headers: { "cache-control": "public, max-age=60" } });
  } catch (e) {
    logError("find", e);
    return Response.json({ error: "Sleeper didn't answer. Try again in a moment." }, { status: 502 });
  }
}
