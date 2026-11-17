"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { MgrPhoto } from "@/components/trash/brand";
import { useBrand } from "@/components/trash/brand";

/**
 * Shared daily-game leaderboard. On the Trash site who you are is picked once and remembered (no
 * accounts: it's a friends league). Where the endpoint reports sign-in (Rafterlore), the board is
 * the league's standings: only signed-in accounts post, each as the one manager it claimed, and
 * signed-out players get a nudge to sign in. The first result you post each day is the one that counts.
 */
const KEY = "trash:me";
export const whoAmI = (prefix = "") => {
  try {
    return localStorage.getItem(prefix + KEY) ?? localStorage.getItem(prefix + "fo:me");
  } catch {
    return null;
  }
};

type Board = {
  enabled: boolean;
  today?: Record<string, { score: number; label: string }>;
  week?: Record<string, { points: number; played: number }>;
  /** Rafterlore: every day on record (a year). */
  all?: Record<string, { points: number; played: number; wins: number }>;
  /** Rafterlore: each manager's all-time high score in this game. */
  best?: Record<string, { score: number; day: string; label: string }>;
  /** Rafterlore: each player's Sleeper team name this season. */
  teams?: Record<string, string>;
  /** Rafterlore: who's looking. Absent on the Trash site (honor system). */
  viewer?: { configured: boolean; signedIn: boolean; linked: boolean; member: boolean; manager: string | null; suggest?: string | null };
};
type Tab = "today" | "week" | "all" | "best";
/** A team name that just repeats the manager's name or username ("Kawhinot13" for KawhiNot) isn't shown twice. */
const squash = (x: string) => x.toLowerCase().replace(/[^a-z]/g, "");
const sameName = (team: string, ...names: (string | undefined)[]) =>
  names.some((n) => n && squash(n).length >= 3 && squash(team).length >= 3 && (squash(team) === squash(n) || squash(team).startsWith(squash(n)) || squash(n).startsWith(squash(team))));
/** A one-time code waiting to show up in the manager's Sleeper team name (kept across app switches). */
type Pending = { challenge: string; code: string; manager: string; expiresAt: string };
const SECTION: Record<string, string> = { dive: "dive", dive2: "dive", trashle: "trashle", lineup: "lineup" };

export type Person = { id: string; nick: string };

/** The finished game's saved progress, read from this browser. */
function savedState(names: string[], key: (k: string) => string) {
  const out: Record<string, unknown> = {};
  for (const n of names)
    try {
      const v = localStorage.getItem(key(n));
      if (v) out[n] = JSON.parse(v);
    } catch {}
  return out;
}

