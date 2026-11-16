"use client";

import { AFC, EAST } from "@/lib/core/lineup";
import { sharedDay } from "@/lib/core/daily-pool";
import confetti from "canvas-confetti";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Players } from "@/lib/extras";
import type { TrashleWord } from "@/lib/trashle";
import { Face, pname } from "./player";
import { sfx } from "./dive/sfx";
import { Leaderboard, type Person } from "./leaderboard";
import { useBrand } from "@/components/trash/brand";

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

export function Trashle({
  answers,
  valid,
  shared,
  players,
  people,
}: {
  answers: TrashleWord[];
  valid: string[];
  /** The sport's shared daily list: every league gets the same player each day (from SHARED_FROM). */
  shared?: TrashleWord[];
  players: Players;
  people: Person[];
}) {
  const brand = useBrand();
  const reduce = useReducedMotion();
  const [day, setDay] = useState<string | null>(null);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [cur, setCur] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(0); // rows whose flip has finished
  const [hints, setHints] = useState<number[]>([]); // hints opened today (each costs points)
  const [boardRef, animate] = useAnimate();
  const fx = useRef<HTMLCanvasElement>(null);
  const validSet = useMemo(() => new Set(valid), [valid]);

  useEffect(() => {
    const d = todayET();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDay(d);
    const saved = store.get<string[]>(brand.key(`trashle:${d}`)) ?? [];
    setGuesses(saved);
    setHints(store.get<number[]>(brand.key(`trashle-hints:${d}`)) ?? []);
    setRevealed(saved.length);
    setStreak(store.get<{ last: string; n: number }>(brand.key("trashle:streak"))?.n ?? 0);
  }, [brand]);

  const edition = day ? Math.floor((Date.parse(day) - LAUNCH) / 86400000) + 1 : 1;
  const target = useMemo(() => {
    if (!day) return null;
    const n = sharedDay(day);
    if (n !== null && shared?.length) return shared[n % shared.length];
    // Before the shared schedule: each league's own bank, spread without repeats for a long while.
    const idx = (edition * 37 + 11) % answers.length;
    return answers[idx];
  }, [day, edition, answers, shared]);
  const L = target?.word.length ?? 5;
  const won = !!target && guesses.includes(target.word);
  const lost = !won && guesses.length >= TRIES;
  const over = won || lost;
  const settled = revealed >= guesses.length;
  // Hints: earned by missing (after 3, 4 and 5 misses), opened on purpose, 10 points each off a win.
  // Deliberately vague: a position group, the conference (not the team), then one piece of league history.
  const misses = guesses.filter((g) => g !== target?.word).length;
  const nfl = brand.sport === "nfl";
  const posGroup = (pos: string) => {
    const ps = pos.split("/");
    if (nfl) return ps.join(" or ");
    const g = ps.some((p) => p === "PG" || p === "SG") ? "Guard" : null;
    const f = ps.some((p) => p === "SF" || p === "PF") ? "Forward" : null;
    const c = ps.includes("C") ? "Center" : null;
    return [g, f, c].filter(Boolean).join(" / ") || "Unknown";
  };
  const conference = (team: string) =>
    !team ? "Not on a team right now" : nfl ? (AFC.has(team) ? "Plays in the AFC" : "Plays in the NFC") : EAST.has(team) ? "Plays in the East" : "Plays in the West";
  const hintList = target
    ? [
        { at: 3, label: "Position", text: posGroup(target.pos) },
        { at: 4, label: "Conference", text: conference(target.team) },
        {
          at: 5,
          label: `${brand.name} history`,
          text: target.owner ? `Spent the most time on ${target.owner}'s roster` : `Never on a ${brand.name} roster`,
        },
      ]
    : [];
  const openHint = (i: number) => {
    if (!day || hints.includes(i)) return;
    const next = [...hints, i];
    setHints(next);
    store.set(brand.key(`trashle-hints:${day}`), next);
  };
  const hintNote = hints.length ? ` (${hints.length} hint${hints.length === 1 ? "" : "s"})` : "";

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
    const bad = cur.length !== L ? `Needs ${L} letters` : !validSet.has(cur) ? `Not a ${brand.name} player` : null;
    if (bad) {
      flash(bad);
      sfx.buzz();
      if (row && !reduce) void animate(row, { x: [0, -10, 9, -6, 4, 0] }, { duration: 0.4 });
      return;
    }
    const next = [...guesses, cur];
    setGuesses(next);
    setCur("");
    if (day) store.set(brand.key(`trashle:${day}`), next);
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
            colors: ["#d93a3a", "#3fae5a", "#e9c46a", "#f6f3ea", "#c8102e"],
          });
      } else if (next.length >= TRIES) sfx.slam();
      if (day && (cur === target.word || next.length >= TRIES)) {
        const st = store.get<{ last: string; n: number }>(brand.key("trashle:streak"));
        const y = new Date(Date.parse(day) - 86400000).toISOString().slice(0, 10);
        const n = cur === target.word ? (st?.last === y ? st.n + 1 : st?.last === day ? st.n : 1) : 0;
        store.set(brand.key("trashle:streak"), { last: day, n });
        setStreak(n);
      }
    }, flipMs);
  }, [target, over, settled, cur, L, validSet, guesses, day, reduce, animate, boardRef, brand]);

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

  const share = async () => {
    if (!target) return;
    const grid = guesses
      .map((g) => score(g, target.word).map((s) => (s === "hit" ? "🟩" : s === "near" ? "🟫" : "⬛")).join(""))
      .join("\n");
    try {
      await navigator.clipboard.writeText(`${brand.games.wordle} #${edition} ${won ? guesses.length : "X"}/${TRIES}${hintNote}\n${grid}\n${location.origin}${brand.base || "/"}#trashle`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div data-no-rico className="xmas-drift relative rounded-[28px] border border-white/10 bg-[radial-gradient(120%_70%_at_30%_0%,rgba(127,212,154,0.12),rgba(12,32,24,0.92)_60%)] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.7)]">
      <canvas ref={fx} className="pointer-events-none absolute inset-0 z-20 h-full w-full" aria-hidden />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4 md:px-8">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-3xl leading-none font-black md:text-4xl">{brand.games.wordle}</span>
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
            the name but somewhere else. Every guess has to be a player from {brand.name} history.
          </div>
          {!over && target && brand.wordleHints ? (
            <div className="space-y-2">
              {hintList.map((h, i) => {
                const earned = misses >= h.at;
                const open = hints.includes(i);
                return (
                  <div key={h.label} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-white/10 px-4 py-3">
                    <span className="text-xs font-bold text-[var(--wood)]">{h.label}</span>
                    {open ? (
                      <span className="text-sm">{h.text}</span>
                    ) : earned ? (
                      <button type="button" onClick={() => openHint(i)} className="cursor-pointer rounded-full border border-white/15 px-3 py-1 text-xs font-semibold hover:bg-white/8">
                        Use hint (−10 pts)
                      </button>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">Unlocks after {h.at} misses</span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}
          <AnimatePresence>
            {over && settled && target ? (
              <motion.div
                initial={{ opacity: 0, y: reduce ? 0 : 16, scale: reduce ? 1 : 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", duration: 0.6, bounce: 0.3 }}
                className="rounded-3xl border-2 p-5"
                style={{ borderColor: won ? COLOR.hit : "var(--ticket)" }}
              >
                <p className="text-sm text-[var(--muted)]">{won ? `Got it in ${guesses.length}${hintNote}` : "Today's player was"}</p>
                <div className="mt-2 flex items-center gap-4">
                  <Face pid={target.pid} players={players} size={72} />
                  <div>
                    <p className="font-display text-4xl leading-none font-black">{pname(players, target.pid)}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {target.owner ? (
                        <>
                          {target.owner}&apos;s guy, {target.weeks} weeks on that roster
                        </>
                      ) : (
                        <>Never on a {brand.name} roster</>
                      )}
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
              result={{
                score: won ? Math.max(10, (TRIES + 1 - guesses.length) * 20 - hints.length * 10) : 0,
                label: won ? `Got it in ${guesses.length}${hintNote}` : "Missed",
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
