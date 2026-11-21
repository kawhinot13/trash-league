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

-- Shared Sleeper API budget: calls reserved per minute across every instance, and a shared
-- cooldown after a 429 (see throttle.ts).
create table if not exists api_budget (
  window_start  timestamptz primary key,
  used          int not null
);
create table if not exists api_state (
  key    text primary key,
  until  timestamptz not null
);

-- Big Sleeper responses kept so they're fetched rarely (the player list at most once a day,
-- finished weeks of box scores shared between leagues).
create table if not exists sleeper_cache (
  key         text primary key,
  data        jsonb not null,
  fetched_at  timestamptz not null default now(),
  used_at     timestamptz not null default now()
);

-- Import rate limits. Only a salted hash of the address is kept, and only for two days.
create table if not exists rate_events (
  ip_hash  text not null,
  kind     text not null,
  at       timestamptz not null default now()
);
create index if not exists rate_events_lookup on rate_events(ip_hash, kind, at);

-- Leagues that asked to be removed. Data is deleted after a grace period; the ids stay so the
-- league isn't imported again.
create table if not exists removals (
  league_id     text primary key,
  family_id     text not null,
  requested_at  timestamptz not null default now(),
  purge_after   timestamptz not null default now() + interval '7 days',
  purged        boolean not null default false
);
create index if not exists removals_family on removals(family_id);

