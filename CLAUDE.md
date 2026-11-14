@AGENTS.md

# Trash League website (Next.js): how to build here

The homepage is the official site of the Trash fantasy basketball league (Sleeper).
Data: `src/data/league.json` (built by `scripts/build-league-data.py` from ../mdv-video/data/raw);
live Season 4 table via `liveStandings()` in `src/lib/league.ts` ('use cache', minutes). In this cloud
sandbox run `next dev`/`next build` with `NODE_USE_ENV_PROXY=1` so server fetches reach Sleeper.
Head-to-head data is from Sleeper's weekly scores and is unreliable: always label it "per Sleeper".

## Taste
- Premium pro-franchise feel for a joke league: arena banners, hardwood, evidence lockers. Never generic AI-template looks.
- Motion should feel smooth and intentional, never overdone. Respect `prefers-reduced-motion`.
- Must work well on mobile: check phone width, no horizontal scroll, touch-friendly.
- Use the `frontend-design`, `impeccable`, `emil-design-eng` and `gsap-animation` skills when designing or animating.

## Stack conventions
- GSAP: always import from `@/lib/gsap` (plugins ScrollTrigger + SplitText + useGSAP are registered there). Use `useGSAP` with `gsap.matchMedia()` for reduced-motion handling.
- Smooth scroll: Lenis lives in `src/components/smooth-scroll.tsx` (root layout), driven by the GSAP ticker. Don't add a second scroll loop.
- Motion (Framer Motion): `import { motion } from "motion/react"` for hover, tap, enter/exit and in-view fades.
- 3D: react-three-fiber + drei. Load canvases with `next/dynamic` and `ssr: false`; cap `dpr` at ~1.75. Avoid drei `Environment` presets (they download HDRIs); build lighting with `Lightformer`.
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
