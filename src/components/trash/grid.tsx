"use client";

import confetti from "canvas-confetti";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { gsap, SplitText, useGSAP } from "@/lib/gsap";
import type { Players } from "@/lib/extras";
import { EMPTY_RARITY, GUESSES, cell, cellRarity, dayGrid, rarityToScore, type Criterion, type GridData } from "@/lib/core/grid";
import { AnswerBox } from "./dive";
import { Face, pname } from "./player";
import { Leaderboard, type Person } from "./leaderboard";
import { useBrand } from "@/components/trash/brand";

type Slot = { pid: string; pts?: number } | null;
/** Today's progress, saved after every guess; `ids` pins the day's grid so a resumed game never changes. */
type Saved = { cells: Slot[]; left: number; done?: boolean; ids?: string[] };

const todayET = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const EASE = [0.23, 1, 0.32, 1] as const;

/** What a rarity total says about the game (lower is better; 900 = nothing filled). */
export function tierOf(r: number) {
  if (r <= 60) return { name: "Unicorn", line: "Nobody in this league is naming those. Frame it.", glow: "var(--gold)" };
  if (r <= 120) return { name: "Hall of Famer", line: "Deep cuts all over the board.", glow: "var(--gold)" };
  if (r <= 200) return { name: "All-Star", line: "You went past the obvious names.", glow: "#7fd49a" };
  if (r <= 320) return { name: "Starter", line: "Solid grid. A few too many household names.", glow: "#7fd49a" };
  if (r <= 480) return { name: "Sixth man", line: "Good, not rare. Dig deeper tomorrow.", glow: "var(--paper)" };
  if (r <= 700) return { name: "End of the bench", line: "Empty squares cost 100 each.", glow: "var(--paper)" };
  return { name: "DNP", line: "Tomorrow is a new grid.", glow: "#ff8a7a" };
}
/** A square's colour by rarity: gold under 5%, green under 15%, paper above. */
const tone = (r: number) => (r < 5 ? "var(--gold)" : r < 15 ? "#7fd49a" : "var(--paper)");
const pctTxt = (r: number) => `${r < 10 ? r.toFixed(1) : Math.round(r)}%`;

/** A single pick's rarity in words. */
export function rarityName(r: number) {
  return r < 1 ? "Unicorn" : r < 5 ? "Deep cut" : r < 15 ? "Rare" : r < 30 ? "Solid" : "Popular";
}

/**
 * The moment a right answer lands, staged with GSAP over the grid: the card flips up with his photo and
 * name, his rarity counts down from 100%, the label stamps in letter by letter (SplitText) with a ring
 * burst, then the card drops toward his square and the grid comes back. Tap to skip. Reduced motion: not shown.
 */