-- One-time codes proving someone manages a team before a removal or restore (removal.ts).
create table if not exists removal_challenges (
  id          text primary key,
  family_id   text not null,
  league_id   text not null,
  user_id     text not null,
  intent      text not null,
  code        text not null,
  checks      int not null default 0,
  used        boolean not null default false,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists removal_challenges_family on removal_challenges(family_id, user_id);

-- One row per nightly run, for the status page.
create table if not exists cron_runs (
  id           bigserial primary key,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  leagues      int not null default 0,
  snapshots    int not null default 0,
  failed       int not null default 0,
  note         text
);

-- Daily-game leaderboards (honor system, like the Trash site's). Kept 40 days.
create table if not exists game_scores (
  family_id   text not null references families(id) on delete cascade,
  game        text not null,
  day         date not null,
  manager     text not null,
  score       int not null,
  label       text not null default '',
  created_at  timestamptz not null default now(),
  primary key (family_id, game, day, manager)
);

-- Daily-game standings: the one Sleeper user each account plays as, in every league (one each way).
-- An account can only post in leagues where that Sleeper user is a manager.
create table if not exists sleeper_links (
  sleeper_user text primary key,
  account_id   text not null unique,
  created_at   timestamptz not null default now()
);

-- Optional accounts (Sign in with Google). No email or password: Google's account id, a first
-- name, the Sleeper username the person saves and the leagues they've opened. Deletable any time.
create table if not exists accounts (
  id          text primary key,
  google_sub  text not null unique,
  name        text not null default '',
  sleeper     text,
  leagues     jsonb not null default '[]'::jsonb,
  session_v   int not null default 1,
  created_at  timestamptz not null default now(),
  seen_at     timestamptz not null default now()
);
-- Sign-out ends every session (older tables get the column too).
alter table accounts add column if not exists session_v int not null default 1;
-- Site admin (owner), decided at each sign-in from ADMIN_EMAILS; the email itself is never stored.
alter table accounts add column if not exists is_admin boolean not null default false;
-- The recreational-use acknowledgement given when the league was first imported (version + time; nobody's details).
create table if not exists yahoo_links (
  account_id text primary key,
  guid       text not null,
  tokens     text not null,            -- AES-256-GCM sealed { access, refresh, exp }
  linked_at  timestamptz not null default now()
);
create index if not exists yahoo_links_guid on yahoo_links(guid);
-- Unique people who searched a Sleeper username and opened a league from the results (admin count only).
-- Only a keyed hash of the lowercased username: the name itself is never stored.
create table if not exists finder_people (
  h        text primary key,
  first_at timestamptz not null default now(),
  last_at  timestamptz not null default now(),
  opens    int not null default 1
);
-- Imported Yahoo leagues, readable only by their members (guids). id = newest season's league key.
create table if not exists yahoo_leagues (
  id         text primary key,
  name       text not null,
  members    text[] not null default '{}',
  seasons    jsonb not null default '[]',  -- league keys, oldest first
  parts      jsonb not null default '{}',  -- per-season converted data (bundle + weeks), by league key
  dataset    jsonb,
  status     text not null default 'importing',
  error      text,
  use_ack    text,                         -- recreational-use acknowledgement version (no person data)
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table families add column if not exists use_ack text;
-- The finished game itself (what the player answered), so another device shows the same result instead of a replay.
alter table game_scores add column if not exists state jsonb;
-- A daily game in progress, per manager and storage name ("dive3:2026-11-21"), so every device signed in to
-- the same account plays the same game. Only ever moves forward (core/game-state.ts progressOf).
create table if not exists game_progress (
  family_id  text not null,
  manager    text not null,
  name       text not null,
  state      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (family_id, manager, name)
);
-- One-off resets of a day's daily game (owner's call): scores deleted once; browsers clear their saved game.
create table if not exists game_resets (
  family_id text not null,
  game      text not null,
  day       date not null,
  at        timestamptz not null default now(),
  primary key (family_id, game, day)
);
-- Standings links are proven with the same team-name code; the code remembers which account asked.
alter table removal_challenges add column if not exists account_id text;
alter table families add column if not exists use_ack_at timestamptz;
-- The Trash Exchange (Trash pack only): a play-money market on the league's teams. Keyed by the
-- season's league id and the manager's Sleeper user id; money in hundredths. Nothing here is real money.
create table if not exists market_wallets (
  league_id text not null,
  manager   text not null,
  bucks     bigint not null,
  coins     bigint not null default 0,
  hoodies   int not null default 0,
  created_at timestamptz not null default now(),
  primary key (league_id, manager)
);
create table if not exists market_holdings (
  league_id text not null,
  manager   text not null,
  team      text not null,
  shares    int not null,
  primary key (league_id, manager, team)
);
create table if not exists market_teams (
  league_id text not null,
  team      text not null,
  wins      int not null,
  losses    int not null,
  ties      int not null,
  pf        numeric(10,2) not null,
  synced_at timestamptz not null default now(),
  primary key (league_id, team)
);
create table if not exists market_prices (
  league_id text not null,
  team      text not null,
  day       date not null,
  price     bigint not null,
  primary key (league_id, team, day)
);
create table if not exists market_log (
  id        bigserial primary key,
  league_id text not null,
  manager   text not null,
  kind      text not null,              -- buy | sell | coin | hoodie | dividend
  team      text,
  qty       int not null,
  amount    bigint not null,            -- hundredths of the currency spent or received
  at        timestamptz not null default now()
);
create index if not exists market_log_league on market_log(league_id, at desc);
-- Each purchase, kept with its time: a week's dividend only counts shares owned before that week began.
create table if not exists market_lots (
  id        bigserial primary key,
  league_id text not null,
  manager   text not null,
  team      text not null,
  shares    int not null,
  bought_at timestamptz not null default now()
);
create index if not exists market_lots_team on market_lots(league_id, team);
-- Short positions: collateral = the stats-only value at opening (entry, hundredths) per share.
create table if not exists market_shorts (
  id        bigserial primary key,
  league_id text not null,
  manager   text not null,
  asset     text not null,
  shares    int not null,
  entry     bigint not null,
  opened_at timestamptz not null default now()
);
create index if not exists market_shorts_league on market_shorts(league_id, manager);
-- Team shorts placed outside the Monday window wait (pending) for the next weekly result; reserved = BB set aside.
alter table market_shorts add column if not exists pending boolean not null default false;
alter table market_shorts add column if not exists reserved bigint not null default 0;
-- When a team's record last changed (a weekly result posted), for the Monday short window.
alter table market_teams add column if not exists result_at timestamptz;
-- Team orders placed outside the Monday window wait here and go through at Monday's prices (reserved = BB set aside).
create table if not exists market_orders (
  id         bigserial primary key,
  league_id  text not null,
  manager    text not null,
  kind       text not null,             -- buy | sell | cover
  asset      text not null,
  qty        int not null,
  reserved   bigint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists market_orders_league on market_orders(league_id);
-- One-time market changes already applied, per league.
create table if not exists market_meta (league_id text not null, key text not null, primary key (league_id, key));
-- What a payout was for (e.g. "beat KAWH x1.80"), shown in the ledger.
alter table market_log add column if not exists note text;
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
