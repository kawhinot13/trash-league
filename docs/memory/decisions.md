# Decisions log

Why things are the way they are, newest first. One entry per significant decision, including
approaches that were tried and dropped. This repo is public: no secrets, personal data or private
URLs in here. Add an entry whenever a choice would surprise someone reading the code later.

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
