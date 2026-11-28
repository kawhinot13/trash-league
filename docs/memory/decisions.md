# Decisions log

Why things are the way they are, newest first. One entry per significant decision, including
approaches that were tried and dropped. This repo is public: no secrets, personal data or private
URLs in here. Add an entry whenever a choice would surprise someone reading the code later.

## 2026-11-19: Past player trades re-priced under the current formula
- The player formula changed twice (season avg -> last 10 -> last 5), so early buyers got windfalls or hits from
  the rule, not the games. Owner asked for fairness: every past player buy/sell was re-priced at what the current
  formula says the player was worth that day (box scores before that day, the league's holdings then), log amounts
  updated, and each manager refunded or charged the difference (player shares given back at today's value if cash
  ran short; never negative). Open player shorts' entries reset the same way. One-time (`market_meta`).

## 2026-11-19: Dumpster Dive "Big numbers" gets easier, plus "Big nights"
- Owner: "averaged 80+ per lock-in" had only ~10 answers. From 2026-11-20 the average question's bar is the
  highest that leaves 25+ answers (Trash site 65+, Rafterlore 70+), and a new "Big nights" question asks for a single
  start of N+ (lock-in wording: "had an 80+ lock-in"), bar with 100+ answers (Trash 80+, 126 answers). Uses Sleeper's
  per-starter points (per Sleeper; fine for trivia). Old 80+ text kept up to 2026-11-19 (pinned that day).
  ANALYSIS_VERSION 12.

## 2026-11-19: Team stocks closed outside Mondays (no waiting orders)
- Waiting orders showed an estimated price that might not fill (a 1-share order could get 0 if the price rose).
  Owner: just don't allow team or company trades until Monday. Team buys, sells, shorts and closes work only Monday
  before 7 PM ET once results are in; buttons read "Opens Monday" otherwise. Anything waiting was refunded once.

## 2026-11-19: Team stocks trade on Mondays
- Mixed rules confused the owner (instant buys at mid-week prices earning coin a week later; waiting shorts; instant
  sells that could dodge a known loss). Now every team order goes through only Monday before 7 PM ET once last week's
  results are in; anything placed at other times waits and fills at the prices right after the next result, with
  BB set aside and cancel any time. So every team share is bought before that week's games and earns that week's coin
  (cutoff Monday 7 PM). Owner asked that this week's team buys and shorts count as if made that Monday: backdated
  once to Mon Nov 16 6:59 PM ET, waiting shorts opened at their placed value. Players stay daily.

## 2026-11-19: Team shorts follow the weekly schedule
- Gap: short a team late in a week once its loss is obvious, close after the result posts. Owner's fix: team shorts
  open right away only on Monday before 7 PM ET (after last week's result posted); otherwise they wait, with the BB
  set aside, and open at the price after the next result (as many shares as the set-aside covers, rest refunded).
  Cancel any time. Player shorts keep the game lock (prices move daily). Rejected: requiring mid-week trades to be
  held until final (doesn't remove the edge; my earlier suggestion was wrong).

## 2026-11-21: Starting Nine rarity scoring + animations
- Owner wanted rarity like popular grid games (lower is better). No pick data to count, so rarity is an estimated
  share from league fame (exp curve), stable all season. New board id "grid2" so old point scores never mix.
  Animations use what's installed: GSAP + SplitText for the final card, motion for tiles, canvas-confetti.
  Rejected: real pick % from the league's own guesses (a dozen players is too few, and it would move all day).

## 2026-11-20: Starting Nine (daily grid)
- Owner asked for a grid game for the league. Original name and look (the 3x3 mechanic is generic). Owner wanted
  many rotating columns and score tiers (50+, 60+ lock-ins; 20+ PPG), so categories are generated with tiers and
  picked kind-first. Grid picked from finished seasons only, learned from the Dive's mid-day swaps.

## 2026-11-20: Boom index
- Owner picked it. League-relative big-game line (top 10% of rostered players' games) so it fits any scoring;
  rate + ceiling per player in the Front office ("Boom or bust": everyone / free agents / my team).
  Rejected: a fixed points line (Trash-only), standard deviation (punishes good players' good games).

## 2026-11-20: GM rating
- Owner picked it from the advanced-data list (with the boom index; not the playoff schedule edge, which was
  built then dropped unshipped). Skill-based, not activity-based (the quiz traits count trades/adds made): draft
  spots gained, pickup starter points, trade court net, lineup efficiency, results. Top of the Stats page.

## 2026-11-20: The forecast (title chances)
- Owner asked for a model of how teams stack up and what it takes to win. Built on the Live page: "the title
  line" (every Trash champion scored 104.9%+ of league average, official; seeds 5, 5, 2), each team's projection
  (official results blended with best healthy lineup, recent proven weeks as form) and a 5,000-run simulation of
  the remaining schedule and bracket. Rejected: lineup index as the main line (per Sleeper, looser: 100-107);
  the word "odds" (Rafterlore has no link to betting).

## 2026-11-20: Trade finder: stars over depth
- Owner: nobody who knows the game trades the best player in a deal for depth (3 x 40 for a 70 is a no), even
  for more total value, because only the starting nine scores. `keepsStar`: a side gives up the deal's best
  player only if it gets back someone within 90% (`STAR_KEEP`). The finder skips trades breaking it either way;
  the analyzer marks them "probably say no" with the reason. Rejected: weighting stars inside the lineup total.

## 2026-11-20: Different 100-point answers
- Owner: one obscure player (Braden Smith, Trevon Brazile, Moussa Cisse) was the 100-point answer for up to 7
  questions. Now each prompt's 100 goes to a deep answer not already used (`spreadKrillions`, pool order), and a
  day's five 100s never repeat (`distinctTops`). The swapped answer keeps the old one's points.

## 2026-11-20: Dive counts mid-week pickups; today's Dive reset
- Kennard and Patrick Williams (picked up and dropped within week 5) were rejected for "on a Trash roster this
  season": roster questions only used end-of-week rosters, and the week in progress wasn't read at all. Every
  roster question now also counts every pickup (`RawSeason.added`). Owner asked to reset today's Dumpster Dive
  only (other daily games kept): one-time `RESETS` entry; scores deleted once, browsers drop the saved game.
  Rejected: re-scoring saved games (owner chose a replay).

## 2026-11-19: NBA team stocks
- Owner asked for real NBA teams on the Exchange. Price only, no Perren Coin per real win (that would make it
  "back a real team in a real game and get paid", too close to betting). Strength = half win %, half
  point-differential Pythagorean; recency lessened to 20% (owner: records swing more than player averages).
  Scores from Sleeper's schedule finals, verified (quarters sum, records match) instead of summing box scores.
  Rejected: coin for wins; 60/40 recency like players.

## 2026-11-19: Player prices start from last season
- Owner: with a flat 15 start, every star opened a season at 15 and climbed to his level over 5 games (free
  money on opening night, and injured stars back from injury sat near 15). Now a player with 10+ games last
  season starts from his last-season points per game (Trash scoring, box scores; `priorLevels`); rookies still
  15. Each game still moves it a fifth of the way. Moved 44 current prices (Butler 15 -> 48.5, Kawhi 26.7 -> 53.8).
  Past player trades re-priced once more (`REPRICES` key `reprice-players-prior2`, run only once the board carries last-season levels: the
  first key may have run on a board cached from before the deploy, a no-op). Rejected: 20 for rookies
  (owner kept 15).

## 2026-11-19: Player prices follow recent form
- Owner: a season average barely moves after 20 games, so player stocks were dull. Price is now 60% the last 10
  games' average + 40% the season average (`formFair`), still from box scores with Trash scoring, still pulled
  toward 15 under 5 games. Injured players keep their price (owner's call: frozen, no decay for missed games).
  Charts rebuilt the same way. The switch moved current prices once (streaks: Wagner/Klay +18-19%, Portis -17%).

## 2026-11-19: Trash Exchange shorts
- Owner asked for shorting teams and players. Collateral-backed, capped both ways: open at the stats-only value,
  close pays 2x entry minus value then (0 to 2x), so nobody goes negative and losses never exceed what was put up.
  Uses fair value without buying demand so a long pump can't set up a short. No coin either way. Not your own team,
  not players on your roster (you could bench them), not STORM. Flagged to the owner as one more step toward
  betting-like play; still play money, no prizes. Rejected: unlimited-loss margin shorts, shorts moving the price.

## 2026-11-19: The Great Storm (STORM)
- Owner wanted a tradeable "company" for Junkyard Dog + KawhiNot, who warned the league before Season 4 they were
  coming for the top. One stock: worth the average of the two team values; pays the average of their per-share coin
  each week, x1.5 in a Storm week (both win). Members can't buy it (same spirit as no buying your own team).
  Chart before it traded = nightly average of the two. Rejected: sum of both (would dwarf every other stock).

## 2026-11-19: Perren Coin cashes in at 30 BB (buys at 40)
- Owner agreed: an even 40/40 swap made coin just another name for bucks and hoodies one option among many. Cashing
  coin back now pays 30 BB, so reinvesting is possible but costs something, coin's natural use is hoodies, and
  swapping back and forth can't loop. Net worth counts coin at 30 (what it's actually worth in bucks).

## 2026-11-18: Trash Exchange player stocks
- Owner asked for player stocks after being told they look closer to sports betting than team stocks (real NBA
  athletes' performance) and that the NCAA's pro-sports betting ban still stands (late-2025 change rescinded); advised
  to ask a compliance office. Built with the guardrails the owner restated: play money that can't be bought or cashed
  out, no entry fee, no prizes, Trash only. To stay further from betting, player stocks pay NO coin; they only rise
  and fall. Price = fantasy points per game this season from box scores with Trash's scoring (not Sleeper's weekly
  matchup totals). Rejected: per-game payouts (prop-bet-like), live in-game prices.

## 2026-11-18: NBA-team questions are all-time
- Owner: "Name a Warriors player" should count anyone who played for the Warriors, not just today's roster (more
  players, more room to go niche). Sleeper's box scores record each game's team, so the grade step collects every
  team per player over the league's seasons (`weekTeams`, cached per week; `extras.teamsPlayed`). Trash: Warriors 12
  -> 22 answers, Knicks 12 -> 27, Lakers 10 -> 30. Wording unchanged so planned questions still match. Only covers
  seasons the league has played (no pre-league history). ANALYSIS_VERSION 11.

## 2026-11-18: Dumpster Dive leans broad
- Owner: broad questions (an NBA team, league-wide) are better than remembering who owned whom. From 2026-11-20 every
  planned day has one NBA-team question and at most 2 about a single manager (the cap yields only when no fresh
  league-wide question is left, since no-repeat wins). New broad types: Positions (PG/SG/SF/PF/C) and Season rosters.
  Last week's near-daily shapes (journeymen, first round, late rounds, playoffs) rest 10 days. Gated by date so the
  days already shown and the pinned 2026-11-19 don't move. Rejected: replaying pre-restart days to seed the
  cooldown (they depend on the browser's sort, the reason RESTART exists).

## 2026-11-18: Dumpster Dive on Rafterlore uses Trash's names; Trash site renamed
- The owner's picks for 2026-11-18 never reached Rafterlore: its calendar was planned with Sleeper names
  ("RI3O", "Trash Season 4") but pages showed nicknames, so pinned and manager questions didn't match and were
  swapped on page load (also skipping the no-repeat rules). Now the grade step and pages share `packDataset`
  (nicknames + "Trash"); a one-time `renameCalendar` keeps days already shown exactly as seen, reworded.
  ANALYSIS_VERSION 10 makes every league regrade once. 2026-11-19 pinned to the owner's fresh set (Warriors,
  Rico's cuts, 80+ average, draft busts, 50+ lock-ins). A test fails the deploy if a pin can't be found or a day
  repeats a category / a question returns within 10 days.
- The owner only cares about Rafterlore now; the Trash site's nav and titles say "Test Trash Fantasy".

## 2026-11-18: Trash Exchange Perren Coin cashes back into Bushy Bucks
- Owner asked for coin -> bucks (a hoodie sell-back was built by mistake and reverted; hoodies stay never-sold).
  Same 40 BB rate both ways, so swapping is neutral; payouts can now be reinvested in shares.

## 2026-11-18: Trash Exchange underdogs pay more
- Owner: upsets should pay more and favourites less, with a bit of extra incentive to back worse teams. A win pays
  (opponent's value ÷ winner's value) coins per share, both from official totals before that week's result, clamped
  0.5 to 3 (cap 3 rather than 2 for the extra tilt). Pairings come from Sleeper's weekly schedule (matchup ids only,
  never its scores); unknown opponent or two results at once pays the flat 1. Each row shows "vs X, a win pays N".

## 2026-11-18: Trash Exchange coin only for shares owned before the week; public ledger
- Loophole (owner): buy a team late in a week once its win is obvious, collect a coin per share. Fix: shares are kept
  as purchase lots; a week's coin counts only lots bought before that week began (Monday 12am ET); selling takes the
  newest lots first. Old holdings were rebuilt into lots from the order log. Late buyers can still catch the small
  price bump when a win goes final (kept as normal market timing). Rejected: pricing from live in-week scores
  (Sleeper's basketball live scores are wrong), closing trading mid-week, filling orders at the next week's price.
- Owner wanted every transaction public: the ledger lists all buys, sells, swaps, hoodies and payouts (amounts, times).

## 2026-11-18: Trash Exchange charts start at the first accurate data
- Owner wanted charts from week 0 but only accurate data. Before the nightly saves (first: 2026-11-14) the only
  weekly source is Sleeper's matchup scores, which miss the official totals by 6-158 points per team over weeks 1-3.
  So weeks are rebuilt only when every team's weekly scores sum to the first saved night's official total (they
  don't now); otherwise the chart starts at that night. Rejected: scaling weekly scores to the official total
  (the shape between weeks would still be a guess).

## 2026-11-18: The Trash Exchange (Trash-only play-money stock market)
- Owner asked for a stock game just for Trash with three currencies: Bushy Bucks, Perren Coin, Xan Purple Hoodies.
  Lives in the Trash pack on Rafterlore (accounts + Sleeper links already prove who each manager is; the Trash site
  has no sign-in). Each currency has one job: bucks trade shares, coin is the dividend for official wins, hoodies
  are the prestige score (never sold, rising price so early buyers win).
- Prices use only official season totals (PF vs league average, squared, x record; shrunk to 100 early), never
  weekly matchup scores. Demand moves price linearly; buys and sells integrate the same line (no arbitrage, tested).
- Reads write nothing unless new official results, a new day's prices or a first desk; dividends pay once under an
  advisory lock (checked with concurrent requests). Rejected: shorting (manipulation via tanking), a fee, Redis.
- Play money only: in-game line says it can't be bought, sold or cashed out. Terms unchanged (owner's call).

## 2026-11-17: League-wide open-ended Dumpster Dive questions
- Owner wanted questions not tied to a manager ("locked in for 60+ in this league"). Per-player weekly scores aren't
  in the data (only season totals per team), so built from totals: Workhorses (started N+ times), Franchise scorers
  (N+ points for league teams), Big numbers (averaged N+ per start for a team in a season, 3+ starts), Draft busts
  (drafted, never started by the drafting team), Waiver gems (pickup started N+ times by the team that grabbed him).
  Cutoffs adapt: the highest step that leaves 10+ answers, so new leagues get them early. Wording per lineup type via
  promptText (lock-in "locked in", daily "in the lineup").

## 2026-11-17: Dumpster Dive for new leagues: "Cut list" + empty state
- Checked new leagues: an undrafted league had 0 prompts (blank game after Start); a first-season league ~47 prompts
  in 7 categories. Added "Cut list" (v3, shape mgr-dropped): "Name a player <manager> has dropped" (on his roster one
  week, gone the next, not traded away; obvious = held longer), which fills quickly in new leagues. Undrafted leagues
  now show "The bin is empty. For now." instead of the game. Rejected "first three rounds" (only 3 answers each; a
  prompt needs 8).
- Questions are the same for everyone in a league (and across devices); each league's are its own.

## 2026-11-17: Personal best = your high score
- Owner: the report's "Personal best" (browser-only) disagreed with the standings' high score. On Rafterlore with a
  linked account it now comes from the standings (`best` + new `bestBefore` in /api/l/[id]/scores, passed up from the
  Leaderboard via `onMine`); "New personal best" compares with your best before today. Browser record is the fallback
  (Trash site, signed out).

## 2026-11-17: Tooling audit and cleanup
- Audit (owner asked): Playwright is already used (scripts/qa-mobile.mjs + mobile-qa agent, the sandbox's global
  install); GSAP and Motion already installed; design skills already cover "taste". Left out: Lottie, Three.js/R3F,
  extra design skills, Playwright MCP (token-heavy). Not yet approved: saved e2e tests, Context7 (its host is blocked
  by this environment's network).
- Cleanup (approved): removed the 13 Remotion skills from this repo (they belong to ../mdv-video and were listed
  every session), the 21st.dev Magic MCP (no key, failed every session), and unused packages lenis + lucide-react.

## 2026-11-17: Dumpster Dive suspense: nothing gives the score away before the reveal
- Owner: the impact ring was too much and killed suspense; streak badge reads "N deep dives in a row". Removed the
  ring; the landing (thud, dust, small shake, debris) is now identical for every right answer; the tier glow, camera
  punch, bigger shake, chime or "meh" all wait for the reveal; the card border, motion trail and score readout stay
  neutral until then (`revealed` in stage.tsx, set by slamBanner). The depth labels popping during the count are the
  intended build-up.

## 2026-11-17: League removal taken out
- Owner: nobody should be able to remove a league. Asked with the trade-off stated (privacy/terms promised a manager
  opt-out for leagues shown without their members signing up; recommended "only the owner, on request"); owner chose
  "remove it completely". Deleted /l/[id]/remove, /api/l/[id]/remove and the remove form; dropped the link on league
  pages and the restore link on the removed notice; privacy loses "Removing a league", terms now say leagues stay and
  Rafterlore may remove one. Yahoo leagues (private, members-only) keep their own removal.

## 2026-11-17: Dumpster Dive game feel pass
- Owner: the game felt basic. Added: a round slate ("ROUND 2 · TRADE LOG") that wipes across with a drum hit, then the
  question drops in word by word; a wind-up before the throw and a three-ghost motion trail; impact dust and a camera
  punch (60+); the depth meter "charging" (SOLID / DEEP / DIVER / DEEPEST pop with rising tones as the score passes
  25/60/90/100); the score readout pulses as it rolls. All transform/opacity; reduced motion shows end states only.

## 2026-11-17: Dumpster Dive: a perfect 100 has its own holographic tier
- Owner: 100 is the "one in a krillion" answer and should feel unique. New tier "Deepest in the bin" (`tierOf(100)`):
  `bg` = HOLO foil gradient (cyan, violet, pink, gold) with a shimmer (`.dd-holo`, still under reduced motion), violet
  accent, rainbow light rays and confetti in the takeover, 💎 in the share text. 90-99 keep the gold "Dumpster diver".

## 2026-11-17: Player photos for Trash's league on Rafterlore only
- Owner's call: Trash's league (pack "trash", `packIdFor`) gets `headshots: "sleeper"`; all other leagues keep badges.
  Conditions agreed: Trash only; not used as the public demo or in Rafterlore promotion; back to badges if Rafterlore
  makes money or anyone asks. Same low-risk footing as the Trash site (private league, non-commercial).

## 2026-11-17: Dumpster Dive written calendar
- Problem: each day's prompts were re-dealt from the whole pool on every page load, so a data update (5:13 AM) that
  added a question could change a day already in play. Fix: a written calendar; days up to today never change, the
  next 30 are (re)planned from the new data. Trash: src/data/dive-calendar.json via `npm run calendar` in the daily
  scheduled task (which now also stops if a locked day would change, and runs `npm run build` with tests).
  Rafterlore: `Dataset.diveCalendar`, extended from the previous dataset in grade(). Saved games also keep `qs`.
- Rejected: storing a first-seen date per question (needs the same storage anyway); running the update before
  midnight (still changes the day in progress).

## 2026-11-17: "This season" roster questions; Rico pinned for 11-18
- New v3 shape `roster-now` (Locker room): "Name a player who has been on <manager>'s roster this season (<years>)",
  for in-progress seasons; answers grow as the season goes (rebuilt from the daily data). Owner swapped 11-18's
  Oscar title-team question for Rico's this-season roster.

## 2026-11-17: One category per day (not just one question type)
- Owner: a day had two "Waiver wire" questions (different shapes, same label). `planned()` now also never repeats a
  category (`kind`, the label players see); the 11-18 pin swapped JD's waiver question for Late rounds. Test checks both.

## 2026-11-17: Hand-picked days (`PINNED` in core/dive.ts)
- Owner picked Trash's 2026-11-18 set: keep Journeymen, swap the rest for the new types (two waiver questions, a
  Knicks question, Oscar's 2025-26 title team). A pinned day applies only when every prompt is in the league's pool;
  later days plan around it (variety rules still hold).

## 2026-11-17: New Dumpster Dive questions: waivers and NBA teams (from 2026-11-18)
- Owner asked for more, not too niche. Three shapes (`v: 3`, only in the schedule from RESTART so earlier days keep
  their prompts): "picked up off waivers in <season>" (obvious = scored more for the team that picked him up),
  "<manager> has picked up off waivers" (obvious = kept longer), "<NBA team> player who has been on a <league>
  roster" (basketball only; current NBA team; obvious = more weeks rostered). Pickup = on a team's roster in a week
  without being drafted by it or traded to it that season (rosters week "0" is the draft).
- Trash pool 94 -> 140 prompts, 12 -> 15 shapes; back-to-back shape repeats over 4 weeks 54 -> 4.

## 2026-11-17: Power rankings: momentum (recency)
- Owner wanted recency even when form sits out. Momentum = last three official results (W 1, T 0.5, L 0), weighted
  3/2/1 newest first (`momentumOf`, core/power.ts; `Standing.results` carries Sleeper's record string). Weights:
  with exact last-week scores record 25, scoring 25, roster 30, form 10, momentum 10; without: 30/25/30/0/15.
  Rejected: inventing a weekly score from Sleeper's matchup feed (unreliable for this league).

## 2026-11-17: Dumpster Dive: a right answer scores at least 1
- Owner: the most obvious right answer scored 0, same as a miss. Now right answers score 1-100; only a miss is 0.
  Scores already saved keep their values.

## 2026-11-17: Daily games: high scores, resume, live standings, 5-letter Rosterdle, prompt variety
- High scores: `/api/l/[id]/scores` returns `best` (each manager's top single day, date, label); the standings get a
  "High scores" tab (Rafterlore; Trash's Redis board unchanged).
- Dumpster Dive saves after every answer (`dive3:<day>` with `done` once the report shows) and resumes mid-game
  after leaving the tab; finishing while away still records best/streak once. Also blocks redoing an answer.
- Standings refresh every 20 s while visible and on returning to the tab, so finished scores appear for everyone.
- Rosterdle: from 2026-11-18 (`FIVE_FROM`) the shared daily player's last name is 5-7 letters (was 4-7);
  `sharedPick` skips shorter ones; earlier days unchanged. Pool stays append-only.
- Variety (owner: "don't let it feel repetitive"): prompts carry a shape (`t`: roster, started, mgr-drafted,
  traded-for/away, season-draft, season-traded, playoffs, champs, first, late, journey). `planned()` (from RESTART):
  no shape twice a day, yesterday's shapes wait, longest-rested shape first, exact question waits 10+ days, managers
  asked about yesterday wait. Before: roster prompts were 27% of days' questions and 93/140 back-to-back shape
  repeats; now 54/140 and no exact repeat within 11 days (94 prompts, 5 a day: more shapes would help further).
  Rejected 14-day cooldown: forced more back-to-back shapes and still repeated within 4 days.

## 2026-11-17: Dumpster Dive prompts were different per browser; schedule restarts 2026-11-18
- Found while answering "what are today's questions": Node and Chrome planned different prompts for the same day.
  Cause: `legacy()` shuffled with `.sort(() => r() - 0.5)`; engines (and V8 versions; Safari/Firefox use other
  algorithms) disagree on random-comparator sorts, and the schedule carried that history forward every day.
- Fix: from `RESTART` (2026-11-18) the schedule starts fresh without the legacy history; everything after is
  engine-independent (seeded rng, numeric keys, stable sorts). Test swaps Array.prototype.sort for insertion
  sort and requires identical days. Days before the restart are left as they were (can't be made consistent;
  changing today would break saved reports). Applies to Trash and every Rafterlore league.

## 2026-11-17: Dumpster Dive says "locked in" in lock-in leagues
- Owner asked what "started" means (it's the week's starting lineup = the lock-in). `promptText`/`kindText` in
  core/dive.ts reword for display only: lock-in "locked in" / "Lock-ins", daily "in the lineup" / "Lineups",
  football keeps "started". Stored prompt text is unchanged because the daily schedule keys on it (no reshuffle).

## 2026-11-17: Pick your team instead of typing a username
- Owner: a league-mate had to type his Sleeper username to play. Now, with no saved username, the gate shows the
  league's current managers (photo + name) to tap, then "I'm <name>"; managers another account already plays as are
  greyed out ("taken"). Picking saves that username on the account, so the rest of the rules hold (one manager per
  account, first claim keeps them). `?who=1` returns `pick: { current, taken }` (ids only). Typing is a fallback link.

## 2026-11-17: Automated tests (Vitest), and they gate deploys
- 26 tests in `tests/` for the math: official weekly scores (incl. the Junkyard Dog case), lineupTotal == bestLineup,
  trade finder rules (and agreement with evaluateTrade), Full strength / Health, Trapezoid window + no-peeking,
  Dumpster Dive pool and daily schedule, saved daily-game state. Seeded made-up leagues plus Trash's real data.
- `build` = `vitest run && next build`, so Vercel won't deploy a commit that breaks them (daily data pushes too).
  Checked by reintroducing the Junkyard bug: its test failed by name.
- `cleanState`/`STATE_NAME` moved to `core/game-state.ts` so they can be tested. Rejected: Jest (slower setup with
  TS + path aliases); browser end-to-end tests in CI (slow, flaky; Playwright stays a manual check).

## 2026-11-17: Daily games remember you across devices (Rafterlore)
- Bug: signing in on a phone let you replay a game already played on another device (finished state lived only in
  localStorage). The server already kept only the first score, but a replay showed a different report.
- Fix: the board posts the game's saved progress with the score (`state` jsonb, whitelisted names, <=16 KB);
  `?who=1&day=` returns today's finished games; PlayGate writes them into this browser before the game mounts, so
  every device opens on the same report. Scores saved before this (no state) show "You already played today".
- Keyed by the account's linked Sleeper manager, not email (accounts store no email). Trash's honor-system board unchanged.

## 2026-11-17: Deep Cut rewards escalate with depth
- Owner asked for cooler, more rewarding animations. Reveals now scale with the score (stage.tsx): under 25 flops in
  with a "meh" (no shake); 60+ adds a shockwave ring and the bin glowing in the tier color; 90+ is a takeover (light
  rays turning behind the bin, flash, card punch, side confetti cannons, bass drop); 100 says "Deepest in the bin".
  "+N" floats off the card; the HUD total pulses. Deep cuts in a row show "N deep in a row" and raise the chime.
- Report: total counts up with ticks, cards flip in, 90+ cards glow gold, rank meter to the next rank, personal best
  (`dive:best`, browser only) with a "New personal best" stamp; confetti for 300+ or a new best.
- Scoring unchanged (standings stay comparable). Reduced motion: no movement, effects shown without motion.

## 2026-11-17: Team names on Rafterlore daily-game standings; no emails
- Owner asked for "your email" and "your team" on the standings. Team names (public Sleeper data) now show beside
  each manager (`teams` in `/api/l/[id]/scores`, from `newestSeason`), hidden when they just repeat the name.
- Emails are NOT shown: accounts never store an email (privacy promise, `/privacy`), and the boards are public, so
  everyone's address would be visible to anyone. The manager name already says who played.

## 2026-11-16: Front office Trade finder
- Owner asked for "best trades that would upgrade your lineup, but realistic". New tab (`tradeFinder` in fo-analysis):
  1-for-1, 2-for-1, 1-for-2 with every team; kept only if your best lineup gains >= 5 a week, theirs loses at most 3
  (usually unchanged or better), you take <= 15% extra raw value and never pay more than 1.5x. Rest-of-season values
  (`healthy`), no IR players. Max 2 ideas per team, each incoming player once, top 8. Opens in the trade analyzer.
- 2-for-2 added (owner OK'd): ranked by a quick per-player estimate, top 30 per team checked exactly; same rules.
  Biggest realistic gains (+8 to +14 a week on Trash vs +5 to +6 for 1-for-1). ~0.3 s per search.
- `lineupTotal`: same total as bestLineup with typed arrays (~5x faster), so a search is ~0.2 s.
- Rejected: "their lineup can drop up to 8" (the analyzer's "likely") let in lopsided 2-for-1 overpays; requiring them to
  gain left almost nothing. Few ideas for some teams is the honest result.

## 2026-11-16: Weekly scores must be proven (points for = opponent's points against)
- Bug: Junkyard Dog's week 4 showed 460 (bench crime "460 of 603"). The week-3 total was saved 11 minutes after his
  mid-week roster move; Sleeper had rewritten his season total with some week-4 points, so "after week 4 minus after
  week 3" came out ~100 short. Every other team checked out.
- Fix (`core/official.ts`): use the EARLIEST saved total per finished-week count, and accept a team's weekly score
  only if another team's change in points against equals it (and vice versa). Recap superlatives (blowout,
  high/low, bench crime, locked in) and power-ranking form need every team proven, else that week shows results
  only. Trash's official.json now also stores points against (`s4_pa`); week 4 there can't be proven (no PA in the
  week-3 capture), weeks 5+ can. ANALYSIS_VERSION 9 regrades Rafterlore leagues.
- Rejected: Sleeper's matchup feed as a cross-check (different team scores on each request); estimating the bad value.

## 2026-11-16: Waivers gets its own tab
- Owner asked: waiver intel moved off the bottom of Live into /waivers (Trash) and /l/[id]/waivers (Rafterlore), in the
  nav after Live and on the home doors. Phone tab bar unchanged (Waivers sits under More).

## 2026-11-16: Front office "Right now" vs "Full strength"
- Complaint: teams with injured stars showed "lacking star power". The team analyzer now has a toggle: Right now
  (default, injury-discounted `avail`) and Full strength (`fullStrength` = healthy value). Health always measures who's
  actually available. Trades already used rest-of-season value (`healthy`), unchanged.
- Full strength hides Health (bar, chips) since everyone counts healthy there; instead one line says how many
  of your top 5 are out (Out or IR) right now. `diagnose(..., full)`.

## 2026-11-16: Daily games: who you are is your saved Sleeper username, confirmed before playing
- Owner: confirm identity before a game, and you can't play as someone else in a league that isn't yours. The
  account's saved Sleeper username decides (typed once if none); claims for any other manager are refused, and
  leagues without that manager show "You're not in this league" instead of the games. Still no code (owner's call):
  someone could type another person's username first; first claim keeps it.

## 2026-11-16: Rosterdle hints (Rafterlore only)
- Owner asked for hints "not too easy". Earned by missing (after 3, 4, 5 misses), opened on purpose, -10 points each
  off a win (min 10): broad position group, conference (not team), then one league-history fact. Brand flag
  `wordleHints`; Trash's Trashle stays hint-free (owner removed its hints earlier). Rejected: the old team + owner
  hints (too easy: the team nearly gives it away).

## 2026-11-16: Picking your manager needs no code (owner's call)
- Owner chose "just pick, no code ever" over keeping the team-name code or "code only if disputed". Accepted risk:
  first account to pick a manager keeps them. The proof code path stays in the API (verify) but the UI no longer uses it.

## 2026-11-16: Daily games suggest the account's own Sleeper username
- Owner wants the saved username (e.g. kawhinot13) to be who you play as. The standings now suggest that manager
  first; confirming still takes the team-name code, because a typed username proves nothing (anyone could type it).
  Rejected: trusting the saved username outright (reopens the squatting hole fixed earlier the same day).

## 2026-11-16: Rafterlore weekly recap uses only verified scores (basketball)
- Owner flagged a week-3 "bench crime" that wasn't true: Rafterlore's recap used Sleeper's weekly team scores, which are
  unreliable for basketball. Now basketball weeks show team-score cards (blowout, nail-biter, top/low, bench crime,
  most locked in) only with exact scores from the nightly official totals; other weeks show official results, top
  performances and the best pickup, plus a note. Football unchanged (its weekly scores were verified).

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
- Game names on Rafterlore: Dumpster Dive (dive; was "Deep Cut" until 2026-11-17, owner renamed it to match the
  dumpster art; the bin reads DUMPSTER, Trash's reads TRASH), Rosterdle (wordle), The Lineup. Leaderboards are per league in Postgres (`game_scores`).

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

## 2026-11-21: Starting Nine rarity spread + answers sheet
- Rarity now uses a log-scale curve (60% down to 0.2%, exponent 1.15) with a per-player wobble and hundredths under 1%,
  so deep answers spread out (owner wanted Dive-like variance). Rejected: shares summing to 100 (too flat), plain
  geometric (low end crammed), power 1.35 (top crowded near 50%).
- Answers moved from a long list under the game to a sheet opened by tapping a square (more organized, owner's ask).
- Today's scores re-posted with the new numbers (board emptied once, browsers re-post their kept answers).

## 2026-11-23: Trades graded on value over replacement (Rafterlore)
- Problem (owner): two depth pieces out-valued a star because each player's average lock-in was summed.
- Now each player only earns what he averages above the waiver line (best player left once every roster spot is
  filled), never below zero; recent in-season trades (<3 weeks) are "too early to call".
- Rejected: the last-starter line (teams x lineup spots): lock-in averages bunch, so it called regular starters
  worthless (Trey Murphy 0). Lineup-impact replay (most exact, hard to explain). Projections (forecast, not a result).
- Trash site left on the old grades (test copy; its HTML stays unchanged).

## 2026-11-28: Let the database sleep (Neon free compute ran out)
- Symptom: sign-in bounced back signed out, standings off, market "closed" (every database call failing).
- Polls now stop when a tab is idle 10 min; standings and market every 2 min (were 20 s / 30 s); game progress every
  15 s (was 3 s); in-season catch-ups every 2 hours (was 30 min).
- Rejected: paid Neon plan (owner's call; costs money), websockets/realtime (more always-on load).
