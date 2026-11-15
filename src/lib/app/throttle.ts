/**
 * One shared budget for every call Rafterlore makes to Sleeper's API.
 *
 * Sleeper asks clients to stay under 1000 calls a minute. Rafterlore aims for half that across every
 * server instance together:
 *  - Globally: instances reserve calls in small blocks from a per-minute counter in Postgres.
 *    When the minute's budget is spent, callers wait for the next minute.
 *  - Per instance: calls are paced to a steady rate so one busy instance can't burst.
 *  - On a 429, every instance backs off together (a shared cooldown in Postgres), growing with
 *    each repeat, and honoring Retry-After.
 * Without a database (local dev), only the per-instance pacing and backoff apply.
 */
export const PER_MINUTE = Math.min(800, Number(process.env.SLEEPER_CALLS_PER_MINUTE) || 500);
const BLOCK = 20;
const PER_SECOND = 8;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const g = globalThis as unknown as {
  __rafThrottle?: { tokens: number; window: number; next: number; cooldownUntil: number; strikes: number; chain: Promise<void> };
};
const st = (g.__rafThrottle ??= { tokens: 0, window: 0, next: 0, cooldownUntil: 0, strikes: 0, chain: Promise.resolve() });

type Sql = Awaited<ReturnType<typeof import("@/lib/app/db").db>>;
async function sqlOrNull(): Promise<Sql | null> {
  if (!(process.env.DATABASE_URL || process.env.POSTGRES_URL)) return null;
  try {
    return await (await import("@/lib/app/db")).db();
  } catch {
    return null;
  }
}

/** Reserve a block of calls from this minute's global budget. Returns ms to wait if none left. */
async function reserve(): Promise<number> {
  const sql = await sqlOrNull();
  const minute = Math.floor(Date.now() / 60_000);
  if (!sql) {
    // Local fallback: the same budget, enforced per process.
    if (st.window !== minute) Object.assign(st, { window: minute, tokens: PER_MINUTE });
    return 0;
  }
  try {
    const [cool] = await sql<{ until: Date }[]>`select until from api_state where key = 'sleeper_cooldown' and until > now()`;
    if (cool) return cool.until.getTime() - Date.now();
    const [row] = await sql<{ used: number }[]>`
      insert into api_budget (window_start, used) values (date_trunc('minute', now()), ${BLOCK})
      on conflict (window_start) do update set used = api_budget.used + ${BLOCK}
        where api_budget.used + ${BLOCK} <= ${PER_MINUTE}
      returning used`;
    if (!row) return (minute + 1) * 60_000 - Date.now() + Math.random() * 1500;
    st.tokens += BLOCK;
    st.window = minute;
    return 0;
  } catch {
    // The counter is a safety net, not a dependency: pace locally if it's unreachable.
    if (st.window !== minute) Object.assign(st, { window: minute, tokens: Math.floor(PER_MINUTE / 4) });
    return 0;
  }
}

/** Wait for permission to make one Sleeper call. Calls queue in order within an instance. */
export function acquire(): Promise<void> {
  const turn = st.chain.then(async () => {
    for (;;) {
      const now = Date.now();
      if (st.cooldownUntil > now) {
        await sleep(st.cooldownUntil - now);
        continue;
      }
      const minute = Math.floor(now / 60_000);
      if (st.window !== minute) st.tokens = 0; // unused reservations expire with their minute
      if (st.tokens <= 0) {
        const wait = await reserve();
        if (wait > 0) {
          await sleep(Math.min(wait, 65_000));
          continue;
        }
        if (st.tokens <= 0) continue;
      }
      if (st.next > now) await sleep(st.next - now);
      st.tokens -= 1;
      st.next = Math.max(Date.now(), st.next) + 1000 / PER_SECOND;
      return;
    }
  });
  st.chain = turn.catch(() => {});
  return turn;
}

/** Sleeper said slow down: back off here and tell every other instance. */
export async function rateLimited(retryAfterS: number | null): Promise<number> {
  st.strikes = Math.min(st.strikes + 1, 6);
  const ms = Math.max((retryAfterS ?? 0) * 1000, 5_000 * 2 ** (st.strikes - 1)); // 5s, 10s, 20s ... 160s
  st.cooldownUntil = Date.now() + ms;
  const sql = await sqlOrNull();
  if (sql)
    await sql`
      insert into api_state (key, until) values ('sleeper_cooldown', now() + ${`${Math.round(ms / 1000)} seconds`}::interval)
      on conflict (key) do update set until = greatest(api_state.until, excluded.until)`.catch(() => {});
  return ms;
}

export function succeeded() {
  if (st.strikes > 0) st.strikes -= 1;
}
