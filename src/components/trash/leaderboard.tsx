"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { MgrPhoto } from "@/components/trash/brand";
import { useBrand } from "@/components/trash/brand";

/**
 * Shared daily-game leaderboard. Who you are is picked once and remembered (no accounts: it's a
 * friends league). The first result you post each day is the one that counts.
 */
const KEY = "trash:me";
export const whoAmI = (prefix = "") => {
  try {
    return localStorage.getItem(prefix + KEY) ?? localStorage.getItem(prefix + "fo:me");
  } catch {
    return null;
  }
};

type Board = { enabled: boolean; today?: Record<string, { score: number; label: string }>; week?: Record<string, { points: number; played: number }> };

export type Person = { id: string; nick: string };

export function Leaderboard({
  game,
  day,
  result,
  people,
}: {
  /** Current managers, for the "who are you" picker and names. */
  people: Person[];
  game: "dive" | "trashle" | "lineup";
  day: string | null;
  /** The finished result to post, once the game is over. score: higher is better. */
  result: { score: number; label: string } | null;
}) {
  const reduce = useReducedMotion();
  const brand = useBrand();
  const ACTIVE = people.map((p) => p.id);
  const nick = (id: string) => people.find((p) => p.id === id)?.nick ?? id;
  const [me, setMe] = useState<string | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [tab, setTab] = useState<"today" | "week">("today");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMe(whoAmI(brand.storage));
  }, [brand.storage]);

  // Post the result once we know who you are, then load the board. Keyed on the result's values,
  // not the object, so a re-render never posts or fetches again.
  const rs = result?.score;
  const rl = result?.label;
  useEffect(() => {
    if (!day) return;
    let off = false;
    const load = () =>
      fetch(`${brand.scores}?game=${game}&day=${day}`)
        .then((r) => r.json())
        .then((b: Board) => !off && setBoard(b))
        .catch(() => !off && setBoard({ enabled: false }));
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
        .finally(load);
    else load();
    return () => {
      off = true;
    };
  }, [game, day, me, rs, rl, brand]);

  if (!board?.enabled) return null;
  const pick = (id: string) => {
    try {
      localStorage.setItem(brand.key(KEY), id);
    } catch {}
    setMe(id);
  };
  const rows =
    tab === "today"
      ? Object.entries(board.today ?? {})
          .map(([id, v]) => ({ id, main: v.score, sub: v.label }))
          .sort((a, b) => b.main - a.main)
      : Object.entries(board.week ?? {})
          .map(([id, v]) => ({ id, main: v.points, sub: `${v.played} day${v.played === 1 ? "" : "s"} played` }))
          .sort((a, b) => b.main - a.main);

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-display text-2xl font-black">Leaderboard</p>
        <div className="flex gap-1 rounded-full bg-black/30 p-1 text-sm">
          {(["today", "week"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={`cursor-pointer rounded-full px-3 py-1 font-semibold ${tab === t ? "bg-[var(--paper)] text-[var(--bin)]" : "text-[var(--paper)]/75"}`}
            >
              {t === "today" ? "Today" : "This week"}
            </button>
          ))}
        </div>
      </div>
      {!me ? (
        <div className="mt-3">
          <p className="text-sm text-[var(--muted)]">Who are you? Pick once and your results post to the board.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {ACTIVE.map((id) => (
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
                <span className="block truncate font-semibold">{nick(r.id)}</span>
                <span className="block truncate text-xs text-[var(--muted)]">{r.sub}</span>
              </span>
              <span className="font-display text-2xl font-black tabular-nums">{r.main}</span>
            </motion.li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-[var(--muted)]">Nobody&apos;s on the board yet{tab === "today" ? " today" : " this week"}. Be first.</p>
      )}
      {me ? (
        <button type="button" onClick={() => setMe(null)} className="mt-3 cursor-pointer text-xs text-[var(--muted)] underline-offset-4 hover:underline">
          Not {nick(me)}? Switch
        </button>
      ) : null}
    </div>
  );
}