function PickReveal({ pid, r, players, onDone }: { pid: string; r: number; players: Players; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const num = useRef<HTMLSpanElement>(null);
  const label = useRef<HTMLParagraphElement>(null);
  useGSAP(
    () => {
      const counter = { v: 100 };
      const split = SplitText.create(label.current, { type: "chars" });
      const tl = gsap.timeline({ onComplete: onDone });
      tl.fromTo("[data-veil]", { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "power1.out" })
        .fromTo("[data-card]", { rotateY: -110, scale: 0.55, opacity: 0 }, { rotateY: 0, scale: 1, opacity: 1, duration: 0.65, ease: "back.out(1.6)" }, "<0.05")
        .fromTo("[data-face]", { scale: 0.4 }, { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.5)" }, "<0.2")
        .to(counter, { v: r, duration: 1.1, ease: "expo.out", onUpdate: () => { if (num.current) num.current.textContent = `${counter.v < 10 ? counter.v.toFixed(1) : Math.round(counter.v)}%`; } }, "<0.1")
        .fromTo("[data-ring]", { scale: 0.4, opacity: 0.9 }, { scale: 2.4, opacity: 0, duration: 0.9, ease: "power2.out" }, "-=0.35")
        .from(split.chars, { yPercent: 120, opacity: 0, rotateX: -90, duration: 0.5, ease: "back.out(2.4)", stagger: 0.04 }, "<")
        .fromTo("[data-shine]", { xPercent: -140 }, { xPercent: 240, duration: 0.9, ease: "power2.inOut" }, "<")
        .to("[data-card]", { scale: 0.35, y: 60, opacity: 0, duration: 0.45, ease: "power3.in" }, "+=0.55")
        .to("[data-veil]", { opacity: 0, duration: 0.3 }, "<0.15");
      return () => split.revert();
    },
    { scope: root },
  );
  const color = tone(r);
  return (
    <div ref={root} className="absolute inset-0 z-30 flex items-center justify-center [perspective:900px]" onClick={onDone} role="status" aria-live="polite">
      <div data-veil className="absolute inset-0 rounded-xl bg-[rgba(4,12,9,0.78)]" />
      <div
        data-card
        className="relative w-[min(78%,18rem)] overflow-hidden rounded-3xl border-2 bg-[#0b1f16] bg-[radial-gradient(120%_90%_at_50%_0%,rgba(233,196,106,0.14),transparent_60%)] px-5 py-6 text-center shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
        style={{ borderColor: `color-mix(in srgb, ${color} 60%, transparent)` }}
      >
        <span data-shine aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <div className="relative mx-auto grid size-24 place-items-center">
          <span data-ring aria-hidden className="absolute inset-0 rounded-full border-4" style={{ borderColor: color }} />
          <span data-face className="block">
            <Face pid={pid} players={players} size={88} />
          </span>
        </div>
        <p className="mt-3 text-lg font-semibold break-words">{pname(players, pid)}</p>
        <p className="font-display mt-1 text-6xl leading-none font-black tabular-nums" style={{ color, textShadow: `0 0 28px color-mix(in srgb, ${color} 45%, transparent)` }}>
          <span ref={num}>100%</span>
        </p>
        <p className="mt-1 text-[11px] text-[var(--muted)]">of the league would name him</p>
        <p ref={label} className="font-display mt-3 text-2xl font-black tracking-wide uppercase [perspective:400px]" style={{ color }}>
          {rarityName(r)}
        </p>
      </div>
    </div>
  );
}

/**
 * The final number, staged with GSAP (the site's animation library): the card rises, the score counts down
 * from 900 and lands with an elastic slam, the tier name drops in letter by letter (SplitText), a gold light
 * sweeps across, then the rarest pick and the share button follow. Reduced motion: everything just shows.
 */
function FinalCard({ total, filled, tier, children }: { total: number; filled: number; tier: ReturnType<typeof tierOf>; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const num = useRef<HTMLParagraphElement>(null);
  const name = useRef<HTMLParagraphElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const counter = { v: 900 };
        const split = SplitText.create(name.current, { type: "chars" });
        const tl = gsap.timeline();
        tl.from(root.current, { y: 34, opacity: 0, duration: 0.55, ease: "power3.out" })
          .to(counter, { v: total, duration: 1.25, ease: "expo.out", onUpdate: () => { if (num.current) num.current.textContent = counter.v.toFixed(1); } }, "<0.1")
          .from(num.current, { scale: 1.7, opacity: 0, filter: "blur(10px)", duration: 1.1, ease: "elastic.out(1, 0.45)" }, "<")
          .from(split.chars, { yPercent: 130, rotateX: -85, opacity: 0, duration: 0.7, ease: "back.out(2.2)", stagger: 0.035 }, "-=0.55")
          .fromTo("[data-sweep]", { xPercent: -130 }, { xPercent: 260, duration: 1.3, ease: "power2.inOut" }, "<0.1")
          .from("[data-after]", { y: 14, opacity: 0, duration: 0.5, ease: "power3.out", stagger: 0.12 }, "-=0.9");
        return () => split.revert();
      });
    },
    { scope: root, dependencies: [total] },
  );
  return (
    <div ref={root} className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/35 p-5 text-center sm:p-7">
      <span data-sweep aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-[rgba(233,196,106,0.18)] to-transparent" />
      <p className="text-xs font-semibold tracking-[0.25em] text-[var(--muted)] uppercase">Rarity score</p>
      <p
        ref={num}
        className="font-display mt-1 text-7xl leading-none font-black tabular-nums sm:text-8xl"
        style={{ textShadow: `0 0 36px color-mix(in srgb, ${tier.glow} 45%, transparent)` }}
      >
        {total.toFixed(1)}
      </p>
      <p className="mt-1 text-xs text-[var(--muted)]">lower is better · {filled}/9 squares</p>
      <p ref={name} className="font-display mt-4 text-3xl font-black [perspective:600px] sm:text-4xl" style={{ color: tier.glow }}>
        {tier.name}
      </p>
      <p data-after className="mt-1 text-sm text-[var(--paper)]/80">
        {tier.line}
      </p>
      {children}
    </div>
  );
}

