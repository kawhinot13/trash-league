# Decisions log

Why things are the way they are, newest first. One entry per significant decision, including
approaches that were tried and dropped. This repo is public: no secrets, personal data or private
URLs in here. Add an entry whenever a choice would surprise someone reading the code later.

## 2026-11-15: One manager profile for both sites
- Trash's profile page moved into `components/trash/profile.tsx` (`ManagerProfileView` over a Dataset); Trash and
  Rafterlore both render it (Rafterlore falls back to its own profile until a league's import finishes).
- Rico's pop-up overlay (Trash pack) is off on Rafterlore for now; the home ticker adds Trash's live lines
  (climber, faller, streak, top pickup) for in-season leagues.

## 2026-11-15: Telling Rafterlore from Trash
- Same look by request, so the difference is a small "RAFTERLORE" mark above the league name in the nav
  (links to /l), plus the footer wordmark and "· Rafterlore" tab titles. Trash's nav has no mark.

## 2026-11-15: League pages are pre-built (ISR), like Trash's
- Still slow in production after the cache change: pages were rendered per visit (`connection()` in the gate, a
  visitor-IP rate-limit check in the loader), so each visit paid a serverless start. Now pages have no request
  APIs and are served from the cache (~4 ms warm locally), regenerated when data changes or every few minutes.
- First imports moved to the browser (`<Importer>` → rate-limited import API); background refresh/regrade moved
  to `/api/l/[id]/refresh` (pinged after load, at most every 5 min per browser) because pre-built renders can't
  read the clock. Rejected: keeping `after()` refreshes in render (breaks prerendering).

## 2026-11-15: Rafterlore looks exactly like Trash, and is fast
- Owner wants Trash's exact look: dropped the navy "arena" palette; Rafterlore uses Trash's tokens, glass nav,
  hero (league name centered; trophy behind names longer than 8 characters so every word stays readable),
  page intros and footer, with holiday decor off.
- Pages were slow because every visit hit Neon (cold starts) and sometimes Sleeper. Now one shared remote-cache
  read per page (warm loads ~30-100 ms locally), invalidated on new data; Sleeper refreshes in the background.

## 2026-11-15: Rafterlore = the Trash site for any league
- Reuse, don't rewrite: Trash's features moved into `src/lib/core` as pure functions over a dataset;
  Rafterlore produces the same dataset shape per league (checked against Trash: identical champions,
  trades, draft values and lineup optimals). Shared components take a brand with Trash defaults.
- Excluded from the generic site (Trash pack or Trash-only): Rico, the pig, the song, holiday decor,
  story, movie, storm, Mickey Mouse inquiry, nicknames, hand-written trade crimes (Rafterlore
  generates its own from the most lopsided trades).
- Game names on Rafterlore: Deep Cut (dive), Rosterdle (wordle), The Lineup. The dive keeps its
  dumpster art for now. Leaderboards are per league in Postgres (`game_scores`).

## 2026-11-15: Verified league removal
- A Sleeper username is public, so it can't authorize removal. Removal and restore now need a
  one-time code (`RFL-XXXXXX`, 30 min, 8 checks) placed in the requester's own team name in the
  league's newest season; Rafterlore re-reads the league from Sleeper to confirm (`removal.ts`).
  Sleeper has no OAuth for third parties, so this is the strongest proof available without accounts.
  Accepted limits: any verified manager (or the commissioner, who can edit team names) can act for
  the league; the 7-day restore window covers a disgruntled member.
- Licensing: Sleeper's API docs allow non-commercial use and route commercial use to Sleeper for a
  license; their broader terms restrict third-party access. Get written authorization from Sleeper
  before any major public launch or anything commercial.

## 2026-11-15: Claude Code environment
- Kept Claude Code's own model connection. OmniRoute and Headroom's proxy both replace the
  connection the cloud workspace manages (would change auth, could send code to other providers,
  some features exist to dodge provider limits). Cheap work goes to Haiku subagents instead
  (`.claude/agents/mobile-qa.md`); reviews use Sonnet.
- Memory lives in these files, not Claude-Mem: cloud containers are wiped between sessions, and
  Claude-Mem summarizes every tool call with a model (more tokens, or a paid trial).
- Hooks: secret-file guard (PreToolUse) and a Stop-time typecheck + lint of changed TypeScript.
  Plain scripts, no AI calls. The environment's setup script runs `npm ci` so sessions start ready.
- Owner's priority: quality per token, not tool count. Project default model Sonnet; Opus on request.
  Dropped the claude-code-setup plugin after its one-time analysis (would duplicate it every session).
  Agents run only when warranted: mobile-qa after layout changes, rules-reviewer after big diffs.

## 2026-11-15: Rafterlore (multi-league app)
- Name: Rafterlore (was "Rafters", dropped over naming conflicts).
- Non-commercial only: Sleeper's API terms allow free non-commercial use; commercial use needs a
  license. No payments, ads, paywalls, Sleeper logos or "official" look. Footer disclaimer on every page.
- One shared Sleeper budget (500 calls/min across instances, coordinated in Postgres) rather than
  per-route limits: imports, the nightly job and page views all draw from it.
- Rate limits are per network, stored only as salted hashes for two days.
- League removal is self-serve for any member (proved by Sleeper username), with a 7-day restore
  window, because there are no accounts. Ids are kept so a removed league isn't re-imported.
- Stored Sleeper payloads are whitelisted (`sanitizeBundle`): the league object carries the last
  chat message, which must never be stored.

## 2026-11-14: Data accuracy
- Sleeper's weekly matchup endpoint returns different scores for the same finished week. We take
  the highest of several samples ("consensus"), label anything built from it "per Sleeper", and use
  official roster totals for season numbers. Nightly points-for snapshots give exact weekly scores.
- Season discovery follows `previous_league_id`, falling back to `copy_from_league_id` (Trash
  Season 2 lost its link). Family id = oldest season's league id.
- Background jobs live in a Postgres table (no extra service): small resumable steps, leases,
  at most 2 running at once.

## Earlier (Trash site)
- Lenis smooth scroll removed after profiling (with backdrop-blur it caused most dropped frames).
- three.js / react-three-fiber removed (heaviest thing on the site); the trophy is a still render.
