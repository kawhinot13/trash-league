"use client";

import confetti from "canvas-confetti";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Players } from "@/lib/extras";
import type { TrashleWord } from "@/lib/trashle";
import { Face, pname } from "./player";
import { sfx } from "./dive/sfx";
import { Leaderboard, type Person } from "./leaderboard";

const TRIES = 6;
const LAUNCH = Date.UTC(2026, 10, 14);
type Mark = "hit" | "near" | "miss";
const COLOR: Record<Mark, string> = { hit: "#7fd49a", near: "#c98a4b", miss: "#24392f" };
const KEYS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

const todayET = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const store = {
  get<T>(k: string): T | null {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },
};

/** Standard Wordle scoring, duplicates handled: exact hits first, then near misses from what's left. */
function score(guess: string, answer: string): Mark[] {
  const out: Mark[] = Array(guess.length).fill("miss");
  const left: Record<string, number> = {};
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) out[i] = "hit";
    else left[answer[i]] = (left[answer[i]] ?? 0) + 1;
  }
  for (let i = 0; i < guess.length; i++)
    if (out[i] !== "hit" && left[guess[i]]) {
      out[i] = "near";
      left[guess[i]]--;
    }
  return out;
}

function Tile({ ch, mark, i, flip, pop }: { ch: string; mark?: Mark; i: number; flip: boolean; pop: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative aspect-square w-full [perspective:400px]">
      <motion.div
        className="font-display absolute inset-0 flex items-center justify-center rounded-lg border-2 text-[clamp(1.4rem,6vw,2.4rem)] leading-none font-black"
        initial={false}
        animate={
          flip && mark
            ? { rotateX: reduce ? 0 : [0, 90, 0], backgroundColor: COLOR[mark], borderColor: COLOR[mark], color: mark === "miss" ? "#a4b8ab" : "#10141a" }
            : { rotateX: 0, scale: pop && !reduce ? [1, 1.12, 1] : 1, backgroundColor: "rgba(0,0,0,0.25)", borderColor: ch ? "rgba(246,243,234,0.55)" : "rgba(255,255,255,0.12)", color: "#f6f3ea" }
        }
        transition={
          flip
            ? { duration: reduce ? 0.01 : 0.5, delay: reduce ? 0 : i * 0.22, times: [0, 0.5, 1], backgroundColor: { delay: reduce ? 0 : i * 0.22 + 0.25, duration: 0 }, borderColor: { delay: reduce ? 0 : i * 0.22 + 0.25, duration: 0 }, color: { delay: reduce ? 0 : i * 0.22 + 0.25, duration: 0 } }
            : { duration: 0.12 }
        }
      >
        {ch}
      </motion.div>
    </div>
  );
}

