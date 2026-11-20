"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { useMe } from "@/components/app/account";
import { MgrPhoto, useBrand } from "@/components/trash/brand";
import { STATE_NAME } from "@/lib/core/game-state";

/**
 * Daily games, Rafterlore. Before you play: signed in, and the game knows which manager you are.
 * You can only be the manager whose Sleeper username is on your account (saved when you search it,
 * or typed here once), and you only play in leagues that manager is in. While loading, a quiet
 * placeholder keeps the space; with sign-in switched off, everyone plays. (The answer still ships in
 * the page, so this is an invitation, not a lock.)
 */
type Viewer = { configured: boolean; signedIn: boolean; linked: boolean; member: boolean; manager: string | null; suggest?: string | null };
type Played = Record<string, { score: number; label: string; state: Record<string, unknown> | null }>;
type Who = { enabled: boolean; viewer?: Viewer; played?: Played; pick?: { current: string[]; taken: string[] } | null; resets?: Record<string, string> } | null;
/** What each board's game saves in the browser for a day (cleared when that day's game is reset). */
const SAVED_AS: Record<string, (day: string) => string[]> = { dive2: (day) => [`dive3:${day}`] };

/** A day's game was reset (everyone plays again): forget this browser's finished copy, once per reset. */
function clearResets(v: Who, prefix: string, day: string) {
  for (const [game, token] of Object.entries(v?.resets ?? {})) {
    try {
      const mark = `${prefix}reset:${game}:${day}`;
      if (localStorage.getItem(mark) === token) continue;
      for (const k of SAVED_AS[game]?.(day) ?? []) localStorage.removeItem(prefix + k);
      localStorage.removeItem(`${prefix}posted:${game}:${day}`);
      localStorage.setItem(mark, token);
    } catch {}
  }
}

const todayET = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
/** The game ids behind each section. */
const GAME_OF: Record<string, string> = { dive: "dive2", trashle: "trashle", lineup: "lineup" };

/** Put today's finished games from the account into this browser before the games mount, so a
 * second device opens on the same result instead of a fresh game. The account's copy wins. */
function restore(v: Who, prefix: string, day: string) {
  if (!v?.played || !v.viewer?.manager) return;
  for (const [game, g] of Object.entries(v.played)) {
    try {
      for (const [name, value] of Object.entries(g.state ?? {})) if (STATE_NAME.test(name)) localStorage.setItem(prefix + name, JSON.stringify(value));
      // Already posted: the board doesn't post again from this device.
      if (g.state) localStorage.setItem(`${prefix}posted:${game}:${day}`, v.viewer.manager);
    } catch {}
  }
}

// One shared "who are you here" per league, so the three games on a page ask once and agree.
const store = new Map<string, { v: Who; subs: Set<() => void>; loading: boolean; prefix: string }>();
function load(url: string) {
  const e = store.get(url)!;
  if (e.loading) return;
  e.loading = true;
  const day = todayET();
  void fetch(`${url}?who=1&day=${day}`, { cache: "no-store" })
    .then((r) => r.json() as Promise<Who>)
    .catch(() => ({ enabled: false }))
    .then((v) => {
      clearResets(v, e.prefix, day);
      restore(v, e.prefix, day);
      e.v = v;
      e.loading = false;
      e.subs.forEach((f) => f());
    });
}
function useWho(url: string, on: boolean, prefix: string): Who {
  return useSyncExternalStore(
    (f) => {
      if (!on) return () => {};
      if (!store.has(url)) store.set(url, { v: null, subs: new Set(), loading: false, prefix });
      const e = store.get(url)!;
      e.subs.add(f);
      if (!e.v) load(url);
      return () => e.subs.delete(f);
    },
    () => (on ? (store.get(url)?.v ?? null) : null),
    () => null,
  );
}
const refresh = (url: string) => {
  const e = store.get(url);
  if (e) {
    e.v = null;
    load(url);
  }
};

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[rgba(16,40,30,0.55)] p-6 text-center md:p-10">
    <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgba(233,196,106,0.12),transparent_70%)]" />
    <div className="relative mx-auto max-w-md">{children}</div>
  </div>
);
const btn = "inline-flex h-12 items-center rounded-full bg-[var(--paper)] px-7 font-semibold text-[var(--bin)] transition-transform duration-150 active:scale-[0.97] disabled:opacity-60";

