import { db, hasDb } from "@/lib/app/db";

/** A stand-in id that isn't a Sleeper id: its pages 404 at once without touching the database. */
const SKIP = "_";

/**
 * The example league is built ahead of time; every other league is built on its first visit and then served
 * from the cache. If the database can't be reached during the build (it was down when Neon's free compute ran
 * out, 2026-11-28), skip the example rather than fail the whole deploy: it's built on its first visit instead.
 */
export async function generateStaticParams() {
  if (!hasDb()) return [{ leagueId: SKIP }];
  try {
    const sql = await Promise.race([db(), new Promise<never>((_, no) => setTimeout(() => no(new Error("timeout")), 8000))]);
    await Promise.race([sql`select 1`, new Promise<never>((_, no) => setTimeout(() => no(new Error("timeout")), 8000))]);
    return [{ leagueId: "1400952185902120960" }];
  } catch {
    console.warn("[rafterlore] database unreachable at build: the example league will be built on its first visit");
    return [{ leagueId: SKIP }];
  }
}

export default function LeagueLayout({ children }: { children: React.ReactNode }) {
  return children;
}
