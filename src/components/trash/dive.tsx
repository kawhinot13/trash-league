"use client";

import confetti from "canvas-confetti";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";
import type { Players } from "@/lib/extras";
import { dailyPrompts, type Prompt } from "@/lib/core/dive";
import { Face, pname } from "./player";
import { AnswerBoard } from "./dive/answers";
import { sfx } from "./dive/sfx";
import { Stage, tierOf, type StageApi } from "./dive/stage";
import { Leaderboard, type Person } from "./leaderboard";
import { useBrand } from "@/components/trash/brand";

const ROUNDS = 5;
const LAUNCH = Date.UTC(2026, 10, 14);

type Pick = { pid: string | null; typed: string; score: number | null };
type Saved = { picks: Pick[] };

const todayET = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
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

/** Rank thresholds, lowest first, for the report's "next rank" meter. */
const RANKS: [number, string][] = [
  [0, "Read the group chat sometimes"],
  [100, "Casual"],
  [200, "Knows ball"],
  [300, "Deep diver"],
  [400, "Lives in the dumpster"],
];
/** Deep cuts (60+) in a row, ending at index `end` (inclusive). */
const heatAt = (picks: Pick[], end: number) => {
  let n = 0;
  for (let k = end; k >= 0 && (picks[k]?.score ?? -1) >= 60; k--) n++;
  return n;
};

const rankOf = (total: number) =>
  total >= 400
    ? "Lives in the dumpster"
    : total >= 300
      ? "Deep diver"
      : total >= 200
        ? "Knows ball"
        : total >= 100
          ? "Casual"
          : "Read the group chat sometimes";

