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
  /** Rafterlore: who's looking. Absent on the Trash site (honor system). */
  viewer?: { configured: boolean; signedIn: boolean; linked: boolean; member: boolean; manager: string | null; taken: string[] };
};
type Tab = "today" | "week" | "all";
const SECTION: Record<string, string> = { dive: "dive", dive2: "dive", trashle: "trashle", lineup: "lineup" };

export type Person = { id: string; nick: string };

export function Leaderboard({
  game,
  day,
  result,
  people,
}: {
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
        body: JSON.stringify({ game, day, manager: me, score: rs, label: rl ?? "" }),
      })
        .then(() => {
          try {
            localStorage.setItem(postedKey, me);
          } catch {}
        })
        .finally(() => setReload((n) => n + 1));
  }, [game, day, me, rs, rl, brand, ready]);

  if (!board?.enabled) return null;
  const pick = (id: string) => {
    if (viewer) {
      // Link this account to that Sleeper user, for every league.
      setClaimErr(null);
      fetch(brand.scores, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ claim: true, manager: id }) })
        .then(async (r) => {
          if (!r.ok) setClaimErr(((await r.json().catch(() => null)) as { error?: string } | null)?.error ?? "That didn't work. Try again.");
        })
        .finally(() => setReload((n) => n + 1));
      return;
    }
    try {
      localStorage.setItem(brand.key(KEY), id);
    } catch {}
    setMe(id);
  };
  const tabs: Tab[] = board.all ? ["today", "week", "all"] : ["today", "week"];
  const choices = viewer ? ACTIVE.filter((id) => !viewer.taken.includes(id)) : ACTIVE;
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
              {t === "today" ? "Today" : t === "week" ? "This week" : "All time"}
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
      {!me && (!viewer || (viewer.signedIn && !viewer.linked)) ? (
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
                <span className="block break-words font-semibold">{nick(r.id)}</span>
                <span className="block break-words text-xs text-[var(--muted)]">{r.sub}</span>
              </span>
              <span className="font-display text-2xl font-black tabular-nums">{r.main}</span>
            </motion.li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-[var(--muted)]">Nobody&apos;s on the board yet{tab === "today" ? " today" : tab === "week" ? " this week" : ""}. Be first.</p>
      )}
      {me && viewer ? <p className="mt-3 text-xs text-[var(--muted)]">You play as {nick(me)}.</p> : null}
      {me && !viewer ? (
        <button type="button" onClick={() => setMe(null)} className="mt-3 cursor-pointer text-xs text-[var(--muted)] underline-offset-4 hover:underline">
          Not {nick(me)}? Switch
        </button>
      ) : null}
    </div>
  );
}
