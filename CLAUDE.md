@AGENTS.md

# Trash League website (Next.js): how to build here

The homepage is the official site of the Trash fantasy basketball league (Sleeper).
Data: `src/data/league.json` (built by `scripts/build-league-data.py` from ../mdv-video/data/raw);
live Season 4 table via `liveStandings()` in `src/lib/league.ts` ('use cache', minutes). In this cloud
sandbox run `next dev`/`next build` with `NODE_USE_ENV_PROXY=1` so server fetches reach Sleeper.
Head-to-head data is from Sleeper's weekly scores and is unreliable: always label it "per Sleeper".

## Data
- `src/data/extras.json` is rebuilt by `python3 scripts/build-extras.py <cache-dir> src/data/extras.json` (Sleeper lineups, box scores, transactions, live player bios). A daily scheduled task reruns it and pushes to `main`.
- Rosterdle/Trashle and The Lineup: from 2026-11-16 every league of a sport (Trash included) gets the same player each
  day, from `src/data/daily-pool.json` (append-only; `scripts/build-daily-pool.py`; `core/daily-pool.ts`, The Lineup
  walks its own order). Each league keeps its own history clues ("never" when nobody there rostered him). The
  daily extras build refreshes pool teams with `--refresh-only`. Never reorder or remove pool entries.
