# Decisions log

Why things are the way they are, newest first. One entry per significant decision, including
approaches that were tried and dropped. This repo is public: no secrets, personal data or private
URLs in here. Add an entry whenever a choice would surprise someone reading the code later.

## 2026-11-16: Admin "People" count
- Owner wanted a count of unique people: each distinct Sleeper username that searches and then opens a league counts
  once (same username, other leagues: still one). Stored as a keyed HMAC (AUTH_SECRET) of the lowercased username so
  it can be counted but not read back; rejected storing usernames (admin must never list people). Counting only on
  open (not on search) so typos and browsing don't inflate it. Disclosed on /privacy.

## 2026-11-16: Yahoo Fantasy football (members only)
- Owner chose members-only over public pages (Yahoo leagues are private; Rafterlore otherwise promises public data only).
  Official API + per-member OAuth; pages render per request behind a membership check. Rejected: public ISR pages from
  one member's import (privacy/terms risk); ESPN (no official API; private leagues need users' cookies).
- Adapter, not a rewrite: Yahoo data becomes Sleeper-shaped bundles + replayed weeks, so grading and UI are shared.
  Players map to Sleeper ids via Sleeper's `yahoo_id`, so the daily-game pool and badges work.
- Couldn't read Yahoo's terms pages from the sandbox (blocked hosts); built conservatively: non-commercial, text credit,
  no logo, data only for members, disconnect/remove delete data. The owner must apply for Yahoo API access and sign
  Yahoo's agreement. The Yahoo JSON parsing was tested against hand-made fixtures in Yahoo's documented shape, not real
  responses: expect fixes after the first real import.
- Not built yet: daily-game standings for Yahoo leagues (games play, no board), nightly refresh (members' visits refresh
  every 6h in season), Live/Front office, category leagues, basketball.

## 2026-11-16: Phone navigation and load weight
- Phones get an app-style bottom tab bar (GlassNav's TabBar: Home, Live, Front office, Stats, More; More opens a sheet with
  the rest). Owner asked for Front office in the bar; Daily games is a short "Games" pill in the top bar. Desktop/iPad (md+) unchanged. Body has bottom padding on phones; fixed bottom elements sit above the bar.
- The holiday song was preloaded (3.6 MB on every Trash page); now `preload="none"`, so it downloads only when played.
- Game pages pass one shared player map to all three games (it was serialized three times).
- Front office compacted on phones (2-up rank cards, "Analyze trade" under the note, less nested padding).

## 2026-11-16: Daily games require sign-in (Rafterlore)
- Owner wants the games to drive sign-ups. `PlayGate` swaps each game for a "Sign in to play" card when signed out
  (replaces the old StandingsNudge). Client-side only: pages stay pre-built and the answer still ships in the
  bundle, so it's an invitation, not security. Trash has no accounts and is unchanged. Without the auth env vars
  everyone can play (so a misconfigured deploy never locks the games).

## 2026-11-15: Same Rosterdle / Lineup player for every league of a sport
- Owner's call: everyone gets the same daily player per sport (Trash too). A committed, append-only pool of the
  150 top-ranked Sleeper players per sport (football: QB/RB/WR/TE), shuffled once; day n uses entry n. The
  Lineup has its own order so it never echoes Rosterdle. Starts 2026-11-16 so nobody's game changed mid-day.
