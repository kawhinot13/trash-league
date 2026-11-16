"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { FoundLeague } from "@/lib/app/find";
import { Avatar } from "@/components/app/avatar";
import { updateMe, useMe, useMyLeagues } from "@/components/app/account";

type Result = { user: { name: string; avatar: string | null }; leagues: FoundLeague[] };

const subscribeNothing = () => () => {};

/**
 * Rafterlore's home. Returning visitors see "Your leagues" (every league they've opened here) and
 * add another on purpose; first-timers get the search: username in, leagues out, or a pasted
 * league id or Sleeper league link.
 */
export function Finder() {
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const mine = useMyLeagues();
  const [adding, setAdding] = useState(false);
  const router = useRouter();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const me = useMe();
  const account = me?.account ?? null;

  // The username behind the current results (for the anonymous unique-people count).
  const [searched, setSearched] = useState("");
  const lookup = useCallback(
    async (v: string, remember: boolean) => {
      setBusy(true);
      setErr(null);
      try {
        const r = await fetch(`/api/l/find?u=${encodeURIComponent(v)}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Something went wrong.");
        setRes(j);
        setSearched(v);
        // Signed in: remember the username that found leagues, so they show up next time.
        if (remember && j.user && account && account.sleeper?.toLowerCase() !== v.toLowerCase()) void updateMe({ sleeper: v });
      } catch (x) {
        setRes(null);
        setErr(x instanceof Error ? x.message : "Something went wrong.");
      } finally {
        setBusy(false);
      }
    },
    [account],
  );

  // Back from a sign-in that didn't go through.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (new URLSearchParams(window.location.search).get("signin") === "failed") setErr("Sign-in didn't go through. Try again.");
  }, []);

  // Signed in with a saved username: have it ready in the search box.
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !account?.sleeper) return;
    prefilled.current = true;
    setQ(account.sleeper);
  }, [account]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = q.trim();
    const id = v.match(/(\d{15,22})/)?.[1];
    if (id) {
      router.push(`/l/${id}`);
      return;
    }
    await lookup(v, true);
  };

  // Before the browser has read your saved leagues, keep the space without flashing the search.
  if (!mounted) return <div className="min-h-[140px]" aria-hidden />;
  const showMine = mine.leagues.length > 0 && !adding;
  if (showMine)
    return (
      <div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-display text-4xl font-black md:text-5xl">Your leagues</h2>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="h-11 rounded-full bg-[var(--paper)] px-6 font-semibold text-[var(--bin)] transition-transform duration-150 active:scale-[0.97]"
          >
            Add a league
          </button>
        </div>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {mine.leagues.map((l) => (
            <li key={l.id} className="group relative">
              <Link
                href={`/l/${l.id}`}
                className="flex min-h-20 items-center gap-4 rounded-2xl border border-[var(--line)] bg-[var(--bin-2)] p-4 pr-14 transition-colors hover:border-[var(--wood)]"
              >
                <Avatar src={null} name={l.name} size={44} />
                <span className="font-display min-w-0 break-words text-2xl font-black">{l.name}</span>
              </Link>
              <button
                type="button"
                onClick={() => mine.remove(l.id)}
                aria-label={`Remove ${l.name} from your leagues`}
                title="Remove from your leagues"
                className="absolute top-1/2 right-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-xl text-[var(--muted)] transition-colors hover:bg-white/8 hover:text-[var(--paper)]"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-[var(--muted)]">
          Every league you open on Rafterlore stays here until you remove it.
          {me?.configured && !account ? " Sign in to keep them on every device." : ""}
        </p>
      </div>
    );

  return (
    <div>
      {mine.leagues.length ? (
        <button type="button" onClick={() => setAdding(false)} className="mb-5 text-sm font-semibold text-[var(--muted)] hover:text-[var(--paper)]">
          ← Back to your leagues
        </button>
      ) : null}
      <form onSubmit={submit} className="flex max-w-xl flex-col gap-3 sm:flex-row">
        <label htmlFor="u" className="sr-only">
          Sleeper username or league id
        </label>
        <input
          id="u"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Your Sleeper username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          className="h-[52px] min-w-0 shrink-0 rounded-full sm:flex-1 border border-[var(--line)] bg-[var(--bin-2)] px-5 text-base placeholder:text-[var(--muted)] focus:border-[var(--wood)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="h-[52px] rounded-full bg-[var(--paper)] px-7 font-semibold text-[var(--bin)] transition-transform duration-150 active:scale-[0.97] disabled:opacity-60"
        >
          {busy ? "Looking…" : "Find my leagues"}
        </button>
      </form>
      <p className="mt-3 text-sm text-[var(--muted)]">
        A league id or Sleeper league link works too.
        {me?.configured && !account ? " Sign in to keep your leagues on every device." : ""}
      </p>
      {me?.yahoo ? (
        <p className="mt-2 text-sm">
          <Link href="/l/yahoo" className="font-semibold text-[var(--paper)] underline underline-offset-4">
            Yahoo football league? Bring it in here
          </Link>
          <span className="text-[var(--muted)]"> (private to its managers).</span>
        </p>
      ) : null}
      {err ? (
        <p role="alert" className="mt-6 text-[var(--paper)]">
          {err}
        </p>
      ) : null}
      {res ? (
        <div className="mt-10">
          <div className="flex items-center gap-3">
            <Avatar src={res.user.avatar} name={res.user.name} size={36} />
            <p className="font-semibold">
              {res.user.name}&apos;s leagues
            </p>
          </div>
          {res.leagues.length ? (
            <ul className="mt-4 divide-y divide-[var(--line)] border-y border-[var(--line)]">
              {res.leagues.map((l) => (
                <li key={l.leagueId}>
                  {l.format.supported ? (
                    <Link href={`/l/${l.leagueId}`} onClick={() => counted(searched, l.leagueId)} className="group flex items-center gap-4 py-4">
                      <LeagueRow l={l} />
                      <span className="ml-auto shrink-0 rounded-full border border-[var(--line)] px-4 py-1.5 text-sm font-semibold transition-colors group-hover:border-[var(--wood)]">
                        Open
                      </span>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-4 py-4 opacity-60">
                      <LeagueRow l={l} />
                      <span className="ml-auto shrink-0 text-right text-xs text-[var(--muted)]">{l.format.reason}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-[var(--muted)]">No basketball or football leagues this season or last. Check the username, or paste a league id.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Counts a username once (as an anonymous hash) when a league is opened from its search results. */
function counted(u: string, league: string) {
  if (!u) return;
  try {
    navigator.sendBeacon("/api/l/find/opened", new Blob([JSON.stringify({ u, league })], { type: "application/json" }));
  } catch {}
}

function LeagueRow({ l }: { l: FoundLeague }) {
  return (
    <div className="flex min-w-0 items-center gap-4">
      <Avatar src={l.avatar} name={l.name} size={40} />
      <div className="min-w-0">
        <p className="break-words font-semibold">{l.name}</p>
        <p className="break-words text-sm text-[var(--muted)]">
          {l.years}, {l.teams} teams. {l.format.label}.{l.linked ? " Earlier seasons linked." : ""}
        </p>
      </div>
    </div>
  );
}
