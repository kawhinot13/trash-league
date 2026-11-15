"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RLoader } from "@/components/app/mark";
import { USE_ACK_KEY, USE_ACK_TEXT, USE_ACK_VERSION } from "@/lib/app/use-ack";

const ackedBefore = () => {
  try {
    return localStorage.getItem(USE_ACK_KEY) === USE_ACK_VERSION;
  } catch {
    return false;
  }
};

/**
 * A league Rafterlore hasn't stored yet. The page itself stays cacheable, so the first import is
 * started from here through the import API (which checks the id with Sleeper and applies the
 * per-network limits), then the page reloads with the league. A first import asks the visitor to
 * confirm recreational use once (remembered in this browser).
 */
export function Importer({ leagueId }: { leagueId: string }) {
  const router = useRouter();
  const [state, setState] = useState<{ title: string; text: string } | null>(null);
  const [asking, setAsking] = useState(false);
  const [checked, setChecked] = useState(false);
  const [go, setGo] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ackedBefore()) setGo(true);
    else setAsking(true);
  }, []);

  useEffect(() => {
    if (!go || started.current) return;
    started.current = true;
    (async () => {
      try {
        const r = await fetch(`/api/l/${leagueId}/import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ack: USE_ACK_VERSION }),
        });
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        if (r.ok) return router.refresh();
        const title =
          r.status === 404 ? "No league here" : r.status === 429 ? "Slow down a little" : r.status === 410 ? "This league was removed" : "Couldn't load this league";
        setState({ title, text: j.error ?? "Sleeper didn't answer. Reload in a moment." });
      } catch {
        setState({ title: "Couldn't load this league", text: "Sleeper didn't answer. Reload in a moment." });
      }
    })();
  }, [go, leagueId, router]);

  const confirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checked) return;
    try {
      localStorage.setItem(USE_ACK_KEY, USE_ACK_VERSION);
    } catch {}
    setAsking(false);
    setGo(true);
  };

  return (
    <main className="mx-auto max-w-6xl px-5 pt-36 pb-24 md:px-10" aria-busy={!state}>
      {/* Not a league page yet (and maybe never): keep it out of search results. */}
      <meta name="robots" content="noindex" />
      {asking ? (
        <form onSubmit={confirm} className="mx-auto flex min-h-[50dvh] max-w-xl flex-col justify-center">
          <h1 className="font-display text-4xl font-black md:text-5xl">Open this league</h1>
          <p className="mt-3 text-[var(--muted)]">
            Rafterlore is an independent fantasy sports history and analytics platform, for recreational and informational
            use only. See the{" "}
            <Link href="/terms" className="underline underline-offset-4">
              terms
            </Link>
            .
          </p>
          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--bin-2)] p-4">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-[var(--paper)]"
            />
            <span className="break-words">{USE_ACK_TEXT}</span>
          </label>
          <button
            type="submit"
            disabled={!checked}
            className="mt-5 h-12 self-start rounded-full bg-[var(--paper)] px-7 font-semibold text-[var(--bin)] transition-transform duration-150 active:scale-[0.97] disabled:opacity-50"
          >
            Open league
          </button>
        </form>
      ) : state ? (
        <>
          <h1 className="font-display text-5xl font-black md:text-7xl">{state.title}</h1>
          <p className="mt-4 max-w-[56ch] text-lg text-[var(--muted)]">{state.text}</p>
          <Link href="/l" className="mt-8 inline-block rounded-full bg-[var(--paper)] px-6 py-3 font-semibold text-[var(--bin)]">
            Find a league
          </Link>
        </>
      ) : !go ? (
        <div className="min-h-[50dvh]" />
      ) : (
        <div className="flex min-h-[50dvh] flex-col items-center justify-center text-center">
          <RLoader label="First visit" className="size-24" />
          <h1 className="font-display mt-8 text-4xl font-black md:text-5xl">Fetching this league from Sleeper</h1>
          <p className="mt-3 text-[var(--muted)]">Finding every season. This takes a few seconds.</p>
        </div>
      )}
    </main>
  );
}
