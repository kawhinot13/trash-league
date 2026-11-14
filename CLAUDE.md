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

## Component sources (shadcn MCP + registries in components.json)
- `npx shadcn@latest add @magicui/<name>` (Magic UI: animated text, shimmer buttons, marquees, particles)
- `npx shadcn@latest add @aceternity/<name>` (Aceternity: spotlight, 3D cards, background beams)
- `npx shadcn@latest add @react-bits/<Name>-TS-TW` (React Bits: cursor effects, backgrounds, text effects)
Restyle pulled components to the editorial palette; don't ship their default look.

## Video
The Remotion project lives next door in `../mdv-video` (separate repo, its own Remotion skills).
