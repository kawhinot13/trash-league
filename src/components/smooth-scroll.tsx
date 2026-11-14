"use client";

/**
 * Native scrolling. Lenis smooth-wheel used to live here, but profiling showed it
 * (together with backdrop blur) caused most of the dropped frames while scrolling on
 * desktop, so the site now uses the browser's own scroll. ScrollTrigger works on native
 * scroll without any wiring. Kept as a component so the layout doesn't change.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
