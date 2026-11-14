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