- Rejected: picking from a live Sleeper list at runtime (a re-rank or a deploy could change today's answer).
- League-specific clues stay (top owner, weeks, first season); "Nobody"/"Never" for players a league never had.

## 2026-11-15: Mobile pass (phones only; desktop unchanged)
- Owner: pages felt spread out on phones. Section spacing and titles shrink below md; Matchup of the Week is
  side by side; roster cards are two across; power-ranking cards are tighter; waiver intel shows 10 rows and
  the trade court 4 trades on phones with "show more" (`usePhone()` in components/trash/use-phone.ts; server
  render = desktop counts, trimmed after hydration). Live ~25% shorter, Managers ~35%, Stats ~20%.
- Trade crimes (both sites) fold their player panels behind "See the evidence" on phones (`Evidence` in
  components/trash/evidence.tsx: CSS-only checkbox, no layout shift; always open from `sm` up). Time machine and
  ring inquiry still long on phones.

## 2026-11-15: Trapezoid of Excellence (owner's spec)
- Kept the open-ended trapezoid (floor + sloped left edge, open top/right) over curved shapes: each edge is a
  one-sentence rule, it's monotonic, and a handful of champions can't justify a curve. Thresholds: <3 champions
  provisional (105 index, 50%), 3-7 lowest champion, 8+ 20th percentile; floors 100 / 45%; slope 0.005.
- PF uses Sleeper's official regular-season totals (weekly matchup sums don't match them for any team, playoff or
  not, so they aren't playoff-inflated). Playoff "vs regular season" compares per-Sleeper playoff weeks with
  per-Sleeper regular weeks (official vs weekly differ by ~5%, which would bias everyone negative).
- Same-spot managers share one label; markers aren't jittered (positions must be exact). Download is drawn on a
  canvas with initials (Sleeper avatars would taint the canvas).
- Trash's season settings (median, regWeeks) aren't in league.json; scheduled weeks fall back to the last
  completed season. Rafterlore reads them from league settings (ANALYSIS_VERSION 8).

## 2026-11-15: Trade court values = average lock-in x weeks rostered and played
- Owner's call. Each incoming player earns his season-average start (points per week in ANY team's
  starting lineup that season) for every week after the trade (playoffs included) that he's on the
  receiving roster AND played at least one game, started or not. Not starting him is the manager's
  call, not the trade's; injured/away weeks earn nothing. Replaces "actual points scored as a starter"
  (one game could swing a trade, and benching punished the trade). A same-day first version counted only
  started weeks; the owner rejected it for that reason. gain = [value, weeks held, weeks counted] in both
  pipelines (`scripts/build-extras.py` from weekly stats, `analysis.ts` from replay `best`;
  ANALYSIS_VERSION 7). A player never started by anyone that season has no average and counts 0.

## 2026-11-15: Daily-game standings tied to accounts; recreational-use terms
- Standings: each account links once to ONE Sleeper user for every league (`sleeper_links`, unique both
  ways), and can only post where that user is a manager. Owner asked that a signed-in user can't play in
  other people's leagues. Rejected: a claim per league (anyone could pick any manager anywhere); proving
  identity with a team-name code like removal (too much friction for a game; can add later if abused).
  Signed-out players can still play; the board nudges them to sign in. Trash keeps its honor system.
  Same day, owner asked to close the squatting gap: linking now needs the team-name code (intent "link" in
  `removal_challenges`, bound to the asking account). Codes are purpose-bound (`verifyChallenge(id, intents)`)
  so a link code can never remove a league. A proven link replaces any earlier one for that manager.
- Recreational use: terms section + footer line + an acknowledgement before a league's first import.
  Stored as wording version + time on `families` (no person data) and in the browser so returning
  visitors aren't asked again. No "projections" or "roster recommendations" claims: Rafterlore has none.
  No About page exists; the /l home serves that role and was left as is.
- Raw Sleeper ids leaked into shared components (OwnsGrid, rivalry header/winner, duos, most-moved);
  all now go through `Handle`/`useNameOf` (Trash ids are its handles, so Trash HTML is unchanged).
  An empty dive pool (brand-new league) crashed the page; now it just shows no prompts.

## 2026-11-15: Admin page + Vercel Web Analytics
- Owner wanted site data. Traffic (visits, pages, referrers, devices) comes from Vercel Web Analytics:
  cookieless, nothing to maintain. Rafterlore's own numbers (leagues, accounts, plays, Sleeper calls, jobs,
  nightly runs) are on `/l/admin`, owner only. Rejected: listing individual visitors or accounts.
- Admin identity: the owner asked for access by email. The email lives only in Vercel's `ADMIN_EMAILS` (the
  repo is public) and is compared at sign-in (scope now includes `email`, verified only), then dropped;
  `accounts.is_admin` keeps the yes/no. Privacy page updated accordingly.

