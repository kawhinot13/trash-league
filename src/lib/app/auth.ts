import "server-only";

/** Cron and job-runner routes: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Without a
 * secret configured they stay open; they only run idempotent work (snapshots, queued jobs). */
export function authorized(req: Request) {
  const secret = process.env.CRON_SECRET || process.env.JOBS_SECRET;
  return !secret || req.headers.get("authorization") === `Bearer ${secret}`;
}
