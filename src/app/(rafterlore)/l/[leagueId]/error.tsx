"use client";

import Link from "next/link";

/** A league page that couldn't load (database or Sleeper trouble). Never shows the error itself. */
export default function LeagueError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-6xl px-5 pt-36 pb-24 md:px-10">
      <meta name="robots" content="noindex" />
      <h1 className="font-display text-5xl font-black md:text-7xl">Couldn&apos;t load this league</h1>
      <p className="mt-4 max-w-[56ch] text-lg text-[var(--muted)]">Something on our end didn&apos;t answer. Try again in a moment.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="rounded-full bg-[var(--paper)] px-6 py-3 font-semibold text-[var(--bin)]">
          Try again
        </button>
        <Link href="/l" className="rounded-full border border-[var(--line)] px-6 py-3 font-semibold text-[var(--paper)] hover:bg-white/5">
          Find a league
        </Link>
      </div>
    </main>
  );
}
