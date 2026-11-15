import { after } from "next/server";
import { authorized } from "@/lib/app/auth";
import { kick, runJobs } from "@/lib/app/jobs";

export const maxDuration = 60;

/** Run queued background jobs in this invocation, and chain another while work remains. */
async function tick(req: Request) {
  if (!authorized(req)) return new Response("unauthorized", { status: 401 });
  after(async () => {
    const r = await runJobs(50_000);
    if (r.more) await kick();
  });
  return Response.json({ ok: true }, { status: 202 });
}
export const GET = tick;
export const POST = tick;
