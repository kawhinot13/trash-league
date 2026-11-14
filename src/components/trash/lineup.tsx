"use client";

import confetti from "canvas-confetti";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Players } from "@/lib/extras";
import type { Suspect } from "@/lib/lineup";
import { sfx } from "./dive/sfx";
import { Face } from "./player";

const TRIES = 8;
const LAUNCH = Date.UTC(2026, 10, 14);
type Mark = "hit" | "close" | "miss";
const BG: Record<Mark, string> = { hit: "#7fd49a", close: "#c98a4b", miss: "#1d3329" };
const YR = ["", "’23", "’24", "’25", "’26"];

const todayET = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, "");
const ft = (h: number) => `${Math.floor(h / 12)}′${h % 12}″`;
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

type Clue = { label: string; value: string; mark: Mark; arrow?: "up" | "down" };

/** Compare a guess to the suspect. Arrows point toward the answer. */
function clues(g: Suspect, t: Suspect, nick: (id: string) => string): Clue[] {
  const num = (a: number, b: number, near: number) =>
    ({ mark: a === b ? "hit" : Math.abs(a - b) <= near ? "close" : "miss", arrow: a === b ? undefined : b > a ? "up" : "down" }) as const;
  const posHit = g.pos.length === t.pos.length && g.pos.every((p) => t.pos.includes(p));
  const posNear = g.pos.some((p) => t.pos.includes(p));
  return [
    { label: "Team", value: g.team, mark: g.team === t.team ? "hit" : g.conf && g.conf === t.conf ? "close" : "miss" },
    { label: "Pos", value: g.pos.join("/") || "?", mark: posHit ? "hit" : posNear ? "close" : "miss" },
    { label: "Height", value: ft(g.height), ...num(g.height, t.height, 2) },
    { label: "Trash weeks", value: String(g.weeks), ...num(g.weeks, t.weeks, 8) },
    { label: "Top owner", value: nick(g.owner), mark: g.owner === t.owner ? "hit" : t.owners.includes(g.owner) ? "close" : "miss" },
    { label: "First season", value: YR[g.first], ...num(g.first, t.first, 1) },
  ];
}

function Chip({ c, i, fresh }: { c: Clue; i: number; fresh: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={fresh && !reduce ? { rotateY: 90, opacity: 0 } : false}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ duration: 0.35, delay: fresh ? i * 0.16 : 0, ease: [0.23, 1, 0.32, 1] }}
      onAnimationStart={() => fresh && setTimeout(() => sfx.tick(), i * 160)}
      className="flex min-h-14 flex-col items-center justify-center rounded-xl px-1.5 py-1.5 text-center"
      style={{ background: BG[c.mark], color: c.mark === "miss" ? "#f6f3ea" : "#10141a" }}
    >
      <span className="text-[10px] leading-none font-semibold opacity-70 md:hidden">{c.label}</span>
      <span className="mt-0.5 flex items-center gap-1 text-sm leading-tight font-black">
        <span className="truncate">{c.value}</span>
        {c.arrow ? <span aria-label={c.arrow === "up" ? "higher" : "lower"}>{c.arrow === "up" ? "↑" : "↓"}</span> : null}
      </span>
    </motion.div>
  );
}

