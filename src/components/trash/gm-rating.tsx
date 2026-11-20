"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { GM_SKILLS, GM_WEIGHTS, type GmRow, type GmSkill } from "@/lib/core/gm-rating";
import type { Manager } from "@/lib/core/types";
import { Explain } from "./intel";
import { MgrPhoto, useBrand } from "@/components/trash/brand";

const n0 = (x: number) => Math.round(x).toLocaleString();
const COLOR: Record<GmSkill, string> = { draft: "#c98a4b", waivers: "#7fd49a", trades: "#9fc3ff", lineups: "#f6f3ea", results: "var(--gold)" };

/** GM rating: every active manager's all-time grade from draft, waivers, trades, lineups and results. */
export function GmRatings({ rows, people }: { rows: GmRow[]; people: Manager[] }) {
  const reduce = useReducedMotion();
  const lockin = (useBrand().lineup ?? "lock-in") === "lock-in";
  const [open, setOpen] = useState<string | null>(null);
  const nick = (id: string) => people.find((m) => m.id === id)?.nick ?? id;
  const LABEL: Record<GmSkill, string> = { draft: "Draft", waivers: "Waivers", trades: "Trades", lineups: lockin ? "Lock-ins" : "Lineups", results: "Results" };
  const TITLE: Record<GmSkill, string> = {
    draft: "Draft savant",
    waivers: "Waiver hawk",
    trades: "Trade shark",
    lineups: lockin ? "Lock-in sniper" : "Lineup sniper",
    results: "Proven winner",
  };
  const avgDraft = rows.reduce((t, r) => t + r.raw.draft, 0) / Math.max(1, rows.length);
  const fact = (r: GmRow, k: GmSkill) => {
    if (k === "draft") {
      const d = r.raw.draft - avgDraft;
      return `Early picks finish ${Math.abs(d).toFixed(1)} spots ${d >= 0 ? "better" : "worse"} than the league's`;
    }
    if (k === "waivers") return `Pickups score ${n0(r.raw.waivers)} a season in their lineup`;
    if (k === "trades") return `${r.raw.trades >= 0 ? "+" : "−"}${n0(Math.abs(r.raw.trades))} a season from trades, per Sleeper`;
    if (k === "lineups") return `${(r.raw.lineups * 100).toFixed(1)}% of their best possible lineup, per Sleeper`;
    return `${(r.raw.win * 100).toFixed(1)}% wins · ${r.raw.titles ? `${r.raw.titles} title${r.raw.titles > 1 ? "s" : ""}` : "no titles yet"}`;
  };
  return (
    <div className="rounded-[24px] border border-white/10 bg-[rgba(16,40,30,0.55)] p-3 sm:p-5 md:rounded-[28px] md:p-8">
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[var(--muted)]">
        {GM_SKILLS.map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: COLOR[k] }} aria-hidden />
            {LABEL[k]} {Math.round(GM_WEIGHTS[k] * 100)}%
          </span>
        ))}
      </div>
      <ol className="mt-4 space-y-2 md:mt-6 md:space-y-2.5">
        {rows.map((r, i) => {
          const isOpen = open === r.id;
          return (
            <motion.li
              key={r.id}
              initial={reduce ? false : { y: 12 }}
              whileInView={{ y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.35), ease: [0.23, 1, 0.32, 1] }}
              className={`rounded-2xl border ${i === 0 ? "border-[var(--gold)]/35 bg-[rgba(212,175,95,0.06)]" : "border-white/8 bg-black/20"}`}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : r.id)}
                className="grid w-full cursor-pointer grid-cols-[2rem_1fr_auto] items-center gap-x-3 gap-y-2 rounded-2xl p-3 text-left transition-colors duration-150 hover:bg-white/[0.03] sm:grid-cols-[2.5rem_1fr_auto] sm:p-4 md:grid-cols-[3rem_minmax(0,1fr)_18rem_5rem]"
              >
                <span className="font-display text-3xl leading-none font-black tabular-nums sm:text-4xl">{r.rank}</span>
                <span className="flex min-w-0 items-center gap-3">
                  <MgrPhoto id={r.id} alt="" width={40} height={40} className="size-9 shrink-0 rounded-full object-cover sm:size-10" />
                  <span className="min-w-0">
                    <span className="block text-base font-semibold break-words sm:text-lg">{nick(r.id)}</span>
                    <span className="block text-xs break-words text-[var(--muted)]">
                      <span className="font-bold" style={{ color: COLOR[r.best] }}>
                        {TITLE[r.best]}
                      </span>{" "}
                      · {r.seasons} season{r.seasons === 1 ? "" : "s"}
                    </span>
                  </span>
                </span>
                <span className="text-right md:order-last">
                  <span className="font-display block text-3xl leading-none font-black md:text-4xl">{r.grade}</span>
                  <span className="text-[11px] text-[var(--muted)] tabular-nums">{r.rating}</span>
                </span>
                <span className="col-span-3 grid grid-cols-5 gap-1.5 md:col-span-1" aria-label={GM_SKILLS.map((k) => `${LABEL[k]} ${r.scores[k]}`).join(", ")}>
                  {GM_SKILLS.map((k) => (
                    <span key={k} className="min-w-0">
                      <span className="block h-1.5 overflow-hidden rounded-full bg-white/8">
                        <motion.span
                          className="block h-full rounded-full"
                          style={{ background: COLOR[k] }}
                          initial={{ width: reduce ? `${r.scores[k]}%` : "0%" }}
                          whileInView={{ width: `${r.scores[k]}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.7, delay: 0.15, ease: [0.23, 1, 0.32, 1] }}
                        />
                      </span>
                      <span className="mt-1 block text-[10px] leading-tight break-words text-[var(--muted)]">
                        {LABEL[k]} <span className="tabular-nums text-[var(--paper)]/80">{r.scores[k]}</span>
                      </span>
                    </span>
                  ))}
                </span>
              </button>
              {isOpen ? (
                <ul className="grid gap-1.5 px-3 pb-3 text-sm sm:grid-cols-2 sm:px-4 sm:pb-4">
                  {GM_SKILLS.map((k) => (
                    <li key={k} className="flex items-baseline gap-2 rounded-lg bg-black/20 px-3 py-2">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: COLOR[k] }} aria-hidden />
                      <span className="min-w-0 break-words">
                        <span className="font-semibold">{LABEL[k]} {r.scores[k]}</span>
                        <span className="text-[var(--muted)]"> · {fact(r, k)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </motion.li>
          );
        })}
      </ol>
      <p className="mt-3 text-xs text-[var(--muted)]">Tap a manager for the numbers behind each skill. 50 is the league average.</p>
      <Explain>
        <p>
          Five skills, each scored against the rest of the league (50 is average): <b>Draft</b> is where a manager&apos;s
          picks in rounds 1–6 finished compared with where they were taken (finished seasons). <b>Waivers</b> is how many
          points a season their pickups (players they didn&apos;t draft or trade for) scored in their starting lineup.{" "}
          <b>Trades</b> is the trade court&apos;s net: what they got out of trades minus what the other side got.{" "}
          <b>{LABEL.lineups}</b> is how close their lineups came to the best possible each week. <b>Results</b> is the
          official win rate plus rings (a title counts 2, a final 1, a playoff trip ½) a season.
        </p>
        <p>
          The grade blends them: draft, waivers and trades 20% each, {LABEL.lineups.toLowerCase()} 15%, results 25%. Trades
          and {LABEL.lineups.toLowerCase()} come from Sleeper&apos;s weekly lineups (per Sleeper). Every season counts, this one
          included.
        </p>
      </Explain>
    </div>
  );
}
