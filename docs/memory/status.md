# Status

What exists, what's open, what's known to be broken. Read this at the start of a new task instead
of re-exploring the codebase; update it when work ships. Public repo: nothing sensitive.

## Shipped
- Trash site (`src/app/(trash)`): unchanged by the Rafterlore work.
- Rafterlore (`/l`): username finder; league overview (banners, standings, all-time, seasons,
  trade court, lineups, pickups, custom pack); manager profiles; rivals (head-to-head per Sleeper);
  this week (live, per Sleeper); verified removal and restore (team-name code); /privacy and /terms.
- Infrastructure: Neon Postgres in production, nightly cron (10:17 UTC), job queue, shared Sleeper
  throttle, caches, rate limits, redacted logging.
- Claude Code setup: secret guard and TypeScript stop hooks, mobile-qa (Haiku) and rules-reviewer
  (Sonnet) agents, `scripts/qa-mobile.mjs`, this memory folder, environment setup script, Sonnet default.
- Design tools kept: UI UX Pro Max and the other design skills, shadcn MCP, 21st.dev Magic MCP
  (inactive until `TWENTY_FIRST_API_KEY` is set).

- Deploys: Vercel reports each `main` commit's status on GitHub. Check it after pushing:
  `curl -s https://api.github.com/repos/kawhinot13/trash-league/commits/<sha>/status` (public repo).
  The sandbox can't reach the production domain itself.

## Open tasks and ideas
- Before a major public or commercial launch: written authorization from Sleeper (see decisions.md).
- Category (non-points) leagues: detection is a heuristic; not supported yet.
- More custom-pack tooling (how other leagues would get their own pack).
- Optional public contact address: set `RAFTERLORE_CONTACT_EMAIL` in Vercel to show it on /privacy and /terms.

## Known issues
- Streaming pages answer 200 even when they render the not-found screen (Next.js streaming);
  fine for people, imperfect for crawlers.
- The site-wide 404 page no longer has the Trash nav and footer (Trash chrome moved into its group layout).
- The environment setup script was tested by hand but only runs in a fresh session.

## How to verify changes
`npx tsc --noEmit`, `npx eslint <files>`, `NODE_USE_ENV_PROXY=1 npx next build`, then the
mobile-qa agent (or `node scripts/qa-mobile.mjs <url> <paths>`). Local Postgres: see CLAUDE.md.
