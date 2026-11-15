"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FoundLeague } from "@/lib/app/find";
import { Avatar } from "@/components/app/avatar";
import { updateMe, useMe } from "@/components/app/account";

type Result = { user: { name: string; avatar: string | null }; leagues: FoundLeague[] };

/** Username in, leagues out. Also takes a pasted league id or Sleeper league link. */
export function Finder() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const me = useMe();
  const account = me?.account ?? null;

  const lookup = useCallback(
    async (v: string, remember: boolean) => {
      setBusy(true);
      setErr(null);
      try {
        const r = await fetch(`/api/l/find?u=${encodeURIComponent(v)}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Something went wrong.");
        setRes(j);
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

  // Signed in with a saved username: show that person's leagues straight away.
  const auto = useRef(false);
  useEffect(() => {
    if (auto.current || !account?.sleeper) return;
    auto.current = true;
    setQ(account.sleeper);
    void lookup(account.sleeper, false);
  }, [account, lookup]);

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

  return (
    <div>
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
        {me?.configured && !account ? " Sign in to have Rafterlore remember your leagues." : ""}
      </p>
      {account?.leagues.length ? (
        <div className="mt-10">
          <p className="font-semibold">Recently opened</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {account.leagues.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/l/${l.id}`}
                  className="inline-block rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold transition-colors hover:border-[var(--wood)]"
                >
                  {l.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
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
                    <Link href={`/l/${l.leagueId}`} className="group flex items-center gap-4 py-4">
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

function LeagueRow({ l }: { l: FoundLeague }) {
  return (
    <div className="flex min-w-0 items-center gap-4">
      <Avatar src={l.avatar} name={l.name} size={40} />
      <div className="min-w-0">
        <p className="truncate font-semibold">{l.name}</p>
        <p className="truncate text-sm text-[var(--muted)]">
          {l.years}, {l.teams} teams. {l.format.label}.{l.linked ? " Earlier seasons linked." : ""}
        </p>
      </div>
    </div>
  );
}
