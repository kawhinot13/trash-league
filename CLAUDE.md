@AGENTS.md

# Trash League website (Next.js): how to build here

The homepage is the official site of the Trash fantasy basketball league (Sleeper).
Data: `src/data/league.json` (built by `scripts/build-league-data.py` from ../mdv-video/data/raw);
live Season 4 table via `liveStandings()` in `src/lib/league.ts` ('use cache', minutes). In this cloud
sandbox run `next dev`/`next build` with `NODE_USE_ENV_PROXY=1` so server fetches reach Sleeper.
Head-to-head data is from Sleeper's weekly scores and is unreliable: always label it "per Sleeper".

## Data
- `src/data/extras.json` is rebuilt by `python3 scripts/build-extras.py <cache-dir> src/data/extras.json` (Sleeper lineups, box scores, transactions, live player bios). A daily scheduled task reruns it and pushes to `main`.
- Daily-game leaderboards live in Redis via `/api/scores` (env `KV_REST_API_URL` + `KV_REST_API_TOKEN`, or the `UPSTASH_REDIS_REST_*` pair). Without them the boards stay hidden.

## Rafterlore (multi-league app: `/l`, `/privacy`, `/terms`; own domain rafterlore.com)
- rafterlore.com serves the same deployment: `next.config.ts` rewrites its `/` to `/l` and redirects Trash pages
  there (host-matched, so the Trash site is unaffected).
- Product name: Rafterlore (`src/lib/app/brand.ts`). Any Sleeper NBA or NFL head-to-head points league. Sport is
  per league (`src/lib/core/sport.ts`, `FamilyView.sport`, `brand.sport`, `LiveSource.sport`); basketball is the
  default everywhere so Trash is untouched. Football replays weeks from matchup `players_points` (no box scores).
  No player photos on Rafterlore: designed badges (`brand.headshots = "badge"`, `PlayerBadge`); Trash keeps photos. Pages live in
  `src/app/(rafterlore)/` with their own shell; the Trash site lives in `src/app/(trash)/`. Rafterlore never imports Trash
  data or chrome. League pages: overview, this week (live, per Sleeper), rivals, managers + profiles, remove.
- Shared features: `src/lib/core/` holds every league feature as pure functions over a `Dataset` (Trash's
  league.json + extras.json shape) or a `LiveSource`. Trash's `src/lib/*.ts` are thin wrappers passing Trash's data;
  Rafterlore builds each league's dataset in the grade step (`src/lib/app/dataset.ts`, stored in `analyses`).
  Shared UI in `src/components/trash/` takes a brand (`brand.tsx`: photos, links, names, storage keys, leaderboard,
  holiday) whose defaults are Trash's, so Trash renders identically. Change shared code only if Trash's HTML stays
  the same (verify by diffing prerendered pages before/after).
- Rafterlore code: `src/lib/app/` (Sleeper client + throttle, caches, discovery, replay, grading, store, jobs, live
  features, rate limits, validation, redaction). League pages under `src/app/(rafterlore)/l/[leagueId]/`: home
  (games), live, managers (+ profiles), rivals, history, front-office, remove. `gate.tsx` loads a league, handles not
  found / limited / removed / error and wraps pages in the league's brand.
- Look: identical to the Trash site (same palette, GlassNav, Hero with the league name centered, PageIntro, footer),
  minus holiday decor (`holiday={false}`, `.rafterlore .xmas-drift::after` hidden).
- Speed: league pages are pre-built and served from the cache (ISR): no `connection()`, headers, cookies or
  `Date.now()` in their render path. They read `storedLeague()` (`'use cache: remote'`, tagged `family:<id>` and
  `league:<id>`), never the database directly. Unstored leagues render `<Importer>`, which calls the rate-limited
  import API; the client pings `/api/l/[id]/refresh` for in-season Sleeper refreshes and regrades. Call
  `invalidateFamily()` whenever stored data changes (`saveFamily` also drops `league:<id>`). Routine updates use
  "soon" (stale-while-revalidate, nobody waits); "now" only for first import/grade, removal and restore. Live features use the remote cache too.
- "Your leagues" (Rafterlore home): every league opened through Rafterlore, kept until removed (×); searching is
  behind "Add a league". Saved in the browser (`rl:my-leagues`), or on the account when signed in (moved on sign-in).
