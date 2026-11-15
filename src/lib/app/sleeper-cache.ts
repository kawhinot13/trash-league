import "server-only";
import { db, hasDb } from "@/lib/app/db";
import { sleeper, type SStatRow, type Stats } from "@/lib/app/sleeper";
import type { Sport } from "@/lib/core/sport";

/**
 * Big Sleeper responses, fetched rarely:
 *  - each sport's player list (2.5 MB raw for basketball, ~5 MB for football): at most once a day,
 *    kept trimmed to name, positions, team;
 *  - a week of box scores (~1.7 MB raw): a finished week never changes, so it's fetched once and
 *    shared by every league in that NBA season (an unfinished week is kept for an hour).
 * Kept in Postgres (shared by every instance) and in memory.
 */
/** pid -> [name, positions, team, height in inches (0 unknown), birth date YYYY-MM-DD or ""] */
export type PlayerDir = Record<string, [string, string[], string, number, string]>;
type StatRow = [pid: string, date: string, stats: Stats, pos: string[], name: string];

const DAY = 24 * 3600_000;
const g = globalThis as unknown as { __rafCache?: Map<string, { at: number; data: unknown }> };
const mem = (g.__rafCache ??= new Map());

async function cached<T>(key: string, maxAgeMs: number, load: () => Promise<T>): Promise<T> {
  const m = mem.get(key);
  if (m && Date.now() - m.at < maxAgeMs) return m.data as T;
  if (hasDb()) {
    const sql = await db();
    const [row] = await sql<{ data: T; fetched_at: Date }[]>`
      update sleeper_cache set used_at = now() where key = ${key} returning data, fetched_at`;
    if (row && Date.now() - row.fetched_at.getTime() < maxAgeMs) {
      remember(key, row.data, row.fetched_at.getTime());
      return row.data;
    }
    const data = await load();
    await sql`
      insert into sleeper_cache (key, data) values (${key}, ${sql.json(data as never)})
      on conflict (key) do update set data = excluded.data, fetched_at = now(), used_at = now()`;
    remember(key, data, Date.now());
    return data;
  }
  const data = await load();
  remember(key, data, Date.now());
  return data;
}
function remember(key: string, data: unknown, at: number) {
  mem.set(key, { at, data });
  while (mem.size > 6) mem.delete(mem.keys().next().value!);
}

type RawPlayer = {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  fantasy_positions?: string[];
  team?: string | null;
  height?: string | number | null;
  birth_date?: string | null;
};

/** Every player Sleeper knows in a sport (trimmed). Refreshed at most daily. */
export function playerDirectory(sport: Sport = "nba"): Promise<PlayerDir> {
  return cached(`players/${sport}/v2`, DAY, async () => {
    const all = (await sleeper<Record<string, RawPlayer> | null>(`/v1/players/${sport}`)) ?? {};
    const out: PlayerDir = {};
    for (const [pid, p] of Object.entries(all))
      out[pid] = [
        p.full_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || pid,
        p.fantasy_positions ?? [],
        p.team ?? "",
        /^\d+$/.test(String(p.height ?? "")) ? Number(p.height) : 0,
        p.birth_date ?? "",
      ];
    return out;
  });
}

/** One week of per-game box scores, trimmed to what scoring and the replay need. */
export async function weekStats(season: string, week: number, final: boolean): Promise<SStatRow[]> {
  const rows = await cached<StatRow[]>(`stats/nba/${season}/${week}`, final ? 365 * DAY : 3600_000, async () => {
    const raw = (await sleeper<SStatRow[] | null>(`/stats/nba/${season}/${week}?season_type=regular`)) ?? [];
    const out: StatRow[] = [];
    for (const r of raw) {
      if (!r.date || !r.stats || r.player_id.startsWith("TEAM")) continue;
      const stats: Stats = {};
      for (const [k, v] of Object.entries(r.stats)) if (v) stats[k] = v;
      if (!Object.keys(stats).length) continue;
      const p = r.player;
      out.push([r.player_id, r.date, stats, p?.fantasy_positions ?? [], `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim()]);
    }
    return out;
  });
  return rows.map(([player_id, date, stats, pos, name]) => {
    const [first_name, ...rest] = name.split(" ");
    return { player_id, date, stats, player: { first_name, last_name: rest.join(" "), fantasy_positions: pos } };
  });
}

/** Nightly housekeeping: drop box-score weeks nobody has used in a week. */
export async function pruneCache() {
  if (!hasDb()) return;
  const sql = await db();
  await sql`delete from sleeper_cache where key like 'stats/%' and used_at < now() - interval '7 days'`;
}