export function Leaderboard({
  game,
  day,
  result,
  people,
  saveKeys,
}: {
  /** Rafterlore: the game's saved progress (storage names without the league prefix), posted with the
   * result so the player's other devices show this same finished game. */
  saveKeys?: string[];
  /** Current managers, for the "who are you" picker and names. */
  people: Person[];
  game: "dive" | "dive2" | "trashle" | "lineup";
  day: string | null;
  /** The finished result to post, once the game is over. score: higher is better. */
  result: { score: number; label: string } | null;
}) {
  const reduce = useReducedMotion();
  const brand = useBrand();
  const ACTIVE = people.map((p) => p.id);
  const nick = (id: string) => people.find((p) => p.id === id)?.nick ?? id;
  const [localMe, setMe] = useState<string | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [tab, setTab] = useState<Tab>("today");
  const [claimErr, setClaimErr] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [notSuggested, setNotSuggested] = useState(false);
  const pendingKey = brand.key("link-code");
  // Picking needs no code any more: forget any code a browser was still holding.
  const [pending, setPendingState] = useState<Pending | null>(() => {
    try {
      localStorage.removeItem(pendingKey);
    } catch {}
    return null;
  });
  const setPending = (p: Pending | null) => {
    setPendingState(p);
    try {
      if (p) localStorage.setItem(pendingKey, JSON.stringify(p));
      else localStorage.removeItem(pendingKey);
    } catch {}
  };
  const [reload, setReload] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMe(whoAmI(brand.storage));
  }, [brand.storage]);

  const viewer = board?.viewer?.configured ? board.viewer : null;
  // Standings mode: you are your account's linked Sleeper user, if they're in this league.
  const me = viewer ? viewer.manager : localMe;

  // Load the board, then post the result once we know who you are. Keyed on the result's values,
  // not the object, so a re-render never posts or fetches again.
  const rs = result?.score;
  const rl = result?.label;
  useEffect(() => {
    if (!day) return;
    let off = false;
    fetch(`${brand.scores}?game=${game}&day=${day}`)
      .then((r) => r.json())
      .then((b: Board) => !off && setBoard(b))
      .catch(() => !off && setBoard({ enabled: false }));
    return () => {
      off = true;
    };
  }, [game, day, brand.scores, reload]);

  // Live: while the page is open and visible, check for new scores every 20 seconds, and right away
  // when you come back to the tab, so everyone sees a finished game without reloading.
  useEffect(() => {
    if (!day) return;
    const tick = () => {
      if (document.visibilityState === "visible") setReload((n) => n + 1);
    };
    const t = setInterval(tick, 20_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [day]);

  const ready = board !== null;
  useEffect(() => {
    if (!day || !ready) return;
    const postedKey = brand.key(`posted:${game}:${day}`);
    let posted = false;
    try {
      posted = localStorage.getItem(postedKey) === me;
    } catch {}
    if (rs !== undefined && me && !posted)
      fetch(brand.scores, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game, day, manager: me, score: rs, label: rl ?? "", ...(viewer && saveKeys ? { state: savedState(saveKeys, brand.key) } : {}) }),
      })
        .then(() => {
          try {
            localStorage.setItem(postedKey, me);
          } catch {}
        })
        .finally(() => setReload((n) => n + 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, day, me, rs, rl, brand, ready]);

  if (!board?.enabled) return null;
  const post = (body: object) =>
    fetch(brand.scores, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(async (r) => ({
        ok: r.ok,
        j: ((await r.json().catch(() => null)) ?? {}) as { error?: string; retry?: boolean; code?: string; challenge?: string; expiresAt?: string; linked?: boolean },
      }))
      .catch(() => ({ ok: false, j: { error: "Couldn't reach Rafterlore. Try again.", retry: true } as { error?: string; retry?: boolean; code?: string; challenge?: string; expiresAt?: string; linked?: boolean } }));
  const pick = (id: string) => {
    if (viewer) {
      // Ask for a one-time code to prove this account is that manager.
      setClaimErr(null);
      post({ claim: true, manager: id }).then(({ ok, j }) => {
        if (ok && j.linked) {
          setReload((n) => n + 1);
        } else setClaimErr(j.error ?? "That didn't work. Try again.");
      });
      return;
    }
    try {
      localStorage.setItem(brand.key(KEY), id);
    } catch {}
    setMe(id);
  };
  const check = () => {
    if (!pending) return;
    setChecking(true);
    setClaimErr(null);
    post({ verify: pending.challenge })
      .then(({ ok, j }) => {
        if (ok && j.linked) {
          setPending(null);
          setReload((n) => n + 1);
        } else {
          setClaimErr(j.error ?? "That didn't work. Try again.");
          if (!j.retry) setPending(null);
        }
      })
      .finally(() => setChecking(false));
  };
  const tabs: Tab[] = board.all ? ["today", "week", "all", ...(board.best ? (["best"] as Tab[]) : [])] : ["today", "week"];
  const dateOf = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const choices = ACTIVE;
  // Only rendered after the board loads in the browser, so window is there.
  const signIn = () => `/api/auth/google?next=${encodeURIComponent(`${window.location.pathname}#${SECTION[game]}`)}`;
  const rows =
    tab === "today"
      ? Object.entries(board.today ?? {})
          .map(([id, v]) => ({ id, main: v.score, sub: v.label }))
          .sort((a, b) => b.main - a.main)
      : tab === "week"
        ? Object.entries(board.week ?? {})
            .map(([id, v]) => ({ id, main: v.points, sub: `${v.played} day${v.played === 1 ? "" : "s"} played` }))
            .sort((a, b) => b.main - a.main)
        : tab === "best"
          ? Object.entries(board.best ?? {})
              .map(([id, v]) => ({ id, main: v.score, sub: `High score, ${dateOf(v.day)}${v.label ? ` · ${v.label}` : ""}` }))
              .sort((a, b) => b.main - a.main)
          : Object.entries(board.all ?? {})
            .map(([id, v]) => ({
              id,
              main: v.points,
              sub: `${v.played} day${v.played === 1 ? "" : "s"} played${v.wins ? `, ${v.wins} daily win${v.wins === 1 ? "" : "s"}` : ""}`,
            }))
            .sort((a, b) => b.main - a.main);

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-display text-2xl font-black">{viewer ? "Standings" : "Leaderboard"}</p>
        <div className="flex flex-wrap gap-1 rounded-full bg-black/30 p-1 text-sm">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={`cursor-pointer rounded-full px-3 py-1 font-semibold ${tab === t ? "bg-[var(--paper)] text-[var(--bin)]" : "text-[var(--paper)]/75"}`}
            >
              {t === "today" ? "Today" : t === "week" ? "This week" : t === "best" ? "High scores" : "All time"}
            </button>
          ))}
        </div>
      </div>
      {viewer && !viewer.signedIn ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--paper)]/25 bg-white/6 px-4 py-3">
          <p className="min-w-0 flex-1 basis-56 text-sm">
            <span className="font-semibold">Sign in to get on the {brand.name} standings.</span>{" "}
            <span className="text-[var(--muted)]">
              {result ? "Today's score still counts once you're in." : "Your daily scores add up over the season."}
            </span>
          </p>
          <a
            href={signIn()}
            className="inline-flex h-10 shrink-0 items-center rounded-full bg-[var(--paper)] px-5 text-sm font-semibold text-[var(--bin)] transition-transform duration-150 active:scale-[0.97]"
          >
            Sign in with Google
          </a>
        </div>
      ) : null}
      {viewer?.linked && !viewer.member ? (
        <p className="mt-3 rounded-xl bg-white/6 px-4 py-3 text-sm text-[var(--muted)]">
          You&apos;re not a manager in this league, so you can follow the standings but not post to them.
        </p>
      ) : null}
      {viewer?.signedIn && !viewer.linked && pending ? (
        <div className="mt-3 rounded-xl border border-[var(--paper)]/25 bg-white/6 p-4 text-sm">
          <p className="font-semibold">Prove you&apos;re {nick(pending.manager)}</p>
          <p className="mt-1 text-[var(--muted)]">
            In the Sleeper app, add this code anywhere in your team name in this league, save, then check. Only you (or your
            commissioner) can change your team name. Change it back once you&apos;re linked.
          </p>
          <p className="font-display mt-3 text-3xl font-black tracking-wider break-words select-all">{pending.code}</p>
          {claimErr ? (
            <p role="alert" className="mt-2 text-[var(--paper)]">
              {claimErr}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={check}
              disabled={checking}
              className="inline-flex h-10 cursor-pointer items-center rounded-full bg-[var(--paper)] px-5 font-semibold text-[var(--bin)] transition-transform duration-150 active:scale-[0.97] disabled:opacity-60"
            >
              {checking ? "Checking…" : "Check"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPending(null);
                setClaimErr(null);
              }}
              className="inline-flex h-10 cursor-pointer items-center rounded-full border border-white/15 px-5 font-semibold transition-colors hover:bg-white/8"
            >
              Pick someone else
            </button>
          </div>
        </div>
      ) : null}
      {viewer?.signedIn && !viewer.linked && !pending && viewer.suggest && !notSuggested ? (
        <div className="mt-3 rounded-xl border border-[var(--paper)]/25 bg-white/6 p-4 text-sm">
          <div className="flex items-center gap-3">
            <MgrPhoto id={viewer.suggest} alt="" width={40} height={40} className="size-10 shrink-0 rounded-full object-cover" />
            <p className="min-w-0 flex-1">
              <span className="block font-semibold break-words">Play as {nick(viewer.suggest)}?</span>
              <span className="block text-[var(--muted)]">That&apos;s the Sleeper username saved on your account.</span>
            </p>
          </div>
          {claimErr ? (
            <p role="alert" className="mt-2 text-[var(--paper)]">
              {claimErr}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => pick(viewer.suggest!)}
              className="inline-flex h-10 cursor-pointer items-center rounded-full bg-[var(--paper)] px-5 font-semibold text-[var(--bin)] transition-transform duration-150 active:scale-[0.97]"
            >
              Yes, that&apos;s me
            </button>
            <button
              type="button"
              onClick={() => setNotSuggested(true)}
              className="inline-flex h-10 cursor-pointer items-center rounded-full border border-white/15 px-5 font-semibold transition-colors hover:bg-white/8"
            >
              Someone else
            </button>
          </div>
        </div>
      ) : null}
      {(!me && (!viewer || (viewer.signedIn && !viewer.linked && !pending && (!viewer.suggest || notSuggested)))) ? (
        <div className="mt-3">
          <p className="text-sm text-[var(--muted)]">
            {viewer
              ? "Which manager are you? Pick yourself once: your account plays as them in every league they're in."
              : "Who are you? Pick once and your results post to the board."}
          </p>
          {claimErr ? (
            <p role="alert" className="mt-1 text-sm text-[var(--paper)]">
              {claimErr}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {viewer
              ? choices.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => pick(id)}
                    className="flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-white/15 py-1 pr-4 pl-1 text-sm font-semibold transition-[background-color,transform] duration-150 hover:bg-white/8 active:scale-95"
                  >
                    <MgrPhoto id={id} alt="" width={32} height={32} className="size-8 rounded-full object-cover" />
                    <span className="break-words">{nick(id)}</span>
                  </button>
                ))
              : choices.map((id) => (
                  <button key={id} type="button" onClick={() => pick(id)} aria-label={nick(id)} title={nick(id)} className="size-10 cursor-pointer rounded-full opacity-70 transition-[opacity,transform] duration-150 hover:opacity-100 active:scale-95">
                    <MgrPhoto id={id} alt="" width={40} height={40} className="size-10 rounded-full object-cover" />
                  </button>
                ))}
          </div>
        </div>
      ) : null}
      {rows.length ? (
        <ol className="mt-3 space-y-1.5">
          {rows.map((r, i) => (
            <motion.li
              key={r.id}
              initial={reduce ? false : { opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 ${r.id === me ? "bg-white/12 ring-1 ring-[var(--paper)]/50" : "bg-black/20"}`}
            >
              <span className="font-display w-6 text-xl font-black text-[var(--muted)] tabular-nums">{i + 1}</span>
              <MgrPhoto id={r.id} alt="" width={30} height={30} className="size-[30px] rounded-full object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block break-words font-semibold">
                  {nick(r.id)}
                  {board.teams?.[r.id] && !sameName(board.teams[r.id], nick(r.id), brand.names?.[r.id]) ? (
                    <span className="font-normal text-[var(--paper)]/70"> · {board.teams[r.id]}</span>
                  ) : null}
                </span>
                <span className="block break-words text-xs text-[var(--muted)]">{r.sub}</span>
              </span>
              <span className="font-display text-2xl font-black tabular-nums">{r.main}</span>
            </motion.li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-[var(--muted)]">Nobody&apos;s on the board yet{tab === "today" ? " today" : tab === "week" ? " this week" : ""}. Be first.</p>
      )}
      {me && viewer ? <p className="mt-3 text-xs text-[var(--muted)]">You play as {nick(me)}, the Sleeper username on your account.</p> : null}
      {me && !viewer ? (
        <button type="button" onClick={() => setMe(null)} className="mt-3 cursor-pointer text-xs text-[var(--muted)] underline-offset-4 hover:underline">
          Not {nick(me)}? Switch
        </button>
      ) : null}
    </div>
  );
}