- Accounts (optional, Sign in with Google; `src/lib/app/account.ts`, `/api/auth/*`, `/api/me`): remember a Sleeper
  username and your leagues. Stores Google's account id, first name, that username and up to 30 leagues;
  no email or password. Needs `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET` (32+ chars) in Vercel; without
  them sign-in is hidden. Sessions are HMAC-signed cookies with a per-account version (sign-out ends every session).
  Read only in API routes and the browser (`useMe`), never in page renders, so pages stay pre-built.
- Admin (`/l/admin`, per request, noindex): owner dashboard of totals and league-level facts, never individual
  people. Admin = Google-verified email listed in `ADMIN_EMAILS` (Vercel env; never in the repo), checked at each
  sign-in; the email is not stored (only `accounts.is_admin`). Others get not-found.
- Traffic: Vercel Web Analytics (`<Analytics />` in the root layout; cookieless; enable in the Vercel dashboard).
- Database: Postgres via `DATABASE_URL` (Neon in production); schema created on first use (`db.ts`).
- Sleeper calls: always through `sleeper()` in `sleeper.ts`. It goes through `throttle.ts` (500 calls/min shared across
  instances via Postgres, 8/s per instance, shared backoff on 429). The player list (daily) and box-score weeks are
  cached in `sleeper_cache` (`sleeper-cache.ts`). Never call Sleeper with raw `fetch`.
- Safety: per-network limits (`ratelimit.ts`: 4 new leagues/hour, 10/day; lookups; removals), only salted IP hashes,
  kept 2 days. At most 2 import jobs run at once. Validate every id/username (`validate.ts`). Log errors with
  `logError`/`safeMessage` (`safe.ts`), never raw errors; visitors only see plain messages. Secrets stay server-side.
