"use client";

import { useMe } from "@/components/app/account";
import { useBrand } from "@/components/trash/brand";

/**
 * Daily games are for signed-in players: signed out, a game shows a sign-in card instead. While the
 * account is loading, a quiet placeholder keeps the space. When sign-in isn't set up on the server,
 * everyone plays. (The game's answer still ships in the page; this is an invitation, not a lock.)
 */
export function PlayGate({ game, anchor, children }: { game: string; anchor: string; children: React.ReactNode }) {
  const me = useMe();
  const brand = useBrand();
  if (me === null) return <div aria-busy className="min-h-[18rem] rounded-[28px] border border-white/10 bg-black/20" />;
  if (!me.configured || me.account) return <>{children}</>;
  const next = `${window.location.pathname}#${anchor}`;
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[rgba(16,40,30,0.55)] p-6 text-center md:p-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgba(233,196,106,0.12),transparent_70%)]" />
      <div className="relative mx-auto max-w-md">
        <p className="font-display text-3xl leading-none font-black md:text-4xl">Sign in to play {game}</p>
        <p className="mt-3 text-[var(--muted)]">
          Daily games are for members. It&apos;s free: sign in with Google and your scores go on the {brand.name} standings,
          today, this week and all time.
        </p>
        <a
          href={`/api/auth/google?next=${encodeURIComponent(next)}`}
          className="mt-6 inline-flex h-12 items-center rounded-full bg-[var(--paper)] px-7 font-semibold text-[var(--bin)] transition-transform duration-150 active:scale-[0.97]"
        >
          Sign in with Google
        </a>
        <p className="mt-3 text-xs text-[var(--muted)]">We keep your first name and your leagues. No email, no password.</p>
      </div>
    </div>
  );
}