export function Trashle({ answers, valid, players, people }: { answers: TrashleWord[]; valid: string[]; players: Players; people: Person[] }) {
  const reduce = useReducedMotion();
  const [day, setDay] = useState<string | null>(null);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [cur, setCur] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(0); // rows whose flip has finished
  const [boardRef, animate] = useAnimate();
  const fx = useRef<HTMLCanvasElement>(null);
  const validSet = useMemo(() => new Set(valid), [valid]);

  useEffect(() => {
    const d = todayET();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDay(d);
    const saved = store.get<string[]>(`trashle:${d}`) ?? [];
    setGuesses(saved);
    setRevealed(saved.length);
    setStreak(store.get<{ last: string; n: number }>("trashle:streak")?.n ?? 0);
  }, []);

  const edition = day ? Math.floor((Date.parse(day) - LAUNCH) / 86400000) + 1 : 1;
  const target = useMemo(() => {
    if (!day) return null;
    // Spread days across the bank without repeats for a long while.
    const idx = (edition * 37 + 11) % answers.length;
    return answers[idx];
  }, [day, edition, answers]);
  const L = target?.word.length ?? 5;
  const won = !!target && guesses.includes(target.word);
  const lost = !won && guesses.length >= TRIES;
  const over = won || lost;
  const settled = revealed >= guesses.length;

  const keyMarks = useMemo(() => {
    const m: Record<string, Mark> = {};
    if (!target) return m;
    guesses.slice(0, revealed).forEach((g) =>
      score(g, target.word).forEach((s, i) => {
        const prev = m[g[i]];
        if (s === "hit" || (s === "near" && prev !== "hit") || (!prev && s === "miss")) m[g[i]] = s;
      }),
    );
    return m;
  }, [guesses, revealed, target]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1600);
  };

  const submit = useCallback(() => {
    if (!target || over || !settled) return;
    const row = boardRef.current?.querySelector(`[data-row="${guesses.length}"]`);
    const bad = cur.length !== L ? `Needs ${L} letters` : !validSet.has(cur) ? "Not a Trash player" : null;
    if (bad) {
      flash(bad);
      sfx.buzz();
      if (row && !reduce) void animate(row, { x: [0, -10, 9, -6, 4, 0] }, { duration: 0.4 });
      return;
    }
    const next = [...guesses, cur];
    setGuesses(next);
    setCur("");
    if (day) store.set(`trashle:${day}`, next);
    const flipMs = reduce ? 50 : L * 220 + 520;
    for (let i = 0; i < L; i++) setTimeout(() => sfx.tick(), reduce ? 0 : i * 220 + 250);
    setTimeout(() => {
      setRevealed(next.length);
      if (cur === target.word) {
        sfx.chime(95);
        const r = boardRef.current?.querySelector(`[data-row="${next.length - 1}"]`);
        if (r && !reduce) void animate(r.querySelectorAll(".tile"), { y: [0, -18, 0] }, { duration: 0.45, delay: (i: number) => i * 0.08 } as never);
        if (fx.current && !reduce)
          void confetti.create(fx.current, { resize: true, useWorker: true })({
            particleCount: 110,
            spread: 80,
            origin: { y: 0.4 },
            colors: ["#7fd49a", "#c98a4b", "#f6f3ea", "#1f4a39"],
          });
      } else if (next.length >= TRIES) sfx.slam();
      if (day && (cur === target.word || next.length >= TRIES)) {
        const st = store.get<{ last: string; n: number }>("trashle:streak");
        const y = new Date(Date.parse(day) - 86400000).toISOString().slice(0, 10);
        const n = cur === target.word ? (st?.last === y ? st.n + 1 : st?.last === day ? st.n : 1) : 0;
        store.set("trashle:streak", { last: day, n });
        setStreak(n);
      }
    }, flipMs);
  }, [target, over, settled, cur, L, validSet, guesses, day, reduce, animate, boardRef]);

  const press = useCallback(
    (k: string) => {
      if (over || !settled) return;
      if (k === "ENTER") return submit();
      if (k === "BACK") return setCur((c) => c.slice(0, -1));
      if (/^[A-Z]$/.test(k)) setCur((c) => (c.length < L ? c + k : c));
    },
    [over, settled, submit, L],
  );

  // Physical keyboard, only while the board is on screen and you're not typing elsewhere.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey) return;
      const r = boardRef.current?.getBoundingClientRect();
      if (!r || r.bottom < 0 || r.top > window.innerHeight) return;
      if (e.key === "Enter") press("ENTER");
      else if (e.key === "Backspace") press("BACK");
      else if (/^[a-z]$/i.test(e.key)) press(e.key.toUpperCase());
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [press, boardRef]);

  const misses = guesses.filter((g) => g !== target?.word).length;
  const share = async () => {
    if (!target) return;
    const grid = guesses
      .map((g) => score(g, target.word).map((s) => (s === "hit" ? "🟩" : s === "near" ? "🟫" : "⬛")).join(""))
      .join("\n");
    try {
      await navigator.clipboard.writeText(`Trashle #${edition} ${won ? guesses.length : "X"}/${TRIES}\n${grid}\n${location.origin}/#trashle`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div data-no-rico className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(120%_70%_at_30%_0%,rgba(127,212,154,0.12),rgba(12,32,24,0.92)_60%)] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.7)]">
      <canvas ref={fx} className="pointer-events-none absolute inset-0 z-20 h-full w-full" aria-hidden />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4 md:px-8">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-3xl leading-none font-black md:text-4xl">Trashle</span>
          <span className="text-sm text-[var(--muted)]">No. {edition}</span>
        </div>
        <p className="text-sm text-[var(--muted)]">
          {L}-letter last name, {TRIES} tries{streak > 1 ? `, ${streak}-day streak` : ""}
        </p>
      </div>

      <div className="grid gap-8 p-5 md:grid-cols-[minmax(0,420px)_1fr] md:p-8">
        <div>
          <div ref={boardRef} className="relative mx-auto grid max-w-[420px] gap-2" role="grid" aria-label="Guesses">
            {Array.from({ length: TRIES }, (_, r) => {
              const g = guesses[r] ?? (r === guesses.length ? cur : "");
              const marks = target && r < guesses.length ? score(guesses[r], target.word) : [];
              return (
                <div key={r} data-row={r} role="row" className="grid gap-2" style={{ gridTemplateColumns: `repeat(${L}, minmax(0, 1fr))` }}>
                  {Array.from({ length: L }, (_, c) => (
                    <div key={c} className="tile" role="gridcell">
                      <Tile ch={g[c] ?? ""} mark={marks[c]} i={c} flip={r < guesses.length} pop={r === guesses.length && c === cur.length - 1} />
                    </div>
                  ))}
                </div>
              );
            })}
            <AnimatePresence>
              {toast ? (
                <motion.p
                  initial={{ opacity: 0, y: -6, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-[var(--paper)] px-4 py-2 font-semibold whitespace-nowrap text-[var(--bin)] shadow-xl"
                  role="status"
                >
                  {toast}
                </motion.p>
              ) : null}
            </AnimatePresence>
          </div>

          {/* keyboard */}
          <div className="mx-auto mt-6 max-w-[520px] space-y-1.5 select-none">
            {KEYS.map((row, ri) => (
              <div key={row} className="flex justify-center gap-1.5">
                {ri === 2 ? (
                  <button type="button" onClick={() => press("ENTER")} className="h-12 cursor-pointer rounded-lg bg-[var(--paper)] px-2.5 text-xs font-bold text-[var(--bin)] active:scale-95 sm:px-4">
                    Enter
                  </button>
                ) : null}
                {[...row].map((k) => {
                  const m = keyMarks[k];
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => press(k)}
                      className="h-12 min-w-0 flex-1 cursor-pointer rounded-lg text-sm font-bold transition-[background-color,transform] duration-200 active:scale-95 sm:max-w-11"
                      style={{ background: m ? COLOR[m] : "rgba(246,243,234,0.14)", color: m && m !== "miss" ? "#10141a" : "#f6f3ea" }}
                    >
                      {k}
                    </button>
                  );
                })}
                {ri === 2 ? (
                  <button type="button" onClick={() => press("BACK")} aria-label="Delete" className="h-12 cursor-pointer rounded-lg bg-white/14 px-2.5 text-sm font-bold active:scale-95 sm:px-4">
                    ⌫
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-black/25 p-4 text-sm leading-relaxed text-[var(--paper)]/85">
            Guess today&apos;s mystery player by last name. Green is the right letter in the right spot, brown is in
            the name but somewhere else. Every guess has to be a player from Trash history.
          </div>
          <div className="space-y-2">
            {[
              { at: 3, label: "Scouting report", text: target ? `${target.pos || "?"}, ${target.team || "free agent"}` : "" },
              { at: 5, label: "Ride or die", text: target ? `${target.owner} rostered him for ${target.weeks} weeks` : "" },
            ].map((h) => {
              const open = misses >= h.at || over;
              return (
                <div key={h.label} className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3">
                  <span className="text-xs font-bold text-[var(--wood)]">{h.label}</span>
                  <span className={`text-sm ${open ? "" : "text-[var(--muted)]"}`}>{open ? h.text : `Unlocks after ${h.at} misses`}</span>
                </div>
              );
            })}
          </div>

          <AnimatePresence>
            {over && settled && target ? (
              <motion.div
                initial={{ opacity: 0, y: reduce ? 0 : 16, scale: reduce ? 1 : 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", duration: 0.6, bounce: 0.3 }}
                className="rounded-3xl border-2 p-5"
                style={{ borderColor: won ? COLOR.hit : "var(--ticket)" }}
              >
                <p className="text-sm text-[var(--muted)]">{won ? `Got it in ${guesses.length}` : "Today's player was"}</p>
                <div className="mt-2 flex items-center gap-4">
                  <Face pid={target.pid} players={players} size={72} />
                  <div>
                    <p className="font-display text-4xl leading-none font-black">{pname(players, target.pid)}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {target.owner}&apos;s guy, {target.weeks} weeks on that roster
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={share}
                  className="font-display mt-5 inline-flex h-12 cursor-pointer items-center rounded-full bg-[var(--paper)] px-6 text-xl font-black text-[var(--bin)] transition-transform duration-150 active:scale-[0.96]"
                >
                  {copied ? "Copied" : "Copy my grid"}
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>
          {over && settled ? (
            <Leaderboard
              game="trashle"
              day={day}
              people={people}
              result={{ score: won ? (TRIES + 1 - guesses.length) * 20 : 0, label: won ? `Got it in ${guesses.length}` : "Missed" }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
