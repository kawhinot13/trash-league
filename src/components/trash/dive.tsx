"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Players } from "@/lib/extras";
import type { Prompt } from "@/lib/dive";
import { Face } from "./player";

const ROUNDS = 5;
const LAUNCH = Date.UTC(2026, 10, 14);

type Pick = { pid: string | null; typed: string; score: number | null };
type Saved = { picks: Pick[] };

const todayET = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
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

/** Today's five prompts, one per kind, identical for everyone on the same day. */
function todays(pool: Prompt[], day: string) {
  const r = rng(Number(day.replaceAll("-", "")));
  const kinds = [...new Set(pool.map((q) => q.kind))].sort().sort(() => r() - 0.5);
  return kinds.slice(0, ROUNDS).map((k) => {
    const of = pool.filter((q) => q.kind === k);
    return of[Math.floor(r() * of.length)];
  });
}

const tier = (s: number | null) =>
  s === null
    ? { label: "Not in the bin", color: "var(--ticket)", sq: "⬛" }
    : s >= 90
      ? { label: "Dumpster diver", color: "var(--wood)", sq: "🟫" }
      : s >= 60
        ? { label: "Deep cut", color: "#7fd49a", sq: "🟩" }
        : s >= 25
          ? { label: "Solid pull", color: "var(--paper)", sq: "🟨" }
          : { label: "Everybody said that", color: "var(--muted)", sq: "🟥" };

