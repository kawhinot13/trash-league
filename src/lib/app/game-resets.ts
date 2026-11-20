import type { db } from "@/lib/app/db";

type Sql = Awaited<ReturnType<typeof db>>;

/**
 * Days whose daily game was reset so everyone can play it again (owner's call). Each runs once: that
 * day's scores are deleted, and every browser clears its saved game for that day (see PlayGate).
 * 2026-11-20: Trash's Dumpster Dive rejected players picked up and dropped mid-week.
 */
const RESETS: { family: string; game: "dive2"; day: string }[] = [{ family: "1020516596416155648", game: "dive2", day: "2026-11-20" }];
/** Board ids stored for each game (the dive's board moved from "dive" to "dive2"). */
const STORED: Record<string, string[]> = { dive2: ["dive", "dive2"] };

let applied = false;
async function applyResets(sql: Sql) {
  if (applied) return;
  for (const r of RESETS) {
    const fresh = await sql`
      insert into game_resets (family_id, game, day) values (${r.family}, ${r.game}, ${r.day}::date) on conflict do nothing returning 1`;
    if (fresh.length) await sql`delete from game_scores where family_id = ${r.family} and game in ${sql(STORED[r.game])} and day = ${r.day}::date`;
  }
  applied = true;
}

/** The games reset on a day in a league, with a token that changes per reset. */
export async function resetsFor(sql: Sql, familyId: string, day: string): Promise<Record<string, string>> {
  await applyResets(sql);
  const rows = await sql<{ game: string; at: Date }[]>`select game, at from game_resets where family_id = ${familyId} and day = ${day}::date`;
  return Object.fromEntries(rows.map((r) => [r.game, r.at.toISOString()]));
}
