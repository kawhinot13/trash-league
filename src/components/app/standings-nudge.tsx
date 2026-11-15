"use client";

import { useMe } from "@/components/app/account";

/**
 * Above the daily games, for signed-out visitors: signing in puts your scores on this league's
 * standings. Shows nothing when sign-in is off or you're already signed in.
 */
export function StandingsNudge({ league }: { league: string }) {
  const me = useMe();
  if (!me?.configured || me.account) return null;
  const next = `${window.location.pathname}#dive`;
  return (
    <div className="mx-auto mb-10 flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 md:px-10">
      <div className="flex w-full flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-[var(--bin-2)] p-5">
        <div className="min-w-0 flex-1 basis-64">
          <p className="font-display text-2xl font-black break-words">Play for the {league} standings</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Sign in and every daily game you play counts toward a running table against the rest of your league. You can
            still play without it.
          </p>
        </div>
        <a
          href={`/api/auth/google?next=${encodeURIComponent(next)}`}
          className="inline-flex h-11 shrink-0 items-center rounded-full bg-[var(--paper)] px-6 font-semibold text-[var(--bin)] transition-transform duration-150 active:scale-[0.97]"
        >
          Sign in with Google
        </a>
      </div>
    </div>
  );
}
