"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import type { Players } from "@/lib/extras";
import { GUESSES, cell, cellPoints, dayGrid, type Criterion, type GridData } from "@/lib/core/grid";
import { AnswerBox } from "./dive";
import { Face, pname } from "./player";
import { Leaderboard, type Person } from "./leaderboard";
import { useBrand } from "@/components/trash/brand";

type Slot = { pid: string; pts: number } | null;
/** Today's progress, saved after every guess; `ids` pins the day's grid so a resumed game never changes. */
type Saved = { cells: Slot[]; left: number; done?: boolean; ids?: string[] };

const todayET = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

/** Starting Nine: name a player for each square (row x column). Nine guesses; deeper answers score more. */
export function StartingNine({ data, players, people }: { data: GridData; players: Players; people: Person[] }) {
  const brand = useBrand();
  const reduce = useReducedMotion();
  const lockin = (brand.lineup ?? "lock-in") === "lock-in";
  const [day, setDay] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved>({ cells: Array(9).fill(null), left: GUESSES });
  const [open, setOpen] = useState<number | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [reveal, setReveal] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const key = (d: string) => brand.key(`grid:${d}`);

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
  const filled = saved.cells.filter(Boolean).length;
  const total = saved.cells.reduce((t, x) => t + (x?.pts ?? 0), 0);
  const done = saved.done || saved.left <= 0 || filled === 9;

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
    if (ok) cells[open] = { pid, pts: cellPoints(c.gateIds, data.fame, pid) };
    const left = saved.left - 1;
    const ids = saved.ids ?? [...grid.rows, ...grid.cols].map((x) => x.id);
    const fin = left <= 0 || cells.filter(Boolean).length === 9;
    store({ cells, left, ids, done: fin });
    setNote(ok ? { ok: true, text: `${pname(players, pid)} fits. +${cells[open]!.pts}` } : { ok: false, text: `${pname(players, pid)} doesn't fit that square.` });
    if (ok) setOpen(null);
  };
  const share = async () => {
    const rows = [0, 1, 2].map((r) => [0, 1, 2].map((c) => (saved.cells[r * 3 + c] ? ((saved.cells[r * 3 + c]!.pts ?? 0) >= 70 ? "🟨" : "🟩") : "⬛")).join("")).join("\n");
    const text = `Starting Nine ${day}\n${filled}/9 · ${total} pts\n${rows}`;
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

  return (
    <div className="rounded-[24px] border border-white/10 bg-[rgba(16,40,30,0.55)] p-3 sm:p-5 md:rounded-[28px] md:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-sm text-[var(--muted)]">
          Guesses left <span className="font-display text-2xl font-black text-[var(--paper)] tabular-nums">{Math.max(0, saved.left)}</span>
        </p>
        <p className="text-sm text-[var(--muted)]">
          {filled}/9 · <span className="font-display text-2xl font-black text-[var(--paper)] tabular-nums">{total}</span> pts
        </p>
      </div>
      <div className="mt-4 grid grid-cols-[minmax(0,0.85fr)_repeat(3,minmax(0,1fr))] gap-1.5 sm:gap-2">
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
              const isOpen = open === k;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={!!s || done}
                  onClick={() => {
                    setOpen(isOpen ? null : k);
                    setNote(null);
                  }}
                  aria-label={`${labelOf(r)} and ${labelOf(c)}${s ? `: ${pname(players, s.pid)}, ${s.pts} points` : ""}`}
                  className={`relative flex aspect-square flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 p-1 transition-colors duration-150 ${
                    s ? "border-[#7fd49a]/50 bg-[rgba(127,212,154,0.1)]" : isOpen ? "border-[var(--wood)] bg-white/10" : "cursor-pointer border-white/10 bg-black/25 hover:bg-white/[0.06] disabled:cursor-default"
                  }`}
                >
                  {s ? (
                    <motion.span initial={reduce ? false : { scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", duration: 0.45, bounce: 0.4 }} className="flex flex-col items-center gap-0.5">
                      <Face pid={s.pid} players={players} size={40} />
                      <span className="line-clamp-2 text-center text-[10px] leading-tight font-semibold break-words sm:text-xs">{pname(players, s.pid)}</span>
                      <span className="text-[10px] font-black text-[var(--gold)] tabular-nums sm:text-xs">+{s.pts}</span>
                    </motion.span>
                  ) : (
                    <span className="text-2xl text-[var(--muted)]">{isOpen ? "•" : "+"}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <AnimatePresence initial={false}>
        {open !== null && !done ? (
          <motion.div key="box" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5">
            <p className="mb-2 text-sm text-[var(--muted)]">
              <span className="font-semibold text-[var(--paper)]">{labelOf(grid.rows[Math.floor(open / 3)])}</span> and{" "}
              <span className="font-semibold text-[var(--paper)]">{labelOf(grid.cols[open % 3])}</span>
            </p>
            <AnswerBox players={players} onPick={guess} />
          </motion.div>
        ) : null}
      </AnimatePresence>
      {note ? (
        <p role="status" className={`mt-3 text-sm font-semibold ${note.ok ? "text-[#7fd49a]" : "text-[#ff8a7a]"}`}>
          {note.text}
        </p>
      ) : !done && open === null ? (
        <p className="mt-4 text-sm text-[var(--muted)]">
          Tap a square, then name a player who fits its row and its column. Rarer answers score more: the most obvious right
          answer in a square is worth 10, the deepest 100. Obvious means rostered a lot and scored a lot in this league&apos;s
          past seasons.
        </p>
      ) : null}

      {done ? (
        <div className="mt-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-black/25 p-4">
            <div>
              <p className="text-sm text-[var(--muted)]">Final</p>
              <p className="font-display text-4xl leading-none font-black">
                {filled}/9 · {total}
              </p>
            </div>
            <button type="button" onClick={share} className="font-display inline-flex h-12 cursor-pointer items-center rounded-full bg-[var(--paper)] px-6 text-xl font-black text-[var(--bin)] transition-transform duration-150 active:scale-[0.96]">
              {copied ? "Copied" : "Copy my grid"}
            </button>
          </div>
          <Leaderboard game="grid" day={day} saveKeys={[`grid:${day}`]} people={people} result={{ score: total, label: `${filled}/9` }} />
          <div>
            <p className="font-display text-2xl font-black">Every square</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-3">
              {saved.cells.map((s, k) => {
                const c = cellOf(k);
                const deepest = [...c.ids].sort((a, b) => (data.fame[a] ?? 0) - (data.fame[b] ?? 0))[0];
                return (
                  <li key={k} className="rounded-2xl bg-black/20 p-3 text-sm">
                    <button type="button" onClick={() => setReveal(reveal === k ? null : k)} aria-expanded={reveal === k} className="w-full cursor-pointer text-left">
                      <span className="block text-xs text-[var(--muted)]">
                        {labelOf(grid.rows[Math.floor(k / 3)])} × {labelOf(grid.cols[k % 3])}
                      </span>
                      <span className="mt-1 block font-semibold">{s ? `${pname(players, s.pid)} · +${s.pts}` : "Empty"}</span>
                      <span className="block text-xs text-[var(--muted)]">
                        {c.ids.length} right answers · deepest: {deepest ? pname(players, deepest) : "none"}
                      </span>
                    </button>
                    {reveal === k ? (
                      <p className="mt-2 text-xs break-words text-[var(--paper)]/80">
                        {[...c.ids]
                          .sort((a, b) => (data.fame[b] ?? 0) - (data.fame[a] ?? 0))
                          .map((p) => pname(players, p))
                          .join(", ")}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