- Dumpster Dive has a written calendar (`Calendar` in `core/dive.ts`, `extendCalendar`): days already written never
  change; the next 30 are planned from the data. Trash: `src/data/dive-calendar.json`, extended by `npm run calendar`
  in the daily refresh. Rafterlore: `Dataset.diveCalendar`, extended in the grade step (jobs.ts). Saved games keep
  their questions (`qs`). Never edit a past or current day; hand-picked days go in `PINNED` before they're written.
  Pack leagues on Rafterlore (Trash) plan AND show questions through `packDataset` (packs/view.ts: nicknames + the
  pack's `leagueName`, flag `diveNames: 2`), so planned texts always match what the page builds; a text mismatch
  silently swaps questions (that broke the 2026-11-18 picks). `PINNED` texts must exist in Trash's pool
  (tests/dive-calendar.test.ts, also checks no repeats). From `BROAD_FROM` (2026-11-20) planned days have one NBA-team
  question and at most `MAX_WHO` (2) manager questions (owner: broad over who-owned-whom); v4 types Positions and
  Season rosters plan only from then; `OVERUSED` shapes rest 10 days after RESTART. NBA-team questions count every team a player
  has played for in the league's seasons (box scores record each game's team: `weekTeams`, `extras.teamsPlayed`,
  built in the grade step; Rafterlore only) plus his team today. From `BIG_NIGHT_FROM` (2026-11-20): the season-average
  question uses a lower bar (25+ answers) and "Big nights" asks for one N+ start (lock-in leagues: "had an N+ lock-in";
  bar = highest with 100+ answers, Trash 80+; `extras.bigNights` from Sleeper's starter points, Rafterlore only).
  Prompts can carry `from`/`to` days so planned days switch questions without touching written ones. The owner cares about Rafterlore; the Trash site is now
  titled "Test Trash Fantasy" (test copy).
- Daily-game leaderboards live in Redis via `/api/scores` (env `KV_REST_API_URL` + `KV_REST_API_TOKEN`, or the `UPSTASH_REDIS_REST_*` pair). Without them the boards stay hidden.

## Rafterlore (multi-league app: `/l`, `/privacy`, `/terms`; own domain rafterlore.com)
- rafterlore.com serves the same deployment: `next.config.ts` rewrites its `/` to `/l` and redirects Trash pages
  there (host-matched, so the Trash site is unaffected).
- Product name: Rafterlore (`src/lib/app/brand.ts`). Any Sleeper NBA or NFL head-to-head points league. Sport is
  per league (`src/lib/core/sport.ts`, `FamilyView.sport`, `brand.sport`, `LiveSource.sport`); basketball is the
  default everywhere so Trash is untouched. Football replays weeks from matchup `players_points` (no box scores).
  No player photos on Rafterlore: designed badges (`brand.headshots = "badge"`, `PlayerBadge`); Trash keeps photos.
  Exception (owner's call 2026-11-17): Trash's own league on Rafterlore (pack "trash") shows Sleeper headshots; never
  other leagues, never use it as Rafterlore's public demo, and switch it back to badges if Rafterlore ever earns money. Pages live in
  `src/app/(rafterlore)/` with their own shell; the Trash site lives in `src/app/(trash)/`. Rafterlore never imports Trash
  data or chrome. League pages: overview, this week (live, per Sleeper), waivers, rivals, managers + profiles.
- Shared features: `src/lib/core/` holds every league feature as pure functions over a `Dataset` (Trash's
  league.json + extras.json shape) or a `LiveSource`. Trash's `src/lib/*.ts` are thin wrappers passing Trash's data;
  Rafterlore builds each league's dataset in the grade step (`src/lib/app/dataset.ts`, stored in `analyses`).
  Shared UI in `src/components/trash/` takes a brand (`brand.tsx`: photos, links, names, storage keys, leaderboard,
  holiday) whose defaults are Trash's, so Trash renders identically. Change shared code only if Trash's HTML stays
  the same (verify by diffing prerendered pages before/after).
- Rafterlore code: `src/lib/app/` (Sleeper client + throttle, caches, discovery, replay, grading, store, jobs, live
  features, rate limits, validation, redaction). League pages under `src/app/(rafterlore)/l/[leagueId]/`: home
  (games), live, waivers, managers (+ profiles), rivals, history, stats, front-office. `gate.tsx` loads a league, handles not
  found / limited / removed / error and wraps pages in the league's brand.
- Logo: the ribbon R (owner's design), one traced path in `components/app/mark-path.ts` (`RMark`, `RLoader` in
  `mark.tsx`; green #013825). Assets in `public/brand/` (adaptive tab SVG, PNG tiles, .ico, webmanifest);
  rafterlore.com's `/favicon.ico` is rewritten to the R. Trash keeps its own favicon (`public/favicon.ico`).
- Look: identical to the Trash site (same palette, GlassNav, Hero with the league name centered, PageIntro, footer).
  Holiday decor follows the same `HOLIDAY` switch as Trash (snow, lights, santa hat, countdown, "Merry Christmas"),
  but never the Trash song (`music={false}`) or "Trashmas".
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
- Daily-game standings (Rafterlore): with sign-in on, only signed-in accounts post (`/api/l/[id]/scores`). Each account
  links to one Sleeper user (`sleeper_links`, unique both ways). No code (owner's call), but an account can only be
  the manager whose username is saved on it (`accounts.sleeper`, saved on search, or set by tapping your team in the gate: with no saved username,
  `PlayGate` shows the league's managers to pick, claimed ones greyed out; typing stays as a fallback). Before a
  game starts, `PlayGate` (uses `/api/l/[id]/scores?who=1`) asks "Who are you?" once (first game only), and in leagues
  that manager isn't in it shows "You're not in this league" instead of the game. First account to claim a manager keeps them. One try a day on any device: the finished game (answers) is saved with the score (`game_scores.state`) and
  `PlayGate` restores it before the game mounts; older scores without it show "You already played today". Today / This week / All time / High scores (scores kept ~a year; boards refresh every 20 s while visible). With sign-in
  on, Rafterlore's daily games require signing in (`PlayGate` in components/app/play-gate.tsx; client-side, pages stay
  pre-built; without the auth env everyone plays). Trash keeps its honor-system board (no `viewer` in its API).
- Recreational use: Rafterlore is a history/analytics/entertainment site with no link to betting. First import of a
  league requires the acknowledgement (`use-ack.ts`; import API returns 428 without it); stored as version + time on
  `families` only, and in the browser (`rl:use-ack`). Terms have "Recreational and informational use"; footer line says
  "independent ... for recreational and informational use only". Never mention the owner's personal circumstances.
- Admin (`/l/admin`, per request, noindex): owner dashboard of totals and league-level facts, never individual
  people. Admin = Google-verified email listed in `ADMIN_EMAILS` (Vercel env; never in the repo), checked at each
  sign-in; the email is not stored (only `accounts.is_admin`). Others get not-found. "People" = unique Sleeper usernames
  that searched and opened a league (`finder_people`: keyed HMAC of the lowercased username only, never the name;
  `/api/l/find/opened`, sent by the Finder on open). Plus 8-week series, accounts, proven managers, Yahoo, plays.
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
  Exception: Yahoo leagues (private) are stored for, and shown only to, their own managers (below).
- Yahoo Fantasy football (`src/lib/yahoo/`, `/api/yahoo/*`, `/l/yahoo`, `/y/[key]/*`): official Yahoo API, non-commercial,
  text credit "League data from Yahoo Fantasy", no Yahoo logo. Needs `YAHOO_CLIENT_ID` + `YAHOO_CLIENT_SECRET` (+ optional
  `YAHOO_REDIRECT_URI`) and Google sign-in; hidden otherwise. A signed-in account connects Yahoo (OAuth; tokens AES-GCM
  sealed in `yahoo_links`). Import is per member request, one season per step (`import.ts`), converted to Sleeper-shaped
  bundles (`adapter.ts`, players mapped to Sleeper ids via Sleeper's `yahoo_id`) so `analyse`/`buildDataset` and every
  shared feature run unchanged. `/y/*` pages are MEMBERS ONLY, rendered per request (`YahooGate`: signed in + Yahoo
  linked + guid in league members, else notFound), noindex, never cached for others. Brand `source: "Yahoo"` makes shared
  copy say Yahoo (`<Src />`). Head-to-head points leagues only; no Live/Front office for Yahoo (those use Sleeper live data).
- No league removal (owner's call, 2026-11-17): there is no remove page or API; privacy/terms say leagues stay once
  brought in and Rafterlore may remove one at its discretion (by hand, in the database). Leagues removed before that
  stay hidden and are purged by the nightly job as before. `removal.ts` remains only for the old team-name code proof.
- Background jobs: `jobs` table, started after an import, by the page's progress poll, `/api/jobs/tick` and the
  nightly cron. Grading output is versioned (`ANALYSIS_VERSION`); older results regrade on the next visit.
- Nightly cron (`vercel.json`, 10:17 UTC, needs `CRON_SECRET`): housekeeping and purges, refresh every league, save
  official points for into `pf_snapshots`, queue the incremental import. Each run is logged in `cron_runs`;
  `/l/status` shows whether last night ran and failures.
- Exact weekly team scores = change in official points for between saved totals, kept only when it equals the
  opponent's change in points against (`core/official.ts`, earliest capture per week). Never estimate a missing one.
- Numbers: season efficiency uses official totals; anything from weekly matchups (H2H, live, single weeks) says "per Sleeper".
  Words follow the lineup type (`brand.lineup`, `lineupTerms` in `core/lineup-terms.ts`): a "start" is a week in
  the starting lineup, so lock-in leagues say "lock-ins" (Lock-In Index), daily ones "weeks in the lineup" and
  football "starts" (both "Lineup Index"). Never hard-code Trash's years or lineup size in shared copy.
  No live in-week scores for basketball (Sleeper's are wrong; owner's rule: only show scoring that's verified).
  Football live scores are shown: weekly matchup scores sum to the official totals (checked).
- Stats page (`/stats`, `/l/[id]/stats`; split from History, which keeps the story): Trapezoid of Excellence,
  Playoff report, trade court, re-draft (+ best pickups on Rafterlore).
- Trapezoid of Excellence + Playoff report (Stats page, both sites): pure math in `core/trapezoid.ts`, UI in
  `components/trash/trapezoid.tsx` / `playoff-report.tsx`. Win % = W/(W+L+T); PF = official regular-season PF /
  weeks (median leagues: games/2); Scoring Index = avg / league avg x 100 (all-time weighted by weeks). Window from the
  league's own champions, only seasons BEFORE the one charted (no leakage); config in `TRAP_CONFIG`. Playoff scores are
  per Sleeper (weekly) and compared only with per-Sleeper regular weeks. Never move the window to fit champions.
- Custom packs (`src/packs/`): league-only features for one league. The Trash pack loads only for Trash's seasons.
  Never put league-specific features in the generic components.
- The Trash Exchange (`/l/[id]/market`, Trash pack only; `src/packs/trash/market/`, `/api/l/[id]/market`): play-money
  market on Trash's teams. Bushy Bucks (cash, 1,000 to start), Perren Coin (per share per official win: opponent's value ÷
  winner's value before the result, 0.5 to 3, `upset`/`payoutPerShare`; ½ for a tie; pairings from Sleeper's schedule only;
  buy at 40 BB a coin, cash in at 30 (`COIN_BACK`); net worth counts coin at 30), Xan Purple Hoodies (bought with coin, never sold, each sold raises the next; standings rank
  hoodies, then net worth). Price = fair value from official PF + record (`fairValues`) x (1 + 0.4% per share held
  league-wide); buy/sell along the same curve, so a round trip is exact. Money in hundredths; orders and dividends run
  under a per-league lock. Managers only, as their linked Sleeper user (PlayGate); nobody can buy their own team. Other leagues: 404 / disabled.
  Coin goes only to shares owned before the paid week's Monday 7 PM ET (`market_lots`); sells take the newest first. Every transaction (buys, sells, swaps, hoodies, payouts) is public in "The ledger"; tapping a name (standings or
  ledger) opens that manager's public portfolio (`portfolios`: cash, coin, hoodies, holdings, shorts at today's values).
  Nothing can be bought with or cashed out for real money; keep it that way. Resets each season (keyed by league id).
  Player stocks (owner's call 2026-11-18, play money only, no entry fee/prizes, Trash only): asset id `p:<pid>`, price =
  60% last-5-games average (`RECENT_GAMES`) + 40% season average (Trash scoring on Sleeper box scores, `playerBoard`, `formFair`;
  pulled toward 15 under 5 games; injured players hold, since no new games); NO coin/dividends; same curve and lots; you CAN buy players on your own roster (owner's call), never your own team. Board covers
  rostered players plus anyone who has played (dropped players stay sellable); computed outside the order lock.
  Player charts are daily, always redrawn with the current formula from box scores (from his 5th game; saved closing
  prices are not used for players, so a formula change can't leave fake dips);
  Player trades made before the last-5 formula were re-priced once as if it had always applied (`repriceOnce`,
  `repriceTrades`: that day's value from box scores + holdings at the time; differences refunded or charged, shares
  given back if cash runs short; ledger "reprice"). If the player formula ever changes again, do the same.
  every chart (teams too) ends on today's live price.
  The Great Storm (asset `storm`, ticker STORM; owner's lore: Junkyard Dog + KawhiNot warned the league before Season 4):
  value = average of the two team values (`stormFair`), coin = average of their per-share payouts, x1.5 when both win
  (`stormPayout`, ledger "Storm week"); same lots/curve; the two members can't buy it (`STORM_MEMBERS` usernames).
  Shorts (teams + players, not STORM; owner's call 2026-11-19): `market_shorts`, collateral = stats-only fair value
  (not spot, so buying can't set one up), close pays `shortValue` = 2x entry - value now, clamped 0..2x; no coin;
  not your own team or own-roster players; player shorts obey the game lock; counted in net worth.
  Team stocks (teams + STORM/companies) trade Mondays only (owner's call 2026-11-19): every team order (buy, sell,
  short, close) works only Monday ET before 7 PM once last week's results posted (`teamWindowOpen`,
  `market_teams.result_at`); closed the rest of the week, no waiting orders (any were refunded once,
  `refundWaitingOnce`). Coin counts shares owned before Monday 7 PM of the paid week (`GAME_TIME_MS`). Team buys/shorts
  from Nov 16-19 were backdated to that Monday 6:59 PM (`backdateOnce`, `market_meta`). Player stocks stay daily.
  Tickers: made from nicknames, except owner-chosen ones in `TICKERS` (by Sleeper username): JYD, DILL, LAZ, JRIV, LINR.
  Desk shows holdings, then a "Portfolio mix" donut (`Mix`: Bushy Bucks, Teams, Players, Perren Coin at 30,
  Companies, Shorts; fixed slot order, palette validated on --bin-2 with the dataviz validator; hoodies not counted).
  Over/under-performing (Teams tab panel + "expected N wins" per row): `expectedWins` = Pythagorean (exponent 14)
  from official PF and PA; luck = actual wins minus expected. Official totals only.
  Player trading locks while his NBA team plays (`lockedTeams`: from tip-off per Sleeper's schedule, or 7 PM ET on a
  game day, until 6 AM ET next day; fails closed if the schedule can't be read). Trading is otherwise any time, daily.
  Charts (sparkline per row, full chart with 1W/1M/All + crosshair when a team is open): `priceHistory` = market
  closing prices, and before the market opened each night's fair value from `pf_snapshots` (full nights only). Weeks
  before the first saved night are rebuilt (`weeklyBackfill`) only if every team's weekly scores sum exactly to that
  night's official total; they don't for Trash Season 4, so its charts start at the first saved night (2026-11-14).
- Tests (`tests/*.test.ts`, Vitest, `npm test`): the math behind the numbers (official weekly scores, lineup and
  trade finder, team analyzer, Trapezoid, Dumpster Dive prompts, saved daily games). `npm run build` runs them first,
  so a failing test stops the Vercel deploy. Add a test with every math change or bug fix; pure functions only.
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
  React Bits, so install those originals via the registries below. The 21st.dev Magic MCP was removed
  from `.mcp.json` (no API key, it failed every session); add it back only once `TWENTY_FIRST_API_KEY` is set.
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