/** Starting Nine: name a player for each square (row x column). Nine guesses; rarer answers score lower (better). */
export function StartingNine({ data, players, people }: { data: GridData; players: Players; people: Person[] }) {
  const brand = useBrand();
  const reduce = useReducedMotion();
  const lockin = (brand.lineup ?? "lock-in") === "lock-in";
  const [day, setDay] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved>({ cells: Array(9).fill(null), left: GUESSES });
  const [open, setOpen] = useState<number | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [miss, setMiss] = useState<{ k: number; n: number } | null>(null);
  const [landed, setLanded] = useState<{ k: number; n: number; r: number } | null>(null);
  const [pick, setPick] = useState<{ pid: string; r: number; n: number } | null>(null);
  const [reveal, setReveal] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  // The finish show: plays once per day per browser (when you finish, or the first time you open a finished game).
  const [show, setShow] = useState<"off" | "run" | "end">("off");
  const [step, setStep] = useState(-1);
  const [count, setCount] = useState(900);
  const key = (d: string) => brand.key(`grid:${d}`);
  const shownKey = (d: string) => brand.key(`grid-shown:${d}`);

  useEffect(() => {
    const d = todayET();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDay(d);
    try {
      const v = localStorage.getItem(key(d));
      if (v) setSaved(JSON.parse(v) as Saved);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grid = useMemo(() => {
    if (!day) return null;
    // A game already started keeps its grid, whatever the data does later.
    if (saved.ids?.length === 6) {
      const byId = new Map(data.criteria.map((c) => [c.id, c]));
      const cs = saved.ids.map((id) => byId.get(id));
      if (cs.every(Boolean)) return { rows: cs.slice(0, 3) as Criterion[], cols: cs.slice(3) as Criterion[] };
    }
    return dayGrid(data, day);
  }, [data, day, saved.ids]);

  const rarities = useMemo(
    () =>
      grid
        ? saved.cells.map((s, k) => (s ? cellRarity(cell(grid.rows[Math.floor(k / 3)], grid.cols[k % 3]).gateIds, data.fame, s.pid) : null))
        : [],
    [grid, saved.cells, data.fame],
  );
  const filled = saved.cells.filter(Boolean).length;
  const total = Math.round(rarities.reduce<number>((t, r) => t + (r ?? EMPTY_RARITY), 0) * 10) / 10;
  const done = saved.done || saved.left <= 0 || filled === 9;

  // Start the show when a finished game hasn't been shown in this browser today.
  const started = useRef(false);
  useEffect(() => {
    if (!day || !done || started.current) return;
    started.current = true;
    let seen = false;
    try {
      seen = !!localStorage.getItem(shownKey(day));
      localStorage.setItem(shownKey(day), "1");
    } catch {}
    if (seen || reduce) {
      setShow("end");
      setStep(9);
      setCount(total);
      return;
    }
    setShow("run");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, done]);

  // The show: each square flips in turn and the rarity counter drops from 900 as it lands.
  useEffect(() => {
    if (show !== "run") return;
    let k = -1;
    let left = 900;
    let stop = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const next = () => {
      if (stop) return;
      k++;
      if (k >= 9) {
        timers.push(
          setTimeout(() => {
            if (stop) return;
            setShow("end");
            setCount(total);
            if (total <= 200)
              confetti({ particleCount: total <= 120 ? 160 : 90, spread: 80, startVelocity: 42, origin: { y: 0.55 }, colors: ["#e9c46a", "#7fd49a", "#f6f3ea"], disableForReducedMotion: true });
          }, 380),
        );
        return;
      }
      setStep(k);
      const r = rarities[k] ?? EMPTY_RARITY;
      const to = Math.max(0, left - (EMPTY_RARITY - r));
      animate(left, to, { duration: 0.42, ease: EASE, onUpdate: (v) => setCount(v) });
      left = to;
      timers.push(setTimeout(next, 260));
    };
    timers.push(setTimeout(next, 450));
    return () => {
      stop = true;
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  if (!day) return <div aria-busy className="min-h-[24rem] rounded-[28px] border border-white/10 bg-black/20" />;
  if (!grid) return <p className="text-[var(--muted)]">Not enough league history for a grid yet. It needs a finished season.</p>;

  const word = (label: string) =>
    lockin
      ? label
          .replace(/^Started (\d+)\+ times/, "Locked in $1+ times")
          .replace(/^Started a (.+) playoff game$/, "Locked in for a $1 playoff game")
          .replace("but never started", "but never locked in")
          .replace(" a start for", " a lock-in for")
          .replace("(5+ starts)", "(5+ lock-ins)")
      : label;
  const an = (n?: number) => (/^(8|11|18)/.test(String(n)) ? "an" : "a");
  const labelOf = (c: Criterion) =>
    c.kind === "big" ? (lockin ? `Had ${an(c.n)} ${c.n}+ lock-in for a ${data.league} team` : `Scored ${c.n}+ in a start for a ${data.league} team`) : word(c.label);
  const cellOf = (k: number) => cell(grid.rows[Math.floor(k / 3)], grid.cols[k % 3]);
  const used = new Set(saved.cells.filter(Boolean).map((x) => x!.pid));

  const store = (next: Saved) => {
    setSaved(next);
    try {
      localStorage.setItem(key(day), JSON.stringify(next));
    } catch {}
  };
  const guess = (pid: string | null, typed: string) => {
    if (open === null || done) return;
    if (!pid) return setNote({ ok: false, text: `No player called "${typed}" here. Pick one from the list.` });
    if (used.has(pid)) return setNote({ ok: false, text: `${pname(players, pid)} is already on your grid. Each player once.` });
    const c = cellOf(open);
    const ok = c.ids.includes(pid);
    const cells = [...saved.cells];
    if (ok) cells[open] = { pid };
    const left = saved.left - 1;
    const ids = saved.ids ?? [...grid.rows, ...grid.cols].map((x) => x.id);
    const fin = left <= 0 || cells.filter(Boolean).length === 9;
    store({ cells, left, ids, done: fin });
    if (ok) {
      const r = cellRarity(c.gateIds, data.fame, pid);
      setNote({ ok: true, text: `${pname(players, pid)} fits. Rarity ${pctTxt(r)}${r < 5 ? ", a deep cut." : "."}` });
      setLanded({ k: open, n: Date.now(), r });
      if (!reduce) setPick({ pid, r, n: Date.now() });
      // A deep cut gets a small burst from its square.
      if (r < 5 && !reduce) {
        const el = document.getElementById(`sq-${open}`)?.getBoundingClientRect();
        if (el)
          confetti({
            particleCount: 40, spread: 60, startVelocity: 26, scalar: 0.8, ticks: 120,
            origin: { x: (el.left + el.width / 2) / window.innerWidth, y: (el.top + el.height / 2) / window.innerHeight },
            colors: ["#e9c46a", "#f6f3ea"], disableForReducedMotion: true,
          });
      }
      setOpen(null);
    } else {
      setNote({ ok: false, text: `${pname(players, pid)} doesn't fit that square.` });
      setMiss({ k: open, n: Date.now() });
    }
  };
  const share = async () => {
    const rows = [0, 1, 2]
      .map((r) => [0, 1, 2].map((c) => { const x = rarities[r * 3 + c]; return x === null || x === undefined ? "⬛" : x < 5 ? "🟨" : x < 15 ? "🟩" : "⬜"; }).join(""))
      .join("\n");
    const text = `Starting Nine ${day}\n${filled}/9 · Rarity ${total.toFixed(1)} (${tierOf(total).name})\n${rows}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const Head = ({ c }: { c: Criterion }) => (
    <div className="flex min-h-[4.5rem] items-center justify-center rounded-xl bg-black/30 p-1.5 text-center text-[11px] leading-tight font-semibold break-words sm:p-2 sm:text-sm">
      {labelOf(c)}
    </div>
  );

  // During the show, squares not yet reached stay face down.
  const hidden = (k: number) => show === "run" && k > step;
  const rarest = rarities
    .map((r, k) => ({ r, k }))
    .filter((x): x is { r: number; k: number } => x.r !== null && x.r !== undefined)
    .sort((a, b) => a.r - b.r)[0];
  const tier = tierOf(total);

  return (
    <div className="relative rounded-[24px] border border-white/10 bg-[rgba(16,40,30,0.55)] p-3 sm:p-5 md:rounded-[28px] md:p-8">
      {/* Lights down for the reveal. */}
      <AnimatePresence>
        {show !== "off" && done ? (
          <motion.div
            key="lights"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: show === "run" ? 1 : 0.55 }}
            transition={{ duration: 0.6 }}
            className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(70%_55%_at_50%_38%,rgba(233,196,106,0.16),rgba(4,12,9,0.85)_70%)]"
          />
        ) : null}
      </AnimatePresence>

      <div className="relative flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-sm text-[var(--muted)]">
          Guesses left <span className="font-display text-2xl font-black text-[var(--paper)] tabular-nums">{Math.max(0, saved.left)}</span>
        </p>
        <p className="text-sm text-[var(--muted)]">
          {show === "run" ? (
            <>
              Rarity <span className="font-display text-2xl font-black text-[var(--paper)] tabular-nums">{count.toFixed(1)}</span>
            </>
          ) : (
            <>
              <span className="font-display text-2xl font-black text-[var(--paper)] tabular-nums">{filled}</span>/9 filled
            </>
          )}
        </p>
      </div>

      <div className="relative mt-4 grid grid-cols-[minmax(0,0.85fr)_repeat(3,minmax(0,1fr))] gap-1.5 [perspective:900px] sm:gap-2">
        {pick ? <PickReveal key={pick.n} pid={pick.pid} r={pick.r} players={players} onDone={() => setPick(null)} /> : null}
        <div className="flex items-center justify-center rounded-xl text-center">
          <span className="font-display text-3xl leading-none font-black sm:text-4xl">9</span>
        </div>
        {grid.cols.map((c) => (
          <Head key={c.id} c={c} />
        ))}
        {grid.rows.map((r, ri) => (
          <div key={r.id} className="contents">
            <Head c={r} />
            {grid.cols.map((c, ci) => {
              const k = ri * 3 + ci;
              const s = saved.cells[k];
              const rr = rarities[k];
              const isOpen = open === k;
              const shaking = miss?.k === k;
              const fresh = landed?.k === k && !!s;
              return (
                <motion.button
                  id={`sq-${k}`}
                  key={`${c.id}-${show === "run" && k <= step ? "shown" : "base"}-${shaking ? miss!.n : 0}-${fresh ? landed!.n : 0}`}
                  type="button"
                  disabled={!!s || done}
                  onClick={() => {
                    setOpen(isOpen ? null : k);
                    setNote(null);
                  }}
                  initial={
                    reduce
                      ? false
                      : fresh
                        ? { rotateY: -180, scale: 0.92 }
                        : show === "run" && k <= step
                        ? { rotateY: 90, opacity: 0.3 }
                        : shaking
                          ? { x: 0 }
                          : false
                  }
                  animate={shaking && !reduce ? { x: [0, -7, 7, -5, 5, 0] } : { rotateY: hidden(k) ? 180 : 0, opacity: 1, scale: 1 }}
                  transition={shaking ? { duration: 0.4 } : fresh ? { type: "spring", duration: 0.7, bounce: 0.3 } : { duration: 0.5, ease: EASE }}
                  aria-label={`${labelOf(r)} and ${labelOf(c)}${s && rr != null ? `: ${pname(players, s.pid)}, rarity ${pctTxt(rr)}` : ""}`}
                  className={`relative flex aspect-square flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 p-1 transition-colors duration-150 [backface-visibility:hidden] ${
                    hidden(k)
                      ? "border-white/10 bg-black/40"
                      : s
                        ? "bg-[rgba(127,212,154,0.08)]"
                        : done
                          ? "border-[#ff8a7a]/25 bg-black/30"
                          : isOpen
                            ? "border-[var(--wood)] bg-white/10"
                            : "cursor-pointer border-white/10 bg-black/25 hover:bg-white/[0.06] disabled:cursor-default"
                  }`}
                  style={s && rr != null && !hidden(k) ? { borderColor: `color-mix(in srgb, ${tone(rr)} 55%, transparent)` } : undefined}
                >
                  {shaking && !reduce ? (
                    <motion.span aria-hidden initial={{ opacity: 0.45 }} animate={{ opacity: 0 }} transition={{ duration: 0.6 }} className="pointer-events-none absolute inset-0 bg-[#ff8a7a]" />
                  ) : null}
                  {fresh && !reduce && rr != null ? (
                    <>
                      <motion.span
                        aria-hidden
                        initial={{ scale: 0.5, opacity: 0.9 }}
                        animate={{ scale: 1.8, opacity: 0 }}
                        transition={{ duration: 0.8, ease: EASE, delay: 0.15 }}
                        className="pointer-events-none absolute inset-2 rounded-full border-2"
                        style={{ borderColor: tone(rr) }}
                      />
                      <motion.span
                        aria-hidden
                        initial={{ y: 6, opacity: 0 }}
                        animate={{ y: [6, -14, -30], opacity: [0, 1, 0] }}
                        transition={{ duration: 1.3, ease: EASE, delay: 0.3, times: [0, 0.35, 1] }}
                        className="font-display pointer-events-none absolute top-1 right-1 text-base font-black tabular-nums"
                        style={{ color: tone(rr) }}
                      >
                        {pctTxt(rr)}
                      </motion.span>
                    </>
                  ) : null}
                  {hidden(k) ? null : s && rr != null ? (
                    <motion.span
                      initial={reduce ? false : { scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", duration: 0.45, bounce: 0.4 }}
                      className="flex flex-col items-center gap-0.5"
                    >
                      <Face pid={s.pid} players={players} size={40} />
                      <span className="line-clamp-2 text-center text-[10px] leading-tight font-semibold break-words sm:text-xs">{pname(players, s.pid)}</span>
                      <span className="rounded-full bg-black/40 px-1.5 text-[10px] font-black tabular-nums sm:text-xs" style={{ color: tone(rr) }}>
                        {pctTxt(rr)}
                      </span>
                      {rr < 5 && !reduce ? (
                        <motion.span
                          aria-hidden
                          initial={{ x: "-120%" }}
                          animate={{ x: "120%" }}
                          transition={{ duration: 1.1, ease: "easeInOut", delay: 0.2 }}
                          className="pointer-events-none absolute inset-y-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-[rgba(233,196,106,0.35)] to-transparent"
                        />
                      ) : null}
                    </motion.span>
                  ) : done ? (
                    <span className="font-display text-2xl font-black text-[#ff8a7a]/70">100</span>
                  ) : (
                    <span className="text-2xl text-[var(--muted)]">{isOpen ? "•" : "+"}</span>
                  )}
                </motion.button>
              );
            })}
          </div>
        ))}
      </div>

      <AnimatePresence initial={false}>
        {open !== null && !done ? (
          <motion.div key="box" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="relative mt-5">
            <p className="mb-2 text-sm text-[var(--muted)]">
              <span className="font-semibold text-[var(--paper)]">{labelOf(grid.rows[Math.floor(open / 3)])}</span> and{" "}
              <span className="font-semibold text-[var(--paper)]">{labelOf(grid.cols[open % 3])}</span>
            </p>
            <AnswerBox players={players} onPick={guess} />
          </motion.div>
        ) : null}
      </AnimatePresence>
      {note && !done ? (
        <p role="status" className={`relative mt-3 text-sm font-semibold ${note.ok ? "text-[#7fd49a]" : "text-[#ff8a7a]"}`}>
          {note.text}
        </p>
      ) : !done && open === null ? (
        <p className="relative mt-4 text-sm text-[var(--muted)]">
          Tap a square, then name a player who fits its row and its column. Lower is better: each right answer scores its rarity,
          about how many of the league would name him (a star might be 30%, a deep cut 1%). An empty square counts 100, so the
          worst grid is 900.
        </p>
      ) : null}

      {done ? (
        <div className="relative mt-6 space-y-5">
          {/* The final number. */}
          <AnimatePresence>
            {show === "end" ? (
              <FinalCard key="final" total={total} filled={filled} tier={tier}>
                {rarest ? (
                  <div data-after className="mx-auto mt-5 flex max-w-sm items-center gap-3 rounded-2xl bg-white/[0.06] p-3 text-left">
                    <Face pid={saved.cells[rarest.k]!.pid} players={players} size={44} />
                    <span className="min-w-0 text-sm">
                      <span className="block text-xs text-[var(--muted)]">Rarest pick</span>
                      <span className="font-semibold break-words">{pname(players, saved.cells[rarest.k]!.pid)}</span>{" "}
                      <span className="font-black tabular-nums" style={{ color: tone(rarest.r) }}>
                        {pctTxt(rarest.r)}
                      </span>
                    </span>
                  </div>
                ) : null}
                <div data-after>
                  <button
                    type="button"
                    onClick={share}
                    className="font-display mt-5 inline-flex h-12 cursor-pointer items-center rounded-full bg-[var(--paper)] px-6 text-xl font-black text-[var(--bin)] transition-transform duration-150 active:scale-[0.96]"
                  >
                    {copied ? "Copied" : "Copy my grid"}
                  </button>
                </div>
              </FinalCard>
            ) : (
              <p key="wait" className="text-center text-sm text-[var(--muted)]">
                Revealing your grid…
              </p>
            )}
          </AnimatePresence>
          {show === "end" ? (
            <>
              <Leaderboard game="grid2" rarity day={day} saveKeys={[`grid:${day}`]} people={people} result={{ score: rarityToScore(total), label: `${filled}/9 · ${tier.name}` }} />
              <div>
                <p className="font-display text-2xl font-black">Every square</p>
                <ul className="mt-3 grid gap-2 sm:grid-cols-3">
                  {saved.cells.map((s, k) => {
                    const c = cellOf(k);
                    const byRare = [...c.ids].sort((a, b) => (data.fame[a] ?? 0) - (data.fame[b] ?? 0));
                    const deepest = byRare[0];
                    const rr = rarities[k];
                    return (
                      <li key={k} className="rounded-2xl bg-black/20 p-3 text-sm">
                        <button type="button" onClick={() => setReveal(reveal === k ? null : k)} aria-expanded={reveal === k} className="w-full cursor-pointer text-left">
                          <span className="block text-xs text-[var(--muted)]">
                            {labelOf(grid.rows[Math.floor(k / 3)])} × {labelOf(grid.cols[k % 3])}
                          </span>
                          <span className="mt-1 block font-semibold">{s && rr != null ? `${pname(players, s.pid)} · ${pctTxt(rr)}` : "Empty · 100"}</span>
                          <span className="block text-xs text-[var(--muted)]">
                            {c.ids.length} right answers · rarest: {deepest ? `${pname(players, deepest)} ${pctTxt(cellRarity(c.gateIds, data.fame, deepest))}` : "none"}
                          </span>
                        </button>
                        {reveal === k ? (
                          <p className="mt-2 text-xs break-words text-[var(--paper)]/80">
                            {[...c.ids]
                              .sort((a, b) => (data.fame[b] ?? 0) - (data.fame[a] ?? 0))
                              .map((p) => `${pname(players, p)} ${pctTxt(cellRarity(c.gateIds, data.fame, p))}`)
                              .join(", ")}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
