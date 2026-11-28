"use client";

/**
 * Polling that lets the database sleep (owner's call 2026-11-28: Neon's free compute ran out because open tabs
 * polled it around the clock). A poll only runs while the tab is visible AND someone touched, scrolled or typed
 * in the last IDLE_MS; an idle tab goes quiet until it's used again, then checks right away.
 */
export const IDLE_MS = 10 * 60_000;
/** Live boards (daily-game standings, market): how often an active tab checks. */
export const BOARD_POLL_MS = 2 * 60_000;
/** In-progress daily games: how often a changed game is saved to the account (also saved when the tab is hidden). */
export const PROGRESS_SYNC_MS = 15_000;

let lastActive = Date.now();
let watching = false;
const wakers = new Set<() => void>();

function watch() {
  if (watching || typeof window === "undefined") return;
  watching = true;
  const bump = () => {
    const wasIdle = Date.now() - lastActive > IDLE_MS;
    lastActive = Date.now();
    if (wasIdle) wakers.forEach((f) => f());
  };
  for (const ev of ["pointerdown", "keydown", "scroll", "touchstart"] as const) window.addEventListener(ev, bump, { passive: true });
}

export const isActive = (now = Date.now()) => now - lastActive <= IDLE_MS;

/** Run `fn` every `ms` while the tab is visible and in use; also right away on coming back (tab shown, or
 * first use after going idle). Returns a stop function. */
export function pollWhileActive(fn: () => void, ms: number): () => void {
  watch();
  let lastRun = Date.now();
  const run = () => {
    lastRun = Date.now();
    fn();
  };
  const t = setInterval(() => {
    if (document.visibilityState === "visible" && isActive()) run();
  }, ms);
  // Coming back: catch up at once, but never more than once a half-interval.
  const back = () => {
    if (document.visibilityState === "visible" && Date.now() - lastRun > ms / 2) run();
  };
  document.addEventListener("visibilitychange", back);
  wakers.add(back);
  return () => {
    clearInterval(t);
    document.removeEventListener("visibilitychange", back);
    wakers.delete(back);
  };
}
