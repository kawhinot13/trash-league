"use client";

import Image from "next/image";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Players } from "@/lib/extras";
import type { Option, Question } from "@/lib/dive";
import { Face } from "./player";

const CLOCK = 15;
const ROUNDS = 5;
const LAUNCH = Date.UTC(2026, 10, 14);
const SWISH = "#7fd49a";

type Mark = "swish" | "brick" | "clock";
type Saved = { score: number; marks: Mark[] };

const todayET = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
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

/** Today's five: one per kind where possible, options shuffled, same for everyone. */
function todays(pool: Question[], day: string) {
  const r = rng(Number(day.replaceAll("-", "")));
  const kinds = [...new Set(pool.map((q) => q.kind))].sort(() => r() - 0.5);
  const out: (Question & { answer: number })[] = [];
  for (const k of kinds) {
    if (out.length === ROUNDS) break;
    const of = pool.filter((q) => q.kind === k);
    const q = of[Math.floor(r() * of.length)];
    const order = q.options.map((_, i) => i).sort(() => r() - 0.5);
    out.push({ ...q, options: order.map((i) => q.options[i]), answer: order.indexOf(0) });
  }
  return out;
}

/* ── The court strip: a ball that swishes or bricks ─────────── */
function Hoop({ shot }: { shot: Mark | null }) {
  const reduce = useReducedMotion();
  const anim =
    shot === "swish"
      ? { x: ["0%", "180%", "330%", "330%"], y: ["0%", "-140%", "-95%", "40%"], rotate: [0, 200, 320, 360], opacity: [1, 1, 1, 0] }
      : shot === "brick"
        ? { x: ["0%", "180%", "322%", "420%"], y: ["0%", "-140%", "-110%", "70%"], rotate: [0, 200, 300, 520], opacity: [1, 1, 1, 0] }
        : shot === "clock"
          ? { x: ["0%", "60%", "110%"], y: ["0%", "-30%", "40%"], rotate: [0, 90, 160], opacity: [1, 1, 0] }
          : { x: "0%", y: "0%", rotate: 0, opacity: 1 };
  return (
    <div aria-hidden className="relative mx-auto h-28 w-full max-w-md">
      {/* backboard, rim, net */}
      <svg viewBox="0 0 120 110" className="absolute top-0 right-[6%] h-24 w-auto">
        <rect x="70" y="4" width="44" height="34" rx="3" fill="rgba(246,243,234,0.08)" stroke="var(--paper)" strokeWidth="2.5" />
        <rect x="84" y="16" width="16" height="12" fill="none" stroke="var(--paper)" strokeWidth="2" />
        <motion.path
          d="M66 52 L78 86 L90 52 M72 52 L82 84 M84 52 L80 84 M60 52 L74 84"
          fill="none"
          stroke="var(--paper)"
          strokeOpacity=".6"
          strokeWidth="1.6"
          animate={shot === "swish" && !reduce ? { scaleY: [1, 1.25, 1] } : { scaleY: 1 }}
          style={{ transformOrigin: "75px 52px" }}
          transition={{ duration: 0.4, delay: 0.62 }}
        />
        <line x1="56" y1="52" x2="96" y2="52" stroke="var(--ticket)" strokeWidth="4" strokeLinecap="round" />
        <line x1="92" y1="38" x2="92" y2="52" stroke="var(--paper)" strokeWidth="2" />
      </svg>
      {/* the ball */}
      <motion.div
        key={shot ?? "idle"}
        className="absolute bottom-1 left-[8%] size-9"
        initial={false}
        animate={reduce ? { opacity: shot ? 0 : 1 } : anim}
        transition={{ duration: shot ? 0.9 : 0, ease: "easeOut", times: shot === "clock" ? [0, 0.5, 1] : [0, 0.45, 0.7, 1] }}
      >
        <svg viewBox="0 0 40 40" className="size-full">
          <circle cx="20" cy="20" r="18" fill="var(--wood)" stroke="#10141a" strokeWidth="2.5" />
          <path d="M2 20 H38 M20 2 V38 M7 8 C16 16 16 24 7 32 M33 8 C24 16 24 24 33 32" fill="none" stroke="#10141a" strokeWidth="2" />
        </svg>
      </motion.div>
    </div>
  );
}