export function PlayGate({ game, anchor, children, primary }: { game: string; anchor: string; children: React.ReactNode; primary?: boolean }) {
  const me = useMe();
  const brand = useBrand();
  const signedIn = !!me?.configured && !!me.account;
  const who = useWho(brand.scores, signedIn, brand.key(""));
  const [name, setName] = useState(me?.account?.sleeper ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);

  if (me === null) return <div aria-busy className="min-h-[18rem] rounded-[28px] border border-white/10 bg-black/20" />;
  if (!me.configured) return <>{children}</>;
  if (!me.account) {
    const next = `${window.location.pathname}#${anchor}`;
    return (
      <Shell>
        <p className="font-display text-3xl leading-none font-black md:text-4xl">Sign in to play {game}</p>
        <p className="mt-3 text-[var(--muted)]">
          Daily games are for members. It&apos;s free: sign in with Google and your scores go on the {brand.name} standings, today, this
          week and all time.
        </p>
        <a href={`/api/auth/google?next=${encodeURIComponent(next)}`} className={`mt-6 ${btn}`}>
          Sign in with Google
        </a>
        <p className="mt-3 text-xs text-[var(--muted)]">We keep your first name and your leagues. No email, no password.</p>
      </Shell>
    );
  }
  if (who === null) return <div aria-busy className="min-h-[18rem] rounded-[28px] border border-white/10 bg-black/20" />;
  const v = who.viewer;
  // Leagues without standings (Yahoo for now): signed-in members just play.
  if (!who.enabled || !v || !v.configured) return <>{children}</>;
  if (v.linked && v.member) {
    // Finished today on another device before results were saved with the account: don't offer a replay.
    const done = who.played?.[GAME_OF[anchor] ?? ""];
    const SAVE: Record<string, string> = { dive: "dive3", trashle: "trashle", lineup: "lineup" };
    let here = false;
    try {
      here = !!localStorage.getItem(brand.key(`${SAVE[anchor]}:${todayET()}`));
    } catch {}
    if (done && !done.state && !here)
      return (
        <Shell>
          <p className="font-display text-3xl leading-none font-black md:text-4xl">You already played today</p>
          <p className="mt-3 text-[var(--muted)]">
            Your {game} score today: <span className="font-display text-2xl font-black text-[var(--paper)] tabular-nums">{done.score}</span>
            {done.label ? <span className="block text-sm">{done.label}</span> : null}
          </p>
          <p className="mt-3 text-sm text-[var(--muted)]">One try a day, on any device. A new one opens at midnight Eastern.</p>
        </Shell>
      );
    return <>{children}</>;
  }
  if (v.linked && !v.member)
    return (
      <Shell>
        <p className="font-display text-3xl leading-none font-black md:text-4xl">You&apos;re not in this league</p>
        <p className="mt-3 text-[var(--muted)]">
          Daily games are for each league&apos;s own managers, playing as themselves. Your account plays as{" "}
          <span className="font-semibold text-[var(--paper)]">{me.account.sleeper ?? "your Sleeper username"}</span>, who isn&apos;t a
          manager here.
        </p>
        <Link href="/l" className={`mt-6 ${btn}`}>
          Go to your leagues
        </Link>
      </Shell>
    );

  // Not linked yet: confirm who you are, once (only the first game on the page asks; the others point to it).
  if (!primary)
    return (
      <Shell>
        <p className="font-display text-2xl leading-none font-black md:text-3xl">Confirm who you are first</p>
        <p className="mt-3 text-[var(--muted)]">Do it once in the first game above, then {game} opens.</p>
      </Shell>
    );
  const claim = async (body: object) => {
    setBusy(true);
    setErr(null);
    const r = await fetch(brand.scores, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ claim: true, ...body }) }).catch(
      () => null,
    );
    const j = ((await r?.json().catch(() => null)) ?? {}) as { error?: string; linked?: boolean };
    setBusy(false);
    if (r?.ok && j.linked) refresh(brand.scores);
    else setErr(j.error ?? "That didn't work. Try again.");
  };
  const suggested = v.suggest ? brand.names?.[v.suggest] ?? null : null;
  return (
    <Shell>
      <p className="font-display text-3xl leading-none font-black md:text-4xl">Who are you?</p>
      {suggested ? (
        <>
          <p className="mt-3 text-[var(--muted)]">
            Your account&apos;s Sleeper username is <span className="font-semibold text-[var(--paper)]">{me.account.sleeper}</span>. That&apos;s{" "}
            <span className="font-semibold text-[var(--paper)]">{suggested}</span> in {brand.name}.
          </p>
          <button type="button" disabled={busy} onClick={() => void claim({ manager: v.suggest })} className={`mt-6 ${btn}`}>
            {busy ? "One sec…" : `Play as ${suggested}`}
          </button>
        </>
      ) : me.account.sleeper ? (
        <>
          <p className="mt-3 text-[var(--muted)]">
            Your account plays as <span className="font-semibold text-[var(--paper)]">{me.account.sleeper}</span>, who isn&apos;t a manager in{" "}
            {brand.name}. Daily games here are for this league&apos;s managers.
          </p>
          <Link href="/l" className={`mt-6 ${btn}`}>
            Go to your leagues
          </Link>
        </>
      ) : who.pick?.current.length && !typing ? (
        <>
          <p className="mt-3 text-[var(--muted)]">Tap your team. You&apos;ll play as them in {brand.name}, and only as them.</p>
          <ul className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {who.pick.current.map((id) => {
              const taken = who.pick!.taken.includes(id);
              const on = chosen === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    disabled={taken || busy}
                    aria-pressed={on}
                    onClick={() => setChosen(id)}
                    className={`flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-2xl p-2 transition-[background-color,transform] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-35 ${on ? "bg-[var(--paper)]/15 ring-2 ring-[var(--paper)]" : "bg-black/20 hover:bg-black/35"}`}
                  >
                    <MgrPhoto id={id} alt="" width={56} height={56} className="size-14 rounded-full object-cover" />
                    <span className="text-xs leading-tight font-semibold break-words">{brand.names?.[id] ?? "Manager"}</span>
                    {taken ? <span className="text-[10px] text-[var(--muted)]">taken</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <button type="button" disabled={!chosen || busy} onClick={() => chosen && void claim({ manager: chosen })} className={`mt-5 ${btn}`}>
            {busy ? "One sec…" : chosen ? `I'm ${brand.names?.[chosen] ?? "this manager"}` : "Pick your team"}
          </button>
          <button type="button" onClick={() => setTyping(true)} className="mt-3 block w-full cursor-pointer text-xs text-[var(--muted)] underline-offset-4 hover:underline">
            Type your Sleeper username instead
          </button>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) void claim({ username: name.trim() });
          }}
        >
          <p className="mt-3 text-[var(--muted)]">
            Enter your Sleeper username. You play as that manager in every league they&apos;re in, and only as them.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <label htmlFor={`who-${anchor}`} className="sr-only">
              Your Sleeper username
            </label>
            <input
              id={`who-${anchor}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Sleeper username"
              autoCapitalize="none"
              autoComplete="username"
              spellCheck={false}
              className="h-12 min-w-0 flex-1 rounded-full border border-[var(--line)] bg-[var(--bin-2)] px-5 text-base placeholder:text-[var(--muted)] focus:border-[var(--wood)] focus:outline-none"
            />
            <button type="submit" disabled={busy || !name.trim()} className={btn}>
              {busy ? "One sec…" : "That's me"}
            </button>
          </div>
        </form>
      )}
      {err ? (
        <p role="alert" className="mt-3 text-sm text-[var(--paper)]">
          {err}
        </p>
      ) : null}
    </Shell>
  );
}