- Legal: free and non-commercial (Sleeper's API terms). No payments, ads or paywalls; no Sleeper logo; footer says
  "works with Sleeper leagues, not affiliated with or endorsed by Sleeper". Store only public league data
  (`sanitizeBundle` in `family.ts` strips everything else). Optional `RAFTERLORE_CONTACT_EMAIL` shows on /privacy and /terms.
- Removal: a manager of the newest season proves it with a one-time code in their own Sleeper team name
  (`removal.ts`; a username alone proves nothing), then can remove at `/l/[id]/remove`. Hidden at once, deleted
  after 7 days by the nightly job, ids kept so it isn't re-imported; restorable the same way until then.
- Background jobs: `jobs` table, started after an import, by the page's progress poll, `/api/jobs/tick` and the
  nightly cron. Grading output is versioned (`ANALYSIS_VERSION`); older results regrade on the next visit.
- Nightly cron (`vercel.json`, 10:17 UTC, needs `CRON_SECRET`): housekeeping and purges, refresh every league, save
  official points for into `pf_snapshots`, queue the incremental import. Each run is logged in `cron_runs`;
  `/l/status` shows whether last night ran and failures.
- Numbers: season efficiency uses official totals; anything from weekly matchups (H2H, live, single weeks) says "per Sleeper".
  Words follow the lineup type (`brand.lineup`, `lineupTerms` in `core/lineup-terms.ts`): a "start" is a week in
  the starting lineup, so lock-in leagues say "lock-ins" (Lock-In Index), daily ones "weeks in the lineup" and
  football "starts" (both "Lineup Index"). Never hard-code Trash's years or lineup size in shared copy.
  No live in-week scores for basketball (Sleeper's are wrong; owner's rule: only show scoring that's verified).
  Football live scores are shown: weekly matchup scores sum to the official totals (checked).
- Custom packs (`src/packs/`): league-only features for one league. The Trash pack loads only for Trash's seasons.
  Never put league-specific features in the generic components.
- Local testing: Postgres binaries in `/usr/lib/postgresql/16/bin`; run `DATABASE_URL=... NODE_USE_ENV_PROXY=1 next dev`.

## Workflow (memory, agents, hooks)
- Memory: read `docs/memory/status.md` at the start of a task instead of re-exploring; update it and
  `docs/memory/decisions.md` (dated, why + rejected options) when significant work ships. Public repo:
  never put secrets or personal data there.
- Agents (`.claude/agents/`): `mobile-qa` (Haiku) only after layout/visual changes, on the touched pages;
  `rules-reviewer` (Sonnet) only after significant changes. Never for trivial edits; no background agents.
- Hooks (`.claude/settings.json`): a guard blocks reading .env/key files and printing secret env vars;
  a Stop hook typechecks + lints changed TypeScript and blocks with the errors.
- Models: project default is Sonnet (`.claude/settings.json`); Haiku for simple delegated checks; switch to
  Opus with `/model` only for hard architecture or debugging. Claude Code's own connection only: no routing
  proxies, external providers, paid services or cloud memory (see decisions.md).

## Shipping
- The owner wants finished work live: after committing, always push it to `main` too (the site deploys from `main`). No need to ask first.

## Taste
- Premium pro-franchise feel for a joke league: arena banners, hardwood, evidence lockers. Never generic AI-template looks.
- Motion should feel smooth and intentional, never overdone. Respect `prefers-reduced-motion`.
- Must work well on mobile: check phone width, no horizontal scroll, touch-friendly.
- Use the `frontend-design`, `impeccable`, `emil-design-eng` and `gsap-animation` skills when designing or animating.

## Stack conventions
- GSAP: always import from `@/lib/gsap` (plugins ScrollTrigger + SplitText + useGSAP are registered there). Use `useGSAP` with `gsap.matchMedia()` for reduced-motion handling.
- Scrolling is native. Lenis was removed after profiling: together with `backdrop-blur` it caused most dropped frames. Don't add smooth-scroll libraries or scroll pinning/scroll-jacking.
- Text is never cut off: no `truncate` on names/labels (wrap with `break-words`, `flex-wrap` on flex rows); the only
  exception is the league name in the nav. Section-title masks (`.reveal-line-mask`) leave room for descenders.
- Performance: no `backdrop-blur` on content cards (only the fixed nav and mobile menu). Animate transform/opacity only. The hero trophy is a still render (`public/trophy.webp`), not live WebGL; keep heavy 3D off the critical path.
- Motion (Framer Motion): `import { motion } from "motion/react"` for hover, tap, enter/exit and in-view fades.
- 3D: the three.js / react-three-fiber stack was removed (it was the heaviest thing on the site). If 3D ever comes back, load it with `next/dynamic` + `ssr: false` and keep it off the critical path.
- Palette tokens in `globals.css`: `--bin` (dumpster green page), `--bin-2/3`, `--paper`, `--muted`, `--gold` (champions only), `--wood` (the court), `--ticket` (scandals only). Fonts: Big Shoulders (`font-display`), Archivo (`font-sans`).

## Design resources (use these for every UI change)
- **UI UX Pro Max** skill (`.claude/skills/ui-ux-pro-max`): run
  `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <style|ux|gsap|typography|color>`
  for targeted guidance and the pre-delivery checklist. Its `--design-system` output is generic
  (it suggested red sports colors); keep this site's palette and only adopt results that fit the brief.
  Sister skills installed alongside: design, design-system, ui-styling, brand, banner-design, slides.
- **21st.dev**: research components at `https://21st.dev/s/<category>` (navbar, background, text, number...).
  Installing from 21st.dev needs an API key; most popular items originate from Magic UI / Aceternity /
  React Bits, so install those originals via the registries below. The Magic MCP is configured in
  `.mcp.json` and activates in a new session once `TWENTY_FIRST_API_KEY` is set.
- **SVGL** (real brand logos): `curl "https://api.svgl.app?search=<brand>"`, then download the `route` SVG.
  No Sleeper or NBA logos exist there; never fake brand marks.
- **Visual reference: frax.com** (inspiration only, never copy): cinematic full-bleed hero, rim-lit
  horizon glow, translucent glass layers, floating 3D objects, slim sticky dark nav.

## Component sources (shadcn MCP + registries in components.json)
- `npx shadcn@latest add @magicui/<name>` (Magic UI: animated text, shimmer buttons, marquees, particles)
- `npx shadcn@latest add @aceternity/<name>` (Aceternity: spotlight, 3D cards, background beams)
- `npx shadcn@latest add @react-bits/<Name>-TS-TW` (React Bits: cursor effects, backgrounds, text effects)
Restyle pulled components to the editorial palette; don't ship their default look.

## Video
The Remotion project lives next door in `../mdv-video` (separate repo, its own Remotion skills).