## 2026-11-15: Optional Google sign-in
- Owner asked for a login that remembers you. Built Google sign-in only: email/password needs a mail service
  for resets (a paid/external service) and password storage. Stores the minimum: Google sub, first name,
  saved Sleeper username, last 12 leagues opened; no email (scope `openid profile`). Hand-written OAuth code
  flow with PKCE + state (no auth library: fewer moving parts on Next 16). id_token read without signature
  check because it comes straight from Google's token endpoint over TLS (OIDC Core 3.1.3.7); iss/aud checked.
- Auth routes call `connection()`: a build prerendered the start route once, which would have reused one
  state for everyone. Sessions carry a version so sign-out ends all sessions. Privacy page updated (it said
  "no accounts"). The finder's "see an example league" link was removed at the owner's request.

## 2026-11-15: Background cache refresh (slow page-to-page clicks)
- Every invalidation used `{ expire: 0 }`, so after each in-season refresh (every ~10 min), catch-up (30 min)
  or regrade, the next click on each league page waited for a full rebuild (cold function + Neon + render).
  Warm, Rafterlore navigation measures like Trash (~130-200 ms locally). Now routine updates use
  `revalidateTag(tag, "max")` (stale-while-revalidate: visitors get the cached page, a fresh one builds in the
  background); `{ expire: 0 }` only for first import, first grade, removal and restore (`Freshness` in store.ts).
- Each deploy also empties the page cache, so frequent pushes make first visits slow until pages rebuild.

## 2026-11-15: Sleeper football, player badges, lock-in labels
- Football reuses everything: sport is a per-league property threaded through the Sleeper client, discovery,
  jobs, live features and shared UI (brand.sport, default basketball, so Trash's HTML is unchanged; verified
  against a fresh build of the previous commit). Football weeks come from matchup `players_points` (every
  rostered player's points), so no box scores; "one" and "all" models are identical for football.
  Verified on a real 3-season dynasty league: every team-season's W/L/PF matches Sleeper's rosters exactly.
- Front office: football groups (QB/RB/WR/TE), "starting lineup" wording, values = weekly points (no 1.3x
  best-of-week lift), thresholds scaled 0.35x. Waiver wire: football positions, no minutes, bye/plays.
- Player photos removed from Rafterlore (licensing: photos are copyrighted and likenesses are licensed by the
  players' unions): initials + position badges. Cartoons were rejected: a recognizable drawing still uses the
  player's likeness. Trash keeps photos (owner's call).
- Sleeper basketball "lock-in" (one game per lineup spot a week) vs daily lineups is detected from games
  (Sleeper's settings don't expose it) and shown on the league home.
- Yahoo was requested then parked by the owner before any code was written.

## 2026-11-15: Dumpster Dive no-repeat schedule (and today's reset)
- Prompts repeated too often: 7 kinds, 5 picked a day independently, and "First round"/"Journeymen" had one
  prompt each, so the same question showed up ~70% of days. Now `dailyPrompts` (core/dive.ts) plans days in
  order: no prompt within ~2 weeks, yesterday's kinds wait, no manager twice a day; a kind is used twice
  before an old prompt returns. New prompt kinds (v2): champions' rosters, trades for/away per manager,
  each season's draft, late rounds (pool 67 -> 94 for Trash).
- Owner asked to reset 2026-11-15 for everyone: the schedule starts that day (avoiding launch day's and the
  replaced set's prompts), saves moved to `dive3:` (per-league key) and the leaderboard to game `dive2`.
  Launch day keeps the original pick (`legacy`). Clearing production Redis directly was not an option.

## 2026-11-15: Current-week trades and in-season catch-up
- Rafterlore showed 91 trades vs Trash's 93: grading replays only finished weeks (lineups aren't final), so
  trades made this week were missing. Grading now also reads the current week's transactions, for trades only
  (`SeasonInput.current`). ANALYSIS_VERSION 4 regrades every league once.
- The dataset was also only rebuilt nightly. `/api/l/[id]/refresh` now queues a catch-up (unfinished weeks only)
  when an in-season league's grading is over 30 minutes old. Verified on Trash: totals, every manager's record,
  points, trades, playoffs, titles, champions and every season's standings match league.json.

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
  window, because there were no accounts (optional Google sign-in added 2026-11-15). Ids are kept so a removed league isn't re-imported.
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