/** Time until the next dive (midnight Eastern), ticking. */
function NextDive() {
  const [left, setLeft] = useState("");
  useEffect(() => {
    const f = () => {
      const now = new Date();
      const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
      const mid = new Date(et);
      mid.setHours(24, 0, 0, 0);
      const s = Math.max(0, Math.floor((mid.getTime() - et.getTime()) / 1000));
      setLeft(
        `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`,
      );
    };
    f();
    const t = setInterval(f, 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="font-display text-3xl font-black tabular-nums">{left}</span>;
}

function AnswerBox({ players, onPick }: { players: Players; onPick: (pid: string | null, typed: string) => void }) {
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const list = useId();
  const box = useRef<HTMLInputElement>(null);
  const all = useMemo(
    () => Object.entries(players).map(([pid, p]) => ({ pid, name: p[0], n: norm(p[0]) })).filter((x) => x.name),
    [players],
  );
  const nq = norm(q);
  const hits =
    nq.length < 2 ? [] : all.filter((x) => x.n.split(" ").some((w) => w.startsWith(nq)) || x.n.startsWith(nq)).slice(0, 6);
  const submit = (pid?: string) => {
    if (!q.trim()) return box.current?.focus();
    const exact = pid ?? all.find((x) => x.n === nq)?.pid ?? hits[hi]?.pid ?? null;
    onPick(exact, exact ? players[exact][0] : q.trim());
    setQ("");
  };
  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          ref={box}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setHi(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHi((h) => Math.min(h + 1, Math.max(0, hits.length - 1)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHi((h) => Math.max(0, h - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Type a player's name"
          aria-label="Your answer"
          aria-autocomplete="list"
          aria-controls={list}
          autoComplete="off"
          autoFocus
          className="h-14 min-w-0 flex-1 rounded-2xl border-2 border-white/15 bg-black/30 px-5 text-lg font-semibold text-[var(--paper)] outline-none placeholder:font-normal placeholder:text-[var(--muted)] focus:border-[var(--paper)]/60"
        />
        <button
          type="button"
          onClick={() => submit()}
          className="font-display h-14 shrink-0 cursor-pointer rounded-2xl bg-[var(--wood)] px-5 text-xl font-black text-[#10141a] transition-transform duration-150 active:scale-[0.96]"
        >
          Toss it
        </button>
      </div>
      {hits.length ? (
        <ul id={list} role="listbox" className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-white/12 bg-[#0d241a] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          {hits.map((h, k) => (
            <li key={h.pid} role="option" aria-selected={k === hi}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => submit(h.pid)}
                className={`flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left ${k === hi ? "bg-white/10" : "hover:bg-white/5"}`}
              >
                <Face pid={h.pid} players={players} size={32} />
                <span className="font-semibold">{h.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function DumpsterDive({ pool, players, people }: { pool: Prompt[]; players: Players; people: Person[] }) {
  const brand = useBrand();
  const reduce = useReducedMotion();
  const [day, setDay] = useState<string | null>(null);
  const [phase, setPhase] = useState<"intro" | "play" | "done">("intro");
  const [i, setI] = useState(0);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [settled, setSettled] = useState(false);
  const [board, setBoard] = useState(false);
  const [streak, setStreak] = useState(0);
  const [copied, setCopied] = useState(false);
  const [muted, setMuted] = useState(false);
  const [openRound, setOpenRound] = useState<number | null>(null);
  const stage = useRef<StageApi>(null);
  const total = useRef<HTMLSpanElement>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);
  const shown = useRef(0);
  const reportNum = useRef<HTMLSpanElement>(null);
  const [fresh, setFresh] = useState(false); // finished just now (not a revisit): the report plays its full show
  const [best, setBest] = useState<{ prev: number | null; now: number } | null>(null);

  useEffect(() => {
    const d = todayET();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDay(d);
    setMuted(sfx.isMuted());
    setStreak(store.get<{ last: string; n: number }>(brand.key("dive:streak"))?.n ?? 0);
    const b = store.get<number>(brand.key("dive:best"));
    if (b !== null) setBest({ prev: b, now: b });
    const saved = store.get<Saved>(brand.key(`dive3:${d}`));
    if (saved?.picks?.length === ROUNDS) {
      setPicks(saved.picks);
      setPhase("done");
    }
  }, [brand]);
  const qs = useMemo(() => (day ? dailyPrompts(pool, day) : []), [pool, day]);
  const edition = day ? Math.floor((Date.parse(day) - LAUNCH) / 86400000) + 1 : null;
  const q = qs[i];
  const current = picks[i] ?? null;
  const sum = picks.reduce((t, p) => t + (p.score ?? 0), 0);

  // Running total counts up instead of jumping.
  useEffect(() => {
    if (!settled && phase === "play") return;
    const o = { v: shown.current };
    if (sum > shown.current && total.current && !reduce)
      gsap.fromTo(total.current, { scale: 1.35 }, { scale: 1, duration: 0.6, delay: 0.5, ease: "elastic.out(1, 0.5)" });
    gsap.to(o, {
      v: sum,
      duration: reduce ? 0 : 0.8,
      ease: "power2.out",
      onUpdate: () => {
        if (total.current) total.current.textContent = String(Math.round(o.v));
      },
    });
    shown.current = sum;
  }, [sum, settled, phase, reduce]);

  useEffect(() => {
    if (settled) nextBtn.current?.focus();
  }, [settled]);

  const answer = async (pid: string | null, typed: string) => {
    if (!q || current) return;
    const hit = pid ? q.answers.find(([p]) => p === pid) : undefined;
    const score = hit ? hit[1] : null;
    setPicks((x) => [...x.slice(0, i), { pid, typed, score }]);
    await stage.current?.drop(pid, score, heatAt(picks, i - 1));
    setSettled(true);
  };
  const next = () => {
    setSettled(false);
    setBoard(false);
    if (i + 1 < qs.length) return setI(i + 1);
    setPhase("done");
    setFresh(true);
    sfx.fanfare();
    if (!day) return;
    const prevBest = store.get<number>(brand.key("dive:best"));
    store.set(brand.key("dive:best"), Math.max(prevBest ?? 0, sum));
    setBest({ prev: prevBest, now: Math.max(prevBest ?? 0, sum) });
    store.set(brand.key(`dive3:${day}`), { picks } satisfies Saved);
    const st = store.get<{ last: string; n: number }>(brand.key("dive:streak"));
    const y = new Date(Date.parse(day) - 86400000).toISOString().slice(0, 10);
    const n = st?.last === y ? st.n + 1 : st?.last === day ? st.n : 1;
    store.set(brand.key("dive:streak"), { last: day, n });
    setStreak(n);
  };
  // The report: the total counts up (with ticks), and a big night gets confetti.
  const newBest = fresh && best !== null && best.prev !== null && sum > best.prev;
  useEffect(() => {
    if (phase !== "done" || !reportNum.current) return;
    const el = reportNum.current;
    if (!fresh || reduce) {
      el.textContent = String(sum);
      return;
    }
    const o = { v: 0 };
    let last = 0;
    const tw = gsap.to(o, {
      v: sum,
      duration: 1.4,
      delay: 0.25,
      ease: "power3.out",
      onUpdate: () => {
        const v = Math.round(o.v);
        el.textContent = String(v);
        if (Math.floor(v / 25) !== Math.floor(last / 25)) sfx.tick();
        last = v;
      },
      onComplete: () => {
        if (newBest) sfx.record();
        if (sum >= 300 || newBest) {
          const colors = ["#e9c46a", "#c98a4b", "#f6f3ea", "#7fd49a"];
          void confetti({ particleCount: 120, spread: 100, startVelocity: 40, origin: { y: 0.55 }, colors, disableForReducedMotion: true });
        }
      },
    });
    return () => {
      tw.kill();
    };
  }, [phase, fresh, sum, reduce, newBest]);
  const nextRank = RANKS.find(([t]) => t > sum);
  const floor = [...RANKS].reverse().find(([t]) => t <= sum)?.[0] ?? 0;

  const share = async () => {
    const sq = picks.map((p) => (p.score === null ? "⬛" : p.score >= 90 ? "🟫" : p.score >= 60 ? "🟩" : p.score >= 25 ? "🟨" : "🟥"));
    const text = `${brand.games.dive} #${edition} ${sq.join("")} ${sum}/${ROUNDS * 100}\n${location.origin}${brand.base || "/"}#dive`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div data-no-rico className="xmas-drift relative overflow-visible rounded-[28px] border border-white/10 bg-[radial-gradient(120%_70%_at_70%_0%,rgba(201,138,75,0.16),rgba(12,32,24,0.92)_60%)] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.7)]">
      {/* HUD */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4 md:px-8">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-3xl leading-none font-black md:text-4xl">{brand.games.dive}</span>
          <span className="text-sm text-[var(--muted)]">{edition ? `No. ${edition}` : ""}</span>
        </div>
        <div className="flex items-center gap-3">
          <AnimatePresence>
            {(() => {
              const h = phase === "play" && settled ? heatAt(picks, i) : 0;
              return h >= 2 ? (
                <motion.span
                  key={h}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.8, rotate: -12 }}
                  animate={{ opacity: 1, scale: 1, rotate: -3 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", duration: 0.5, bounce: 0.5 }}
                  className="font-display inline-flex items-center gap-1 rounded-full bg-[var(--wood)] px-3 py-1 text-lg font-black text-[#10141a]"
                >
                  <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
                    <path d="M12 2c1 4-3 5-3 9a3 3 0 0 0 6 0c0-1-.5-2-1-3 3 1 5 4 5 7a7 7 0 0 1-14 0c0-6 6-8 7-13z" />
                  </svg>
                  {h} deep in a row
                </motion.span>
              ) : null;
            })()}
          </AnimatePresence>
          <div className="flex gap-1" aria-label="Round results">
            {Array.from({ length: ROUNDS }, (_, k) => {
              const p = picks[k];
              const live = phase === "play" && k === i && !(p && settled);
              const t = p && (settled || k < i || phase === "done") ? tierOf(p.score) : null;
              return (
                <motion.span
                  key={`${k}-${t?.short ?? ""}`}
                  initial={t && !reduce ? { scale: 0.3, rotate: -20 } : false}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", duration: 0.45, bounce: 0.55 }}
                  className={`flex h-9 w-7 items-center justify-center rounded-md border text-[11px] font-black tabular-nums ${live ? "border-[var(--paper)]" : "border-white/15"}`}
                  style={{ background: t ? t.hex : "rgba(0,0,0,0.25)", color: t ? "#10141a" : undefined }}
                >
                  {t ? (p!.score ?? "×") : k + 1}
                </motion.span>
              );
            })}
          </div>
          <div className="text-right">
            <span ref={total} className="font-display block text-3xl leading-none font-black tabular-nums">
              0
            </span>
            <span className="text-[10px] text-[var(--muted)]">of {ROUNDS * 100}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              sfx.setMuted(!muted);
              setMuted(!muted);
            }}
            aria-label={muted ? "Turn sound on" : "Turn sound off"}
            className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-white/8 hover:bg-white/14"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
              {muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12" />}
            </svg>
          </button>
        </div>
      </div>

      <div className="p-5 md:p-8">
        <AnimatePresence mode="wait">
          {phase === "intro" ? (
            <motion.div
              key="intro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: reduce ? 0 : -12 }}
              className="grid gap-8 md:grid-cols-[1fr_340px] md:items-center"
            >
              <div>
                <p className="font-display text-[clamp(2.4rem,6vw,4.2rem)] leading-[0.9] font-black">
                  The deeper you dig, the more it&apos;s worth.
                </p>
                <ol className="mt-6 space-y-3 text-[var(--paper)]/85">
                  {[
                    ["1", `Five prompts, like “name a player ${people.some((x) => x.nick === "Rico") ? "Rico" : (people[0]?.nick ?? "a manager")} has started.”`],
                    ["2", "Any right answer counts. Toss your player into the bin."],
                    ["3", "Obscure picks sink deep and score up to 100. The obvious star barely gets in."],
                  ].map(([n, t]) => (
                    <li key={n} className="flex gap-3">
                      <span className="font-display flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--wood)] text-lg font-black text-[#10141a]">
                        {n}
                      </span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ol>
                <button
                  type="button"
                  disabled={!day}
                  onClick={() => {
                    sfx.creak();
                    setPhase("play");
                  }}
                  className="dd-start font-display relative mt-8 inline-flex h-16 cursor-pointer items-center overflow-hidden rounded-full bg-[var(--paper)] px-10 text-3xl font-black text-[var(--bin)] transition-transform duration-150 active:scale-[0.96] disabled:opacity-50"
                >
                  Start digging
                </button>
              </div>
              <div className="dd-idle mx-auto w-full max-w-[300px] md:max-w-none">
                <Stage players={players} apiRef={stage} />
              </div>
            </motion.div>
          ) : null}

          {phase === "play" && q ? (
            <motion.div
              key="play"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid gap-6 [grid-template-areas:'p'_'s'_'i'] md:grid-cols-[1fr_360px] md:[grid-template-areas:'p_s'_'i_s']"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: reduce ? 0 : 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: reduce ? 0 : -24 }}
                  transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                  className="[grid-area:p]"
                >
                  <p className="inline-flex rounded-full bg-[var(--wood)]/20 px-3 py-1 text-xs font-bold text-[var(--wood)]">
                    {q.kind}, prompt {i + 1} of {qs.length}
                  </p>
                  <h3 className="font-display mt-3 max-w-[20ch] text-[clamp(2rem,4.8vw,3.3rem)] leading-[0.96] font-black">
                    {q.prompt}
                  </h3>
                  <p className="mt-2 text-sm text-[var(--muted)]">{q.answers.length} right answers are in the bin.</p>
                </motion.div>
              </AnimatePresence>

              <div className="mx-auto w-full max-w-[300px] [grid-area:s] md:max-w-none">
                <Stage players={players} apiRef={stage} round={i} />
              </div>

              <div className="[grid-area:i]">
                {!current ? (
                  <AnswerBox players={players} onPick={answer} />
                ) : settled ? (
                  <motion.div
                    initial={{ opacity: 0, y: reduce ? 0 : 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="rounded-2xl border border-white/10 bg-black/30 p-5"
                  >
                    <p className="text-sm text-[var(--muted)]">You tossed in {current.typed}</p>
                    <p className="font-display mt-1 text-4xl leading-none font-black" style={{ color: tierOf(current.score).color }}>
                      {current.score === null ? "Not a right answer" : `${current.score} niche points`}
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {[
                        ["Deepest answer", q.answers[0]],
                        ["What everyone says", q.answers[q.answers.length - 1]],
                      ].map(([label, a]) => {
                        const [pid, s] = a as [string, number];
                        return (
                          <div key={label as string} className="flex items-center gap-3 rounded-xl bg-black/25 p-2.5">
                            <Face pid={pid} players={players} size={36} />
                            <div className="min-w-0">
                              <p className="text-xs text-[var(--muted)]">{label as string}</p>
                              <p className="break-words text-sm font-semibold">
                                {pname(players, pid)} <span className="text-[var(--muted)]">{s}</span>
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <button
                        ref={nextBtn}
                        type="button"
                        onClick={next}
                        className="font-display inline-flex h-12 cursor-pointer items-center rounded-full bg-[var(--paper)] px-6 text-xl font-black text-[var(--bin)] transition-transform duration-150 active:scale-[0.96]"
                      >
                        {i + 1 < qs.length ? "Next prompt" : "See my dive report"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setBoard((v) => !v)}
                        aria-expanded={board}
                        className="cursor-pointer text-sm font-semibold text-[var(--paper)]/85 underline-offset-4 hover:underline"
                      >
                        {board ? "Hide the answers" : `See all ${q.answers.length} answers`}
                      </button>
                    </div>
                    {board ? (
                      <div className="mt-5">
                        <AnswerBoard answers={q.answers} mine={current.pid} players={players} />
                      </div>
                    ) : null}
                  </motion.div>
                ) : (
                  <p className="font-display text-2xl font-black text-[var(--muted)]">Into the bin…</p>
                )}
              </div>
            </motion.div>
          ) : null}

          {phase === "done" ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: reduce ? 1 : 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            >
              <div className="grid gap-8 md:grid-cols-[1fr_1fr] md:items-center">
                <div className="text-center md:text-left">
                  <p className="text-sm text-[var(--muted)]">Dive report</p>
                  {newBest ? (
                    <motion.p
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: "spring", duration: 0.5, bounce: 0.4, delay: 1.7 }}
                      className="font-display mt-1 inline-block rounded-full bg-[var(--wood)] px-3 py-0.5 text-lg font-black text-[#10141a]"
                    >
                      New personal best
                    </motion.p>
                  ) : null}
                  <p className="font-display text-[clamp(4.5rem,15vw,8rem)] leading-none font-black tabular-nums">
                    <span ref={reportNum}>{sum}</span>
                    <span className="text-[0.35em] text-[var(--muted)]">/{ROUNDS * 100}</span>
                  </p>
                  <motion.p
                    initial={reduce ? false : { scale: 1.8, opacity: 0, rotate: -8 }}
                    animate={{ scale: 1, opacity: 1, rotate: -2 }}
                    transition={{ type: "spring", duration: 0.6, bounce: 0.45, delay: 0.3 }}
                    className="font-display mt-2 inline-block rounded-lg bg-[var(--wood)] px-3 py-1 text-2xl font-black text-[#10141a]"
                  >
                    {rankOf(sum)}
                  </motion.p>
                  {nextRank ? (
                    <div className="mx-auto mt-5 max-w-sm md:mx-0">
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <motion.div
                          className="h-full origin-left rounded-full bg-[var(--wood)]"
                          initial={{ scaleX: fresh && !reduce ? 0 : (sum - floor) / (nextRank[0] - floor) }}
                          animate={{ scaleX: (sum - floor) / (nextRank[0] - floor) }}
                          transition={{ duration: 1.1, delay: 0.5, ease: [0.23, 1, 0.32, 1] }}
                        />
                      </div>
                      <p className="mt-1.5 text-sm text-[var(--muted)]">
                        {nextRank[0] - sum} more for <span className="font-semibold text-[var(--paper)]">{nextRank[1]}</span>
                      </p>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm font-semibold text-[var(--wood)]">Top rank. Nothing deeper exists.</p>
                  )}
                  <p className="mt-3 text-sm text-[var(--muted)]">
                    {streak > 1 ? `${streak}-day streak` : null}
                    {streak > 1 && best ? " · " : null}
                    {best ? `Personal best ${best.now}` : null}
                  </p>
                </div>
                {/* the hand: five cards fanned out */}
                <div className="flex justify-center py-6 [perspective:900px]">
                  {picks.map((p, k) => {
                    const t = tierOf(p.score);
                    const rot = (k - 2) * 8;
                    return (
                      <motion.div
                        key={k}
                        initial={reduce ? false : { y: 80, opacity: 0, rotate: 0, rotateY: 100 }}
                        animate={{ y: Math.abs(k - 2) * 8, opacity: 1, rotate: rot, rotateY: 0 }}
                        transition={{ type: "spring", duration: 0.8, bounce: 0.3, delay: 0.15 + k * 0.11 }}
                        className="-mx-2 w-[22%] max-w-[96px] overflow-hidden rounded-xl border-[3px] bg-[#0d241a]"
                        style={{
                          borderColor: t.hex,
                          transformOrigin: "50% 120%",
                          boxShadow: (p.score ?? 0) >= 90 ? "0 0 28px rgba(233,196,106,0.75), 0 12px 30px rgba(0,0,0,0.5)" : "0 12px 30px rgba(0,0,0,0.5)",
                        }}
                      >
                        <div className="flex aspect-square items-center justify-center bg-[radial-gradient(circle_at_50%_30%,#2a5a45,#0d241a)]">
                          {p.pid ? <Face pid={p.pid} players={players} size={56} /> : <span className="font-display text-3xl font-black text-[var(--ticket)]">×</span>}
                        </div>
                        <p className="py-1 text-center text-sm font-black tabular-nums" style={{ background: t.hex, color: "#10141a" }}>
                          {p.score ?? "miss"}
                        </p>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-black/25 p-4">
                <div>
                  <p className="text-sm text-[var(--muted)]">Next dive in</p>
                  <NextDive />
                </div>
                <button
                  type="button"
                  onClick={share}
                  className="font-display inline-flex h-12 cursor-pointer items-center rounded-full bg-[var(--paper)] px-6 text-xl font-black text-[var(--bin)] transition-transform duration-150 active:scale-[0.96]"
                >
                  {copied ? "Copied" : "Copy my result"}
                </button>
              </div>

              <Leaderboard
                game="dive2"
                day={day}
                saveKeys={day ? [`dive3:${day}`] : undefined}
                people={people}
                result={picks.length === ROUNDS ? { score: sum, label: picks.map((p) => (p.score === null ? "×" : p.score)).join(" · ") } : null}
              />

              <h4 className="font-display mt-10 text-3xl font-black">Every answer, every prompt</h4>
              <ul className="mt-4 space-y-2">
                {qs.map((pq, k) => {
                  const p = picks[k];
                  const open = openRound === k;
                  return (
                    <li key={k} className="rounded-2xl border border-white/10 bg-black/20">
                      <button
                        type="button"
                        onClick={() => setOpenRound(open ? null : k)}
                        aria-expanded={open}
                        className="flex w-full cursor-pointer items-center gap-3 p-4 text-left"
                      >
                        <span className="rounded-md px-2 py-0.5 text-sm font-black tabular-nums" style={{ background: tierOf(p?.score ?? null).hex, color: "#10141a" }}>
                          {p?.score ?? "×"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{pq.prompt}</span>
                          <span className="block text-sm text-[var(--muted)]">
                            You said {p?.typed ?? "nothing"}. Deepest: {pname(players, pq.answers[0][0])}.
                          </span>
                        </span>
                        <span className={`text-xl transition-transform duration-200 ${open ? "rotate-45" : ""}`}>+</span>
                      </button>
                      {open ? (
                        <div className="px-4 pb-4">
                          <AnswerBoard answers={pq.answers} mine={p?.pid ?? null} players={players} />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