/** The lineup wall: height lines, a placard and the suspect, a silhouette until identified. */
function Wall({ solved, suspect, players, flashKey }: { solved: boolean | null; suspect: Suspect | null; players: Players; flashKey: number }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b1d15]" style={{ aspectRatio: "4 / 5" }}>
      {/* height chart */}
      <div className="absolute inset-0">
        {[84, 81, 78, 75, 72].map((h, i) => (
          <div key={h} className="absolute inset-x-0 border-t border-dashed border-white/15" style={{ top: `${14 + i * 17}%` }}>
            <span className="absolute -top-2.5 left-2 text-[10px] font-semibold text-white/40">{ft(h)}</span>
            <span className="absolute -top-2.5 right-2 text-[10px] font-semibold text-white/40">{ft(h)}</span>
          </div>
        ))}
      </div>
      {/* spotlight */}
      <div className="absolute inset-x-[15%] top-0 bottom-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(246,243,234,0.12),transparent_65%)]" />
      {/* suspect */}
      <div className="absolute inset-x-0 bottom-[16%] flex justify-center">
        <AnimatePresence mode="wait">
          {solved !== null && suspect ? (
            <motion.div
              key="face"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", duration: 0.7, bounce: 0.35, delay: 0.25 }}
              className="rounded-full ring-4 ring-[var(--paper)]/80"
            >
              <Face pid={suspect.pid} players={players} size={150} />
            </motion.div>
          ) : (
            <motion.svg key="sil" viewBox="0 0 120 200" className="h-[62%] w-auto" exit={{ opacity: 0 }} style={{ height: "clamp(150px, 46vw, 250px)" }}>
              <circle cx="60" cy="34" r="24" fill="#050c08" />
              <path d="M22 200 L26 96 C28 72 42 62 60 62 C78 62 92 72 94 96 L98 200 Z" fill="#050c08" />
              <text x="60" y="44" textAnchor="middle" fontSize="28" fontWeight="900" fill="#f6f3ea" fillOpacity=".25" fontFamily="var(--font-trash-display)">
                ?
              </text>
            </motion.svg>
          )}
        </AnimatePresence>
      </div>
      {/* placard */}
      <div className="absolute inset-x-[18%] bottom-[5%] rounded-md border-2 border-[#10141a] bg-[var(--paper)] px-2 py-1.5 text-center text-[#10141a] shadow-lg">
        <p className="text-[10px] leading-none font-bold tracking-wide opacity-70">TRASH PD</p>
        <p className="font-display mt-0.5 truncate text-lg leading-none font-black">
          {solved !== null && suspect ? suspect.name : "Unidentified"}
        </p>
      </div>
      {/* camera flash on reveal */}
      <AnimatePresence>
        {flashKey && !reduce ? (
          <motion.div
            key={flashKey}
            className="pointer-events-none absolute inset-0 bg-white"
            initial={{ opacity: 0.95 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        ) : null}
      </AnimatePresence>
      {/* verdict stamp */}
      <AnimatePresence>
        {solved !== null ? (
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 2.2, rotate: -20 }}
            animate={{ opacity: 1, scale: 1, rotate: -12 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.4, delay: 0.6 }}
            className="font-display absolute top-[8%] right-[6%] rounded-md border-4 px-2 py-0.5 text-2xl font-black"
            style={{ color: solved ? "#7fd49a" : "var(--ticket)", borderColor: solved ? "#7fd49a" : "var(--ticket)" }}
          >
            {solved ? "IDENTIFIED" : "GOT AWAY"}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function Lineup({
  suspects,
  answers,
  nicks,
  players,
}: {
  suspects: Suspect[];
  answers: string[];
  nicks: Record<string, string>;
  players: Players;
}) {
  const [day, setDay] = useState<string | null>(null);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const [flash, setFlash] = useState(0);
  const [copied, setCopied] = useState(false);
  const fx = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const byId = useMemo(() => new Map(suspects.map((s) => [s.pid, s])), [suspects]);
  const nick = (id: string) => nicks[id] ?? id;

  useEffect(() => {
    const d = todayET();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDay(d);
    setGuesses(store.get<string[]>(`lineup:${d}`) ?? []);
  }, []);
  const edition = day ? Math.floor((Date.parse(day) - LAUNCH) / 86400000) + 1 : 1;
  const target = day ? byId.get(answers[(edition * 53 + 29) % answers.length]) ?? null : null;
  const won = !!target && guesses.includes(target.pid);
  const over = won || guesses.length >= TRIES;

  const nq = norm(q).trim();
  const toks = nq.split(" ").filter(Boolean);
  // Every word typed must start some word of the name, so "joel em" finds Joel Embiid.
  const hits =
    nq.length < 2
      ? []
      : suspects
          .filter((s) => {
            if (guesses.includes(s.pid)) return false;
            const words = norm(s.name).split(" ");
            return toks.every((t) => words.some((w) => w.startsWith(t)));
          })
          .slice(0, 6);
  const [nope, setNope] = useState(false);

  const guess = (pid: string) => {
    if (!target || over || guesses.includes(pid)) return;
    const next = [...guesses, pid];
    setGuesses(next);
    setFresh(pid);
    setQ("");
    setHi(0);
    if (day) store.set(`lineup:${day}`, next);
    const reveal = reduce ? 0 : 6 * 160 + 400;
    if (pid === target.pid)
      setTimeout(() => {
        setFlash(Date.now());
        sfx.chime(95);
        if (fx.current && !reduce)
          void confetti.create(fx.current, { resize: true, useWorker: true })({
            particleCount: 100,
            spread: 70,
            origin: { x: 0.25, y: 0.4 },
            colors: ["#7fd49a", "#c98a4b", "#f6f3ea"],
          });
      }, reveal);
    else if (next.length >= TRIES) setTimeout(() => sfx.slam(), reveal);
  };

  const share = async () => {
    if (!target) return;
    const sq = { hit: "🟩", close: "🟫", miss: "⬛" };
    const rows = guesses.map((g) => clues(byId.get(g)!, target, nick).map((c) => sq[c.mark]).join("")).join("\n");
    try {
      await navigator.clipboard.writeText(`The Lineup #${edition} ${won ? guesses.length : "X"}/${TRIES}\n${rows}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(120%_70%_at_20%_0%,rgba(246,243,234,0.07),rgba(12,32,24,0.94)_60%)] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.7)]">
      <canvas ref={fx} className="pointer-events-none absolute inset-0 z-20 h-full w-full" aria-hidden />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4 md:px-8">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-3xl leading-none font-black md:text-4xl">The Lineup</span>
          <span className="text-sm text-[var(--muted)]">Case No. {edition}</span>
        </div>
        <div className="flex gap-1" aria-label={`${TRIES - guesses.length} guesses left`}>
          {Array.from({ length: TRIES }, (_, k) => (
            <span
              key={k}
              className="h-6 w-2.5 rounded-full transition-colors duration-300"
              style={{ background: k < guesses.length ? (guesses[k] === target?.pid ? "#7fd49a" : "rgba(246,243,234,0.18)") : "var(--paper)" }}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-6 p-5 md:grid-cols-[300px_1fr] md:p-8">
        <div className="mx-auto w-full max-w-[300px]">
          <Wall solved={over ? won : null} suspect={target} players={players} flashKey={flash} />
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
            Name any player from Trash history. Each statement shows how close you are: green is a match, brown is close,
            arrows point toward the suspect.
          </p>
        </div>

        <div className="min-w-0">
          {!over ? (
            <div className="relative">
              <input
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
                    if (hits[hi]) guess(hits[hi].pid);
                    else if (nq.length >= 2) {
                      setNope(true);
                      sfx.buzz();
                      setTimeout(() => setNope(false), 2400);
                    }
                  }
                }}
                placeholder={`Name a suspect (${TRIES - guesses.length} left)`}
                aria-label="Guess a player"
                autoComplete="off"
                className="h-14 w-full rounded-2xl border-2 border-white/15 bg-black/30 px-5 text-lg font-semibold text-[var(--paper)] outline-none placeholder:font-normal placeholder:text-[var(--muted)] focus:border-[var(--paper)]/60"
              />
              {nope ? (
                <p role="status" className="mt-2 text-sm font-semibold text-[var(--ticket)]">
                  No Trash player by that name. Pick one from the list.
                </p>
              ) : null}
              {hits.length ? (
                <ul role="listbox" className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-white/12 bg-[#0d241a] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                  {hits.map((h, k) => (
                    <li key={h.pid} role="option" aria-selected={k === hi}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => guess(h.pid)}
                        className={`flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left ${k === hi ? "bg-white/10" : "hover:bg-white/5"}`}
                      >
                        <Face pid={h.pid} players={players} size={32} />
                        <span className="font-semibold">{h.name}</span>
                        <span className="ml-auto text-xs text-[var(--muted)]">{h.team}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : target ? (
            <motion.div
              initial={{ opacity: 0, y: reduce ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0 : 1.2 }}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 p-4"
              style={{ borderColor: won ? "#7fd49a" : "var(--ticket)" }}
            >
              <div>
                <p className="text-sm text-[var(--muted)]">{won ? `Cracked in ${guesses.length}` : "The suspect was"}</p>
                <p className="font-display text-3xl leading-none font-black">{target.name}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {nick(target.owner)}&apos;s guy, {target.weeks} weeks on Trash rosters
                </p>
              </div>
              <button
                type="button"
                onClick={share}
                className="font-display inline-flex h-12 cursor-pointer items-center rounded-full bg-[var(--paper)] px-6 text-xl font-black text-[var(--bin)] transition-transform duration-150 active:scale-[0.96]"
              >
                {copied ? "Copied" : "Copy my case file"}
              </button>
            </motion.div>
          ) : null}

          {/* statements */}
          <div className="mt-5">
            <div className="hidden grid-cols-[minmax(0,1.7fr)_repeat(6,minmax(0,1fr))] gap-1.5 px-1 pb-2 text-[11px] font-semibold text-[var(--muted)] md:grid">
              <span>Statement</span>
              {["Team", "Pos", "Height", "Trash weeks", "Top owner", "First season"].map((h) => (
                <span key={h} className="text-center">
                  {h}
                </span>
              ))}
            </div>
            <ol className="space-y-2">
              {[...guesses].reverse().map((pid) => {
                const g = byId.get(pid);
                if (!g || !target) return null;
                const cs = clues(g, target, nick);
                const isNew = pid === fresh;
                return (
                  <motion.li
                    key={pid}
                    layout={!reduce}
                    initial={isNew && !reduce ? { opacity: 0, y: -10 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-3 gap-1.5 rounded-2xl bg-black/20 p-1.5 md:grid-cols-[minmax(0,1.7fr)_repeat(6,minmax(0,1fr))]"
                  >
                    <div className="col-span-3 flex min-w-0 items-center gap-2 px-1 py-1 md:col-span-1">
                      <Face pid={pid} players={players} size={34} />
                      <span className="truncate text-sm font-semibold">{g.name}</span>
                    </div>
                    {cs.map((c, i) => (
                      <Chip key={c.label} c={c} i={i} fresh={isNew} />
                    ))}
                  </motion.li>
                );
              })}
            </ol>
            {!guesses.length ? (
              <p className="mt-2 rounded-2xl border border-dashed border-white/15 p-5 text-center text-sm text-[var(--muted)]">
                No statements yet. Start with someone you remember from the league.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