/* ── The dumpster depth gauge: your pick sinks as deep as it is niche ── */
function Dumpster({ pick, players }: { pick: Pick | null; players: Players }) {
  const reduce = useReducedMotion();
  const top = 70;
  const depth = 190;
  const y = pick && pick.score !== null ? top + 14 + (pick.score / 100) * (depth - 40) : 0;
  return (
    <div className="relative mx-auto w-full max-w-[260px]" aria-hidden>
      <svg viewBox="0 0 260 300" className="block h-auto w-full">
        {/* lid, propped open */}
        <path d="M30 64 L222 20 L228 34 L36 78 Z" fill="var(--bin-3)" stroke="#10141a" strokeWidth="5" strokeLinejoin="round" />
        {/* body */}
        <path d="M34 70 H226 L214 266 H46 Z" fill="var(--bin-2)" stroke="#10141a" strokeWidth="6" strokeLinejoin="round" />
        <path d="M34 70 H226 L214 266 H46 Z" fill="url(#dive-depth)" />
        <defs>
          <linearGradient id="dive-depth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity=".55" />
          </linearGradient>
        </defs>
        {/* depth ticks */}
        {[0, 25, 50, 75, 100].map((t) => {
          const ty = top + 14 + (t / 100) * (depth - 40);
          return (
            <g key={t}>
              <line x1="50" x2="66" y1={ty} y2={ty} stroke="var(--paper)" strokeOpacity=".35" strokeWidth="2" />
              <text x="72" y={ty + 4} fontSize="11" fill="var(--paper)" fillOpacity=".5">
                {t}
              </text>
            </g>
          );
        })}
        <rect x="56" y="268" width="26" height="14" rx="4" fill="#10141a" />
        <rect x="178" y="268" width="26" height="14" rx="4" fill="#10141a" />
        <text x="130" y="244" textAnchor="middle" className="font-display" fontSize="20" fontWeight="900" fill="var(--paper)" fillOpacity=".18">
          TRASH
        </text>
      </svg>
      <AnimatePresence>
        {pick ? (
          <motion.div
            key={pick.typed}
            className="absolute left-[58%] -translate-x-1/2"
            initial={{ top: -10, opacity: 0, rotate: -20 }}
            animate={
              pick.score === null
                ? reduce
                  ? { top: 20, opacity: 0.6 }
                  : { top: [-10, 26, -30, 60], left: ["58%", "58%", "82%", "110%"], rotate: [-20, 10, 140, 280], opacity: [1, 1, 1, 0] }
                : { top: (y / 300) * 100 + "%", opacity: 1, rotate: 0 }
            }
            transition={
              pick.score === null
                ? { duration: reduce ? 0.2 : 1.1, ease: "easeOut" }
                : reduce
                  ? { duration: 0.2 }
                  : { type: "spring", duration: 1.1, bounce: 0.35 }
            }
            style={{ marginTop: -22 }}
          >
            {pick.pid ? (
              <span className="block rounded-full ring-4 ring-[#10141a]">
                <Face pid={pick.pid} players={players} size={44} />
              </span>
            ) : (
              <span className="block size-11 rounded-full bg-[var(--ticket)] ring-4 ring-[#10141a]" />
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function AnswerBox({
  players,
  onPick,
  disabled,
}: {
  players: Players;
  onPick: (pid: string | null, typed: string) => void;
  disabled: boolean;
}) {
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const list = useId();
  const all = useMemo(
    () => Object.entries(players).map(([pid, p]) => ({ pid, name: p[0], n: norm(p[0]) })).filter((x) => x.name),
    [players],
  );
  const nq = norm(q);
  const hits =
    nq.length < 2
      ? []
      : all
          .filter((x) => x.n.split(" ").some((w) => w.startsWith(nq)) || x.n.startsWith(nq))
          .slice(0, 6);
  const submit = (pid?: string) => {
    if (disabled || !q.trim()) return;
    const exact = pid ?? all.find((x) => x.n === nq)?.pid ?? hits[hi]?.pid ?? null;
    onPick(exact, exact ? players[exact][0] : q.trim());
    setQ("");
  };
  return (
    <div className="relative">
      <input
        value={q}
        disabled={disabled}
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
        className="h-14 w-full rounded-2xl border-2 border-white/15 bg-black/30 px-5 text-lg font-semibold text-[var(--paper)] outline-none placeholder:font-normal placeholder:text-[var(--muted)] focus:border-[var(--paper)]/60"
      />
      {hits.length ? (
        <ul id={list} role="listbox" className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-white/12 bg-[#0d241a] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
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

export function DumpsterDive({ pool, players }: { pool: Prompt[]; players: Players }) {
  const reduce = useReducedMotion();
  const [day, setDay] = useState<string | null>(null);
  const [phase, setPhase] = useState<"intro" | "play" | "done">("intro");
  const [i, setI] = useState(0);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [streak, setStreak] = useState(0);
  const [copied, setCopied] = useState(false);
  const nextBtn = useRef<HTMLButtonElement>(null);

  // Date-dependent bits only after mount, so server and client render the same first frame.
  useEffect(() => {
    const d = todayET();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDay(d);
    setStreak(store.get<{ last: string; n: number }>("dive:streak")?.n ?? 0);
    const saved = store.get<Saved>(`dive2:${d}`);
    if (saved?.picks?.length === ROUNDS) {
      setPicks(saved.picks);
      setPhase("done");
    }
  }, []);
  const qs = useMemo(() => (day ? todays(pool, day) : []), [pool, day]);
  const edition = day ? Math.floor((Date.parse(day) - LAUNCH) / 86400000) + 1 : null;
  const q = qs[i];
  const current = picks[i] ?? null;
  const total = picks.reduce((t, p) => t + (p.score ?? 0), 0);

  useEffect(() => {
    if (current) nextBtn.current?.focus();
  }, [current]);

  const answer = (pid: string | null, typed: string) => {
    if (!q || current) return;
    const hit = pid ? q.answers.find(([p]) => p === pid) : undefined;
    setPicks((x) => [...x.slice(0, i), { pid, typed, score: hit ? hit[1] : null }]);
  };
  const next = () => {
    if (i + 1 < qs.length) return setI(i + 1);
    setPhase("done");
    if (!day) return;
    store.set(`dive2:${day}`, { picks } satisfies Saved);
    const st = store.get<{ last: string; n: number }>("dive:streak");
    const y = new Date(Date.parse(day) - 86400000).toISOString().slice(0, 10);
    const n = st?.last === y ? st.n + 1 : st?.last === day ? st.n : 1;
    store.set("dive:streak", { last: day, n });
    setStreak(n);
  };
  const share = async () => {
    const text = `Dumpster Dive #${edition} ${picks.map((p) => tier(p.score).sq).join("")} ${total}/${ROUNDS * 100}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };
  const name = (pid: string) => players[pid]?.[0] ?? pid;
  const rating =
    total >= 400 ? "Lives in the dumpster" : total >= 300 ? "Deep diver" : total >= 200 ? "Knows ball" : total >= 100 ? "Casual" : "Read the group chat sometimes";

  return (
    <div className="relative rounded-[28px] border border-white/10 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(201,138,75,0.2),rgba(16,40,30,0.75)_60%)] p-5 md:p-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-display text-[clamp(2.6rem,7vw,4.6rem)] leading-[0.85] font-black">Dumpster Dive</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {edition ? `No. ${edition}` : "Daily"}, five prompts, the more niche the better
          </p>
        </div>
        <div className="flex gap-1.5" aria-label="Today's picks">
          {Array.from({ length: ROUNDS }, (_, k) => {
            const p = picks[k];
            return (
              <motion.span
                key={`${k}-${p?.typed ?? ""}`}
                initial={p && !reduce ? { scale: 0.4 } : false}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.4, bounce: 0.5 }}
                className="flex size-8 items-center justify-center rounded-md border border-white/15 text-xs font-bold tabular-nums"
                style={{
                  background: p ? tier(p.score).color : "transparent",
                  color: p ? "var(--bin)" : undefined,
                }}
              >
                {p ? (p.score ?? "×") : ""}
              </motion.span>
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
            exit={{ opacity: 0 }}
            className="mt-10 grid gap-8 md:grid-cols-[1fr_auto] md:items-center"
          >
            <div>
              <p className="max-w-[46ch] text-lg leading-relaxed text-[var(--paper)]/85">
                Five prompts like &ldquo;name a player Rico has started.&rdquo; Any right answer counts, but the
                deeper you dig the more it&apos;s worth. Name the guy nobody remembers and score 100. Say the obvious
                star and score next to nothing.
              </p>
              <button
                type="button"
                disabled={!day}
                onClick={() => setPhase("play")}
                className="font-display mt-6 inline-flex h-14 cursor-pointer items-center rounded-full bg-[var(--paper)] px-8 text-2xl font-black text-[var(--bin)] transition-transform duration-150 active:scale-[0.97] disabled:opacity-50"
              >
                Start digging
              </button>
            </div>
            <Dumpster pick={null} players={players} />
          </motion.div>
        ) : null}

        {phase === "play" && q ? (
          <motion.div
            key={`q-${i}`}
            initial={{ opacity: 0, x: reduce ? 0 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: reduce ? 0 : -24 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="mt-8 grid gap-8 md:grid-cols-[1fr_260px] md:items-start"
          >
            <div>
              <p className="text-sm font-semibold text-[var(--wood)]">
                {q.kind}, prompt {i + 1} of {qs.length}
              </p>
              <h3 className="font-display mt-2 max-w-[22ch] text-[clamp(2rem,4.8vw,3.2rem)] leading-[0.98] font-black">
                {q.prompt}
              </h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{q.answers.length} right answers in the bin.</p>
              <div className="mx-auto mt-4 w-40 md:hidden">
                <Dumpster pick={current} players={players} />
              </div>

              <div className="mt-6">
                {!current ? (
                  <AnswerBox players={players} onPick={answer} disabled={!!current} />
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: reduce ? 0 : 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: reduce ? 0 : 0.6 }}
                    className="rounded-2xl bg-black/30 p-5"
                  >
                    <p className="text-sm text-[var(--muted)]">You said {current.typed}</p>
                    <p className="font-display mt-1 text-4xl font-black" style={{ color: tier(current.score).color }}>
                      {current.score === null ? "Not in the bin" : `${current.score} pts, ${tier(current.score).label.toLowerCase()}`}
                    </p>
                    <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                      <p>
                        <span className="text-[var(--muted)]">Deepest answer: </span>
                        <span className="font-semibold">{name(q.answers[0][0])}</span>
                      </p>
                      <p>
                        <span className="text-[var(--muted)]">What everyone says: </span>
                        <span className="font-semibold">{name(q.answers[q.answers.length - 1][0])}</span>
                      </p>
                    </div>
                    <button
                      ref={nextBtn}
                      type="button"
                      onClick={next}
                      className="mt-5 inline-flex h-12 cursor-pointer items-center rounded-full bg-[var(--paper)] px-6 font-semibold text-[var(--bin)] transition-transform duration-150 active:scale-[0.97]"
                    >
                      {i + 1 < qs.length ? "Next prompt" : "See my dive"}
                    </button>
                  </motion.div>
                )}
              </div>
            </div>
            <div className="hidden md:block">
              <Dumpster pick={current} players={players} />
            </div>
          </motion.div>
        ) : null}

        {phase === "done" ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: reduce ? 1 : 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
            className="mt-10 grid gap-8 md:grid-cols-[1fr_1fr]"
          >
            <div className="rounded-3xl border-2 border-white/10 bg-black/40 p-6 text-center">
              <p className="text-sm text-[var(--muted)]">Today&apos;s dive</p>
              <p className="font-display text-[clamp(4rem,14vw,7rem)] leading-none font-black tabular-nums">
                {total}
                <span className="text-[0.4em] text-[var(--muted)]">/{ROUNDS * 100}</span>
              </p>
              <p className="font-display mt-1 text-2xl font-black text-[var(--wood)]">{rating}</p>
              {streak > 1 ? <p className="mt-2 text-sm text-[var(--muted)]">{streak}-day streak</p> : null}
            </div>
            <div>
              <ol className="space-y-2">
                {picks.map((p, k) => (
                  <li key={k} className="flex items-center gap-3 text-sm">
                    {p.pid ? <Face pid={p.pid} players={players} size={32} /> : <span className="size-8 rounded-full bg-black/30" />}
                    <span className="min-w-0 flex-1 truncate">{p.typed}</span>
                    <span className="font-semibold tabular-nums" style={{ color: tier(p.score).color }}>
                      {p.score ?? "miss"}
                    </span>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                onClick={share}
                className="mt-6 inline-flex h-12 cursor-pointer items-center rounded-full bg-[var(--paper)] px-6 font-semibold text-[var(--bin)] transition-transform duration-150 active:scale-[0.97]"
              >
                {copied ? "Copied" : "Copy my result"}
              </button>
              <p className="mt-3 text-sm text-[var(--muted)]">New prompts at midnight Eastern.</p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
