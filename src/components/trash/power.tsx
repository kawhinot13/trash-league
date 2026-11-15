"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { PowerRow } from "@/lib/power";
import { Explain } from "./intel";

const PARTS: { key: keyof PowerRow["parts"]; label: string; w: number; color: string }[] = [
  { key: "record", label: "Record", w: 30, color: "#f6f3ea" },
  { key: "scoring", label: "Scoring", w: 25, color: "#c98a4b" },
  { key: "roster", label: "Roster", w: 30, color: "#7fd49a" },
  { key: "form", label: "Form", w: 15, color: "#a4b8ab" },
];
const TIER: Record<string, string> = { Contender: "#7fd49a", "In the hunt": "#f6f3ea", Fringe: "#c98a4b", Lottery: "#ff8a7a" };

function Move({ m }: { m: number }) {
  if (!m) return <span className="text-xs text-[var(--muted)]">—</span>;
  const up = m > 0;
  return (
    <span className={`text-xs font-bold tabular-nums ${up ? "text-[#7fd49a]" : "text-[#ff8a7a]"}`} aria-label={`${up ? "up" : "down"} ${Math.abs(m)}`}>
      {up ? "▲" : "▼"}
      {Math.abs(m)}
    </span>
  );
}

export function PowerRankings({ rows, week, weights }: { rows: PowerRow[]; week: number | null; weights: Record<keyof PowerRow["parts"], number> }) {
  const parts = PARTS.filter((p) => weights[p.key] > 0).map((p) => ({ ...p, w: Math.round(weights[p.key] * 100) }));
  const reduce = useReducedMotion();
  return (
    <div className="rounded-[28px] border border-white/10 bg-[rgba(16,40,30,0.55)] p-5 md:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="font-display text-4xl font-black">{week ? `Week ${week}` : "This week"}</p>
        <div className="flex flex-wrap gap-3 text-xs text-[var(--muted)]">
          {parts.map((p) => (
            <span key={p.key} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: p.color }} />
              {p.label} {p.w}%
            </span>
          ))}
        </div>
      </div>
      <ol className="mt-6 space-y-2.5">
        {rows.map((r, i) => (
          <motion.li
            key={r.id}
            initial={reduce ? false : { y: 12 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.35), ease: [0.23, 1, 0.32, 1] }}
            className={`grid grid-cols-[3rem_1fr] gap-x-4 gap-y-2 rounded-2xl border p-4 md:grid-cols-[4.5rem_1fr_15rem] md:items-center ${i === 0 ? "border-[#7fd49a]/40 bg-[rgba(127,212,154,0.07)]" : "border-white/8 bg-black/20"}`}
          >
            <div className="row-span-2 flex flex-col items-center md:row-span-1">
              <span className={`font-display leading-none font-black tabular-nums ${i < 3 ? "text-5xl md:text-6xl" : "text-4xl md:text-5xl"}`}>{r.rank}</span>
              <Move m={r.move} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <Image src={`/avatars/${r.id}.jpg`} alt="" width={40} height={40} className="size-10 shrink-0 rounded-full object-cover" />
                <div className="min-w-0">
                  <Link href={`/managers/${r.id}`} className="block truncate text-lg font-semibold hover:underline">
                    {r.nick}
                  </Link>
                  <p className="truncate text-xs text-[var(--muted)]">
                    <span className="font-bold sm:hidden" style={{ color: TIER[r.tier] }}>
                      {r.tier}
                    </span>
                    <span className="sm:hidden"> · </span>
                    {r.team}
                  </p>
                </div>
                <span className="ml-auto hidden shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold sm:inline" style={{ color: TIER[r.tier], background: "rgba(0,0,0,0.3)" }}>
                  {r.tier}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--paper)]/85">{r.blurb}</p>
            </div>
            <div className="col-start-2 md:col-start-auto">
              <div className="flex items-baseline justify-between text-xs text-[var(--muted)]">
                <span>
                  {r.record}, {r.ppw}/wk
                  {r.last !== null ? `, last ${r.last}` : ""}
                </span>
                <span className="font-display text-2xl font-black text-[var(--paper)] tabular-nums">{r.score}</span>
              </div>
              <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-white/8" aria-label={`Power score ${r.score} of 100`}>
                {parts.map((p, k) => (
                  <motion.span
                    key={p.key}
                    className="h-full"
                    style={{ background: p.color }}
                    initial={{ width: reduce ? `${r.parts[p.key] * p.w}%` : "0%" }}
                    animate={{ width: `${r.parts[p.key] * p.w}%` }}
                    transition={{ duration: 0.7, delay: 0.2 + k * 0.08, ease: [0.23, 1, 0.32, 1] }}
                    title={`${p.label}: ${Math.round(r.parts[p.key] * p.w)} of ${p.w}`}
                  />
                ))}
              </div>
              <p className="mt-1 text-[11px] text-[var(--muted)]">Roster strength {r.roster}/wk on paper</p>
            </div>
          </motion.li>
        ))}
      </ol>
      <Explain>
        <p>
          Each team gets a power score out of 100 from record, official points scored per week and roster strength
          (the best possible starting nine from the Front Office player values), plus form (last week&apos;s exact
          score vs the league average) once exact weekly scores are available. Each piece is scaled from the
          league&apos;s worst to best.
        </p>
        <p>
          Movement compares with the same formula one week earlier. Records and points are Sleeper&apos;s official
          numbers only.
        </p>
      </Explain>
    </div>
  );
}
