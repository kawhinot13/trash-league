import { findLeagues } from "@/lib/app/find";

export async function GET(req: Request) {
  const u = new URL(req.url).searchParams.get("u")?.trim() ?? "";
  if (!/^[\w.\- ]{2,40}$/.test(u)) return Response.json({ error: "Enter a Sleeper username." }, { status: 400 });
  try {
    const out = await findLeagues(u);
    if (!out.user) return Response.json({ error: `No Sleeper user called “${u}”.` }, { status: 404 });
    return Response.json(out, { headers: { "cache-control": "public, max-age=60" } });
  } catch {
    return Response.json({ error: "Sleeper didn't answer. Try again in a moment." }, { status: 502 });
  }
}
