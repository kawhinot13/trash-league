import "server-only";
import postgres from "postgres";

/**
 * Postgres for the multi-league app. Any Postgres works (Neon via the Vercel Marketplace sets
 * DATABASE_URL / POSTGRES_URL). Without one, league pages still render straight from Sleeper,
 * but the background import (lineup replay, trade grades) and nightly snapshots need it.
 */
const URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

export const hasDb = () => URL !== "";

type Sql = ReturnType<typeof postgres>;
const g = globalThis as unknown as { __rafSql?: Sql; __rafSchema?: Promise<void> };

function client(): Sql {
  if (!g.__rafSql)
    g.__rafSql = postgres(URL, {
      max: 3,
      idle_timeout: 20,
      connect_timeout: 10,
      // Pooled connection strings (pgbouncer / Neon pooler) don't support prepared statements.
      prepare: false,
      onnotice: () => {},
    });
  return g.__rafSql;
}

const SCHEMA = /* sql */ `
create table if not exists families (
  id            text primary key,          -- the oldest season's league id
  name          text not null,
  custom_pack   text,                      -- e.g. 'trash'; null for the generic experience
  created_at    timestamptz not null default now(),
  refreshed_at  timestamptz not null default now()
);

create table if not exists leagues (
  league_id   text primary key,
  family_id   text not null references families(id) on delete cascade,
  season      text not null,
  status      text not null,
  name        text not null,
  bundle      jsonb not null,              -- league, users, rosters, brackets, draft picks
  fetched_at  timestamptz not null default now()
);
create index if not exists leagues_family on leagues(family_id);

-- One row per league-week once the background import has replayed it.
create table if not exists league_weeks (
  league_id   text not null references leagues(league_id) on delete cascade,
  week        int  not null,
  data        jsonb not null,              -- per-team actual vs best lineup, starters, trades, adds
  final       boolean not null default true,
  updated_at  timestamptz not null default now(),
  primary key (league_id, week)
);

-- Derived results for a whole family (lineup efficiency, trade grades).
create table if not exists analyses (
  family_id    text not null references families(id) on delete cascade,
  kind         text not null,
  data         jsonb not null,
  computed_at  timestamptz not null default now(),
  primary key (family_id, kind)
);

-- Sleeper's official season totals, saved every night. Weekly matchup scores are unreliable;
-- the difference between two snapshots taken on either side of a week is a team's exact score.
create table if not exists pf_snapshots (
  league_id    text not null references leagues(league_id) on delete cascade,
  roster_id    int  not null,
  taken_on     date not null,              -- US Eastern date
  owner_id     text,
  pf           numeric(10,2) not null,
  pa           numeric(10,2) not null,
  ppts         numeric(10,2) not null,
  wins         int not null,
  losses       int not null,
  ties         int not null,
  record       text not null default '',
  weeks_done   int not null default 0,
  taken_at     timestamptz not null default now(),
  primary key (league_id, roster_id, taken_on)
);

create table if not exists jobs (
  id            bigserial primary key,
  kind          text not null,
  family_id     text not null references families(id) on delete cascade,
  status        text not null default 'queued',   -- queued | running | done | failed
  state         jsonb not null default '{}'::jsonb,
  attempts      int not null default 0,
  error         text,
  run_after     timestamptz not null default now(),
  locked_until  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists jobs_one_open on jobs(kind, family_id) where status in ('queued', 'running');
create index if not exists jobs_ready on jobs(status, run_after);
`;

/** The database, with the schema applied once per process. Throws when no database is configured. */
export async function db(): Promise<Sql> {
  if (!hasDb()) throw new Error("No database configured (set DATABASE_URL)");
  const sql = client();
  // Serverless instances can boot together: an advisory lock keeps the DDL from racing.
  g.__rafSchema ??= sql
    .begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(727274)`;
      await tx.unsafe(SCHEMA);
    })
    .then(() => undefined);
  try {
    await g.__rafSchema;
  } catch (e) {
    g.__rafSchema = undefined;
    throw e;
  }
  return sql;
}

/** Today's date in US Eastern time (NBA game dates). */
export const todayET = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
