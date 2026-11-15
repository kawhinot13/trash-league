"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * A league Rafterlore hasn't stored yet. The page itself stays cacheable, so the first import is
 * started from here through the import API (which checks the id with Sleeper and applies the
 * per-network limits), then the page reloads with the league.
 */
export function Importer({ leagueId }: { leagueId: string }) {
  const router = useRouter();
  const [state, setState] = useState<{ title: string; text: string } | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const r = await fetch(`/api/l/${leagueId}/import`, { method: "POST" });
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        if (r.ok) return router.refresh();
        const title =
          r.status === 404 ? "No league here" : r.status === 429 ? "Slow down a little" : r.status === 410 ? "This league was removed" : "Couldn't load this league";
        setState({ title, text: j.error ?? "Sleeper didn't answer. Reload in a moment." });
      } catch {
        setState({ title: "Couldn't load this league", text: "Sleeper didn't answer. Reload in a moment." });
      }
    })();
  }, [leagueId, router]);

  return (
    <main className="mx-auto max-w-6xl px-5 pt-36 pb-24 md:px-10" aria-busy={!state}>
      {/* Not a league page yet (and maybe never): keep it out of search results. */}
      <meta name="robots" content="noindex" />
      {state ? (
        <>
          <h1 className="font-display text-5xl font-black md:text-7xl">{state.title}</h1>
          <p className="mt-4 max-w-[56ch] text-lg text-[var(--muted)]">{state.text}</p>
          <Link href="/l" className="mt-8 inline-block rounded-full bg-[var(--paper)] px-6 py-3 font-semibold text-[var(--bin)]">
            Find a league
          </Link>
        </>
      ) : (
        <>
          <div className="flex gap-3 overflow-hidden">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="banner h-52 w-32 shrink-0 animate-pulse bg-[var(--bin-2)] md:h-60 md:w-36" />
            ))}
          </div>
          <h1 className="font-display mt-10 text-4xl font-black md:text-5xl">Fetching this league from Sleeper</h1>
          <p className="mt-3 text-[var(--muted)]">First visit: finding every season. This takes a few seconds.</p>
        </>
      )}
    </main>
  );
}