function Clock({ left }: { left: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const danger = left <= 5;
  return (
    <div className="relative size-16 shrink-0" aria-label={`${Math.ceil(left)} seconds left`}>
      <svg viewBox="0 0 64 64" className="size-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={danger ? "var(--ticket)" : "var(--paper)"}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - left / CLOCK)}
          style={{ transition: "stroke-dashoffset 100ms linear, stroke 200ms" }}
        />
      </svg>
      <span
        className={`font-display absolute inset-0 flex items-center justify-center text-2xl font-black tabular-nums ${danger ? "text-[var(--ticket)]" : ""}`}
      >
        {Math.ceil(left)}
      </span>
    </div>
  );
}

function OptionFace({ o, players }: { o: Option; players: Players }) {
  if (o.mgr)
    return (
      <Image src={`/avatars/${o.mgr}.jpg`} alt="" width={36} height={36} className="size-9 shrink-0 rounded-full object-cover" />
    );
  if (o.pid) return <Face pid={o.pid} players={players} size={36} />;
  return null;
}

export function DumpsterDive({ pool, players }: { pool: Question[]; players: Players }) {
  const reduce = useReducedMotion();
  const [day, setDay] = useState<string | null>(null);
  const [phase, setPhase] = useState<"intro" | "play" | "done">("intro");
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(CLOCK);
  const [chosen, setChosen] = useState<number | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [copied, setCopied] = useState(false);
  const [scope, animateRoot] = useAnimate();
  const started = useRef(0);

  // Date-dependent bits only after mount, so server and client render the same first frame.
  useEffect(() => {
    const d = todayET();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDay(d);
    const saved = store.get<Saved>(`dive:${d}`);
    const st = store.get<{ last: string; n: number }>("dive:streak");
    setStreak(st?.n ?? 0);
    if (saved) {
      setMarks(saved.marks);
      setScore(saved.score);
      setPhase("done");
    }
  }, []);
  const qs = useMemo(() => (day ? todays(pool, day) : []), [pool, day]);
  const edition = day ? Math.floor((Date.parse(day) - LAUNCH) / 86400000) + 1 : null;
  const q = qs[i];
  const mark: Mark | null = chosen === null ? null : chosen === -1 ? "clock" : chosen === q?.answer ? "swish" : "brick";

  const answer = useCallback(
    (k: number) => {
      if (chosen !== null || !q) return;
      const secs = Math.max(0, CLOCK - (performance.now() - started.current) / 1000);
      setChosen(k);
      const m: Mark = k === -1 ? "clock" : k === q.answer ? "swish" : "brick";
      setMarks((x) => [...x, m]);
      if (m === "swish") setScore((s) => s + 100 + Math.round(secs * 4));
      else if (!reduce && scope.current) animateRoot(scope.current, { x: [0, -8, 7, -4, 0] }, { duration: 0.35 });
    },
    [chosen, q, reduce, scope, animateRoot],
  );

  // Shot clock.
  useEffect(() => {
    if (phase !== "play" || chosen !== null) return;
    started.current = performance.now();
    const t = setInterval(() => {
      const l = Math.max(0, CLOCK - (performance.now() - started.current) / 1000);
      setLeft(l);
      if (l <= 0) answer(-1);
    }, 100);
    return () => clearInterval(t);
  }, [phase, i, chosen, answer]);

  const next = () => {
    if (i + 1 < qs.length) {
      setI(i + 1);
      setChosen(null);
      setLeft(CLOCK);
      return;
    }
    setPhase("done");
    if (day) {
      store.set(`dive:${day}`, { score, marks } satisfies Saved);
      const st = store.get<{ last: string; n: number }>("dive:streak");
      const y = new Date(Date.parse(day) - 86400000).toISOString().slice(0, 10);
      const n = st?.last === y ? st.n + 1 : st?.last === day ? st.n : 1;
      store.set("dive:streak", { last: day, n });
      setStreak(n);
    }
  };

  const share = async () => {
    const sq = marks.map((m) => (m === "swish" ? "🟩" : m === "brick" ? "🟥" : "⬛")).join("");
    const text = `Dumpster Dive #${edition} ${sq} ${score} pts`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const swishes = marks.filter((m) => m === "swish").length;
  const rating = ["Dumpster fire", "Bench warmer", "Rotation guy", "Starter", "All-Trash team", "League commissioner"][swishes];

  return (
    <div
      ref={scope}
      className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(201,138,75,0.22),rgba(16,40,30,0.7)_60%)] p-5 backdrop-blur-xl md:p-10"
    >
      {/* jumbotron header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-display text-[clamp(2.6rem,7vw,4.6rem)] leading-[0.85] font-black">Dumpster Dive</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {edition ? `No. ${edition}` : "Daily"}, five questions, {CLOCK}-second shot clock
          </p>
        </div>
        <div className="flex gap-1.5" aria-label="Today's shots">
          {Array.from({ length: ROUNDS }, (_, k) => {
            const m = marks[k];
            return (
              <motion.span
                key={`${k}-${m ?? "x"}`}
                initial={m && !reduce ? { scale: 0.4 } : false}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.4, bounce: 0.5 }}
                className="size-7 rounded-md border border-white/15"
                style={{
                  background: m === "swish" ? SWISH : m === "brick" ? "var(--ticket)" : m === "clock" ? "#3a3f3c" : "transparent",
                }}
              />
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {phase === "intro" ? (
          <motion.div
            key="intro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: reduce ? 0 : -10 }}
            className="mt-10 grid gap-8 md:grid-cols-[1fr_auto] md:items-center"
          >
            <div>
              <p className="max-w-[46ch] text-lg leading-relaxed text-[var(--paper)]/85">
                Trades, drafts, lockers, bench crimes and title runs. New questions every day at midnight Eastern. Answer
                fast for bonus points.
              </p>
              <button
                type="button"
                disabled={!day}
                onClick={() => setPhase("play")}
                className="font-display mt-6 inline-flex h-14 cursor-pointer items-center rounded-full bg-[var(--paper)] px-8 text-2xl font-black text-[var(--bin)] transition-transform duration-150 active:scale-[0.97] disabled:opacity-50"
              >
                Tip off
              </button>
            </div>
            <Hoop shot={null} />
          </motion.div>
        ) : null}

        {phase === "play" && q ? (
          <motion.div
            key={`q-${i}`}
            initial={{ opacity: 0, x: reduce ? 0 : 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: reduce ? 0 : -30 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="mt-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[var(--wood)]">
                  {q.kind}, question {i + 1} of {qs.length}
                </p>
                <h3 className="font-display mt-2 max-w-[24ch] text-[clamp(1.9rem,4.6vw,3rem)] leading-[0.98] font-black">
                  {q.prompt}
                </h3>
              </div>
              <Clock left={left} />
            </div>

            {q.show?.length ? (
              <div className="mt-5 flex flex-wrap gap-3">
                {q.show.map((pid) => (
                  <div key={pid} className="flex items-center gap-2 rounded-full bg-black/25 py-1 pr-4 pl-1">
                    <Face pid={pid} players={players} size={40} />
                    <span className="text-sm font-semibold">{players[pid]?.[0]}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="relative mt-6">
              <Hoop shot={mark} />
              <AnimatePresence>
                {mark ? (
                  <motion.p
                    key={mark}
                    initial={{ opacity: 0, scale: reduce ? 1 : 0.6, rotate: -6 }}
                    animate={{ opacity: 1, scale: 1, rotate: -6 }}
                    transition={{ type: "spring", duration: 0.5, bounce: 0.45, delay: reduce ? 0 : 0.55 }}
                    className="font-display pointer-events-none absolute inset-0 flex items-center justify-center text-[clamp(3rem,10vw,5.5rem)] font-black"
                    style={{
                      color: mark === "swish" ? SWISH : mark === "brick" ? "var(--ticket)" : "var(--muted)",
                      textShadow: "0 6px 30px rgba(0,0,0,0.5)",
                    }}
                  >
                    {mark === "swish" ? "SWISH" : mark === "brick" ? "BRICK" : "SHOT CLOCK"}
                  </motion.p>
                ) : null}
              </AnimatePresence>
            </div>

            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {q.options.map((o, k) => {
                const right = chosen !== null && k === q.answer;
                const wrong = chosen === k && k !== q.answer;
                return (
                  <li key={o.label + k}>
                    <button
                      type="button"
                      disabled={chosen !== null}
                      onClick={() => answer(k)}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border-2 bg-black/25 px-4 py-3.5 text-left text-lg font-semibold transition-[transform,background-color,border-color,opacity] duration-150 enabled:hover:bg-black/35 enabled:active:scale-[0.98] disabled:cursor-default"
                      style={{
                        borderColor: right ? SWISH : wrong ? "var(--ticket)" : "rgba(255,255,255,0.12)",
                        background: right ? "rgba(127,212,154,0.16)" : wrong ? "rgba(214,52,44,0.18)" : undefined,
                        opacity: chosen !== null && !right && !wrong ? 0.45 : 1,
                      }}
                    >
                      <OptionFace o={o} players={players} />
                      <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <AnimatePresence>
              {chosen !== null ? (
                <motion.div
                  initial={{ opacity: 0, y: reduce ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduce ? 0 : 0.7 }}
                  className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-black/25 p-4"
                >
                  <p className="max-w-[56ch] text-[var(--paper)]/90">{q.reveal}</p>
                  <button
                    type="button"
                    onClick={next}
                    autoFocus
                    className="inline-flex h-12 cursor-pointer items-center rounded-full bg-[var(--paper)] px-6 font-semibold text-[var(--bin)] transition-transform duration-150 active:scale-[0.97]"
                  >
                    {i + 1 < qs.length ? "Next question" : "See the scoreboard"}
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        ) : null}

        {phase === "done" ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="mt-10 grid gap-8 md:grid-cols-[1fr_1fr] md:items-center"
          >
            <div className="rounded-3xl border-2 border-white/10 bg-black/40 p-6 text-center">
              <p className="text-sm text-[var(--muted)]">Final score</p>
              <p className="font-display text-[clamp(4rem,14vw,7rem)] leading-none font-black tabular-nums">{score}</p>
              <p className="font-display mt-1 text-2xl font-black text-[var(--wood)]">{rating}</p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {swishes} of {ROUNDS} swished
                {streak > 1 ? `, ${streak}-day streak` : ""}
              </p>
            </div>
            <div>
              <p className="text-lg leading-relaxed text-[var(--paper)]/85">
                Post your score in the group chat and make them dive too. New questions at midnight Eastern.
              </p>
              <button
                type="button"
                onClick={share}
                className="mt-5 inline-flex h-12 cursor-pointer items-center rounded-full bg-[var(--paper)] px-6 font-semibold text-[var(--bin)] transition-transform duration-150 active:scale-[0.97]"
              >
                {copied ? "Copied" : "Copy my result"}
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
