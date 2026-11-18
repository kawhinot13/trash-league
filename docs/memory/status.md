# Status

What exists, what's open, what's known to be broken. Read this at the start of a new task instead
of re-exploring the codebase; update it when work ships. Public repo: nothing sensitive.

## Shipped
- Trash site (`src/app/(trash)`): unchanged by the Rafterlore work.
- Rafterlore (`/l`): username finder; every generic Trash feature for any league: home (banners,
  stats, ticker, Dumpster Dive / Rosterdle / The Lineup with per-league leaderboards), live (table, matchup
  of the week, this week, power rankings, recap, waiver wire), managers (cards, all-time, my guys,
  Lock-In, quiz, profiles), rivals (machine, who owns who), history (seasons, trade court, generated
  trade crimes, almanac, re-draft, time machine, pickups), front office; verified removal; /privacy, /terms;
  share cards (league, manager, rivals); "see an example league" link; /l/status (nightly runs, queue, budget).
- Optional Google sign-in (remembers Sleeper username + recent leagues). Hidden until AUTH_GOOGLE_ID,
  AUTH_GOOGLE_SECRET and AUTH_SECRET are set in Vercel and both domains' callback URLs are registered with Google.
- Sports: Sleeper basketball and football (2026-11-15). Basketball leagues are labeled lock-in or daily
  lineups (detected from games). Player photos replaced by badges on Rafterlore.
- Infrastructure: Neon Postgres in production, nightly cron (10:17 UTC), job queue, shared Sleeper
  throttle, caches, rate limits, redacted logging. League pages are pre-built (ISR) and served from the cache.
- Claude Code setup: secret guard and TypeScript stop hooks, mobile-qa (Haiku) and rules-reviewer
  (Sonnet) agents, `scripts/qa-mobile.mjs`, this memory folder, environment setup script, Sonnet default.
- Design tools kept: UI UX Pro Max and the other design skills, shadcn MCP (21st.dev Magic MCP removed: no key).

- Deploys: Vercel reports each `main` commit's status on GitHub. Check it after pushing:
  `curl -s https://api.github.com/repos/kawhinot13/trash-league/commits/<sha>/status` (public repo).
  The sandbox can't reach the production domain itself.

- Daily-game standings on Rafterlore (signed-in, one Sleeper user per account, All time tab) and the
  recreational-use terms, footer line and import acknowledgement (2026-11-15).

- Trapezoid of Excellence (all-time, current, each past season; backtest) and a separate Playoff report on both
  History pages (2026-11-15).

- History split in two (2026-11-15): History keeps the story (banners, seasons, crimes, almanac, time machine,
  movie, ring inquiry); the new Stats tab has the Trapezoid, playoff report, trade court and re-draft.

- Yahoo Fantasy football, members-only (2026-11-16): needs YAHOO_CLIENT_ID/SECRET in Vercel; untested against live Yahoo yet.

- The Trash Exchange (2026-11-18): Trash-only play-money market, `/l/<trash id>/market` (nav "Market").

## Open tasks and ideas
- Trapezoid: category leagues would need a separate category-dominance model (not built; points leagues only).
- Before a major public or commercial launch: written authorization from Sleeper (see decisions.md).
- Category (non-points) leagues: detection is a heuristic; not supported yet.
- Yahoo (football + basketball, points and categories): parked by the owner. Needs a Yahoo developer app,
  the signed API agreement, user sign-in (OAuth) and network access to Yahoo's hosts.
- Football: the Lineup game still uses basketball-tuned brown thresholds (height within 2 in, etc.); fine but
  could be tuned. Best-ball leagues of either sport are not supported.
- More custom-pack tooling (how other leagues would get their own pack).
- Optional public contact address: set `RAFTERLORE_CONTACT_EMAIL` in Vercel to show it on /privacy and /terms.

## Known issues
- Streaming pages answer 200 even when they render a not-found or notice screen (Next.js streaming);
  those screens carry `robots: noindex`, so crawlers skip them. Unknown URLs get a real 404 (`app/not-found.tsx`).
- The environment setup script was tested by hand but only runs in a fresh session.

## How to verify changes
`npm test` (Vitest, ~10 s; also runs first in `npm run build`, so failures block deploys), `npx tsc --noEmit`, `npx eslint <files>`, `NODE_USE_ENV_PROXY=1 npx next build`, then the
mobile-qa agent (or `node scripts/qa-mobile.mjs <url> <paths>`). Local Postgres: see CLAUDE.md.
