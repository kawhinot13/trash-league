"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { BenchCrime, LockRow } from "@/lib/extras";
import type { Manager } from "@/lib/league";
import { Explain, Segmented } from "./intel";
import { Handle, MgrPhoto, Src } from "@/components/trash/brand";
import { LeagueName, useBrand } from "@/components/trash/brand";

const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
const n0 = (x: number) => Math.round(x).toLocaleString();
// Everyone lives between ~70% and ~90%, so the bars use that window (axis is labelled).
const LO = 0.7;
const HI = 0.9;
const w = (e: number) =>
  `${Math.max(2, Math.min(100, ((e - LO) / (HI - LO)) * 100))}%`;
const GOOD = "#7fd49a";

const Av = ({ id, s = 40 }: { id: string; s?: number }) => (
  <MgrPhoto
    id={id}
    alt=""
    width={s}
    height={s}
    className="shrink-0 rounded-full object-cover"
    style={{ width: s, height: s }}
  />
);

type Tab = "board" | "seasons" | "crimes";

export function LockInIndex({
  rows,
  crimes,
  bySeason,
  managers,
}: {
  rows: LockRow[];
  crimes: BenchCrime[];
  bySeason: { code: string; years: string; eff: number; live: boolean }[];
  managers: Manager[];
}) {
  const [tab, setTab] = useState<Tab>("board");
  const reduce = useReducedMotion();
  const brand = useBrand();
  const nick = (id: string) => managers.find((m) => m.id === id)?.nick ?? id;
  const regulars = rows.filter((r) => r.seasons.length > 1);
  const worst = regulars.slice(-3).map((r) => r.id);
  const best = regulars.slice(0, 3).map((r) => r.id);
  const totalLeft = rows.reduce((t, r) => t + (r.opt - r.act), 0);

  return (
    <div className="rounded-[28px] border border-white/10 bg-[rgba(16,40,30,0.55)] p-5 md:p-10">
      <div className="grid gap-8 md:grid-cols-[1.1fr_1fr] md:items-end">
        <div>
          <p className="font-display text-[clamp(3.2rem,9vw,6.5rem)] leading-[0.85] font-black tabular-nums">
            {n0(totalLeft)}
          </p>
          <p className="mt-3 max-w-[40ch] text-[var(--muted)]">
            {!brand.lineup
              ? "fantasy points the league has left on its benches since 2023: great games that never got locked in."
              : brand.lineup === "lock-in"
                ? `fantasy points the league has left on its benches since ${brand.since ?? "it started"}: great games that never got locked in.`
                : `fantasy points the league has left on its benches since ${brand.since ?? "it started"}.`}
          </p>
        </div>
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="League-wide efficiency by season">
          {bySeason.map((s) => (
            <li
              key={s.code}
              className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3"
            >
              <p className="text-xs text-[var(--muted)]">
                {s.years}
                {s.live ? " so far" : ""}
              </p>
              <p className="font-display mt-1 text-2xl font-black tabular-nums md:text-3xl">
                {pct(s.eff, 0)}
              </p>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-10">
        <Segmented
          id="lockin"
          value={tab}
          onChange={setTab}
          options={[
            ["board", "Career index"],
            ["seasons", "Season by season"],
            ["crimes", "Bench crimes"],
          ]}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: reduce ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          className="mt-8"
        >
          {tab === "board" ? (
            <div>
              <div
                aria-hidden
                className="ml-[3.25rem] hidden grid-cols-[1fr_5.5rem_5.5rem] gap-4 text-xs text-[var(--muted)] sm:grid md:ml-[4.25rem]"
              >
                <div className="relative h-4">
                  {[0.7, 0.75, 0.8, 0.85, 0.9].map((t, i, a) => (
                    <span
                      key={t}
                      className={`absolute tabular-nums ${i === 0 ? "" : i === a.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
                      style={{ left: `${((t - LO) / (HI - LO)) * 100}%` }}
                    >
                      {pct(t, 0)}
                    </span>
                  ))}
                </div>
                <span className="text-right">Left / week</span>
                <span className="text-right">Perfect weeks</span>
              </div>
              <ol className="mt-2">
                {rows.map((r, i) => {
                  const bad = worst.includes(r.id);
                  const good = best.includes(r.id);
                  const color = bad ? "var(--ticket)" : good ? GOOD : "var(--paper)";
                  return (
                    <li
                      key={r.id}
                      className={`grid grid-cols-[2.25rem_1fr] items-center gap-4 border-t border-white/8 py-3 md:grid-cols-[3.25rem_1fr] ${r.seasons.length < 2 ? "opacity-55" : ""}`}
                    >
                      <span className="font-display text-right text-2xl font-black text-[var(--muted)] tabular-nums md:text-3xl">
                        {i + 1}
                      </span>
                      <div className="grid grid-cols-[auto_auto] justify-start gap-x-5 gap-y-2 sm:grid-cols-[1fr_5.5rem_5.5rem] sm:items-center sm:gap-4">
                        <div className="col-span-2 min-w-0 sm:col-span-1">
                          <div className="flex items-center gap-3">
                            <Av id={r.id} s={32} />
                            <p className="break-words font-semibold">
                              {nick(r.id)}{" "}
                              <span className="font-normal text-[var(--muted)]">
                                <Handle id={r.id} />
                              </span>
                            </p>
                            <span
                              className="font-display ml-auto text-2xl font-black tabular-nums"
                              style={{ color }}
                            >
                              {pct(r.eff)}
                            </span>
                          </div>
                          <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-white/8">
                            <motion.div
                              className="absolute inset-y-0 left-0 rounded-full"
                              style={{ background: color }}
                              initial={{ width: reduce ? w(r.eff) : "0%" }}
                              whileInView={{ width: w(r.eff) }}
                              viewport={{ once: true, margin: "-60px" }}
                              transition={{
                                duration: 0.9,
                                delay: Math.min(i * 0.04, 0.4),
                                ease: [0.23, 1, 0.32, 1],
                              }}
                            />
                          </div>
                          {bad ? (
                            <p className="mt-1.5 text-xs font-semibold text-[var(--ticket)]">
                              Bench crimes: worst week left{" "}
                              {n0(r.worst.opt - r.worst.act)} points sitting
                            </p>
                          ) : null}
                          {r.seasons.length < 2 ? (
                            <p className="mt-1.5 text-xs text-[var(--muted)]">
                              One season only, not ranked for honours
                            </p>
                          ) : null}
                        </div>
                        <p className="flex gap-1.5 text-sm sm:block sm:text-right">
                          <span className="whitespace-nowrap text-[var(--muted)] sm:hidden">
                            Left per week
                          </span>
                          <span className="font-semibold tabular-nums">
                            {n0(r.left)}
                          </span>
                        </p>
                        <p className="flex gap-1.5 text-sm sm:block sm:text-right">
                          <span className="whitespace-nowrap text-[var(--muted)] sm:hidden">
                            Perfect weeks
                          </span>
                          <span className="font-semibold tabular-nums">
                            {r.perfect}
                            <span className="text-[var(--muted)]">
                              /{r.weeks}
                            </span>
                          </span>
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : null}

          {tab === "seasons" ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="text-[var(--muted)]">
                  <tr>
                    <th className="py-2 font-medium">Manager</th>
                    {bySeason.map((s) => (
                      <th key={s.code} className="py-2 text-right font-medium">
                        {s.years}
                        {s.live ? "*" : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-white/8">
                      <td className="py-2">
                        <span className="flex items-center gap-2">
                          <Av id={r.id} s={26} />
                          <span className="font-semibold">{nick(r.id)}</span>
                        </span>
                      </td>
                      {bySeason.map((s) => {
                        const x = r.seasons.find((y) => y.code === s.code);
                        if (!x)
                          return (
                            <td key={s.code} className="py-2 text-right text-[var(--muted)]">
                              –
                            </td>
                          );
                        const d = x.eff - s.eff;
                        return (
                          <td key={s.code} className="py-1.5 text-right">
                            <span
                              className="inline-block min-w-[4.5rem] rounded-lg px-2 py-1 font-semibold tabular-nums"
                              style={{
                                background:
                                  d >= 0
                                    ? `rgba(127,212,154,${Math.min(0.55, d * 6)})`
                                    : `rgba(214,52,44,${Math.min(0.6, -d * 6)})`,
                              }}
                              title={`${pct(d, 1)} vs league that season`}
                            >
                              {pct(x.eff)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-[var(--muted)]">
                Green beat the league that season, red trailed it.
                {bySeason.some((s) => s.live) ? " * Season 4 in progress." : ""}
              </p>
            </div>
          ) : null}

          {tab === "crimes" ? (
            <ol className="grid gap-3 md:grid-cols-2">
              {crimes.map((c, i) => (
                <li
                  key={`${c.id}${c.code}${c.week}`}
                  className="relative overflow-hidden rounded-2xl border border-[var(--ticket)]/35 bg-black/25 p-4"
                >
                  <div className="flex items-center gap-3">
                    <Av id={c.id} s={40} />
                    <div className="min-w-0">
                      <p className="break-words font-semibold">{nick(c.id)}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {c.years}, week {c.week}
                      </p>
                    </div>
                    <span className="ml-auto rounded-md bg-[var(--ticket)] px-2 py-1 text-xs font-bold text-white">
                      Exhibit {i + 1}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed">
                    Scored{" "}
                    <span className="font-semibold tabular-nums">{n0(c.act)}</span>{" "}
                    with{" "}
                    <span className="font-semibold tabular-nums">{n0(c.opt)}</span>{" "}
                    available on the roster.
                  </p>
                  <p className="font-display mt-1 text-3xl font-black text-[var(--ticket)] tabular-nums">
                    −{n0(c.opt - c.act)}
                  </p>
                </li>
              ))}
            </ol>
          ) : null}
        </motion.div>
      </AnimatePresence>

      <Explain>
        {!brand.lineup ? (
          <>
        <p>
          In <LeagueName /> each of the nine starting spots counts one game a week: the
          last game its player played while in the lineup. Lock in a 70-point
          night by benching the player for the rest of the week, or gamble that
          he&apos;ll do better.
        </p>
        <p>
          Efficiency is the points a manager actually scored divided by the best
          lineup that was possible in hindsight: every starting spot filled
          with the best single game from a player eligible for it, counting
          only games played while that player was on the roster. Nobody can hit
          100% without knowing the future; the point is who gets closest.
        </p>
        <p>
          Regular-season weeks only. Built from <Src />&apos;s lineups and
          per-game box scores, which explain every slot score we checked.
        </p>
          </>
        ) : (
          <>
            <p>
              {brand.lineup === "lock-in"
                ? "In this league each starting spot counts one game a week: the last game its player played while in the lineup. Lock in a big night by benching the player for the rest of the week, or gamble that he'll do better."
                : brand.lineup === "daily"
                  ? "In this league lineups are set every game day, and every game a starter plays counts."
                  : "Each week every starting spot counts its player's game that week."}
            </p>
            <p>
              {brand.lineup === "lock-in"
                ? "Efficiency is the points a manager actually scored divided by the best lineup that was possible in hindsight: every starting spot filled with the best single game from a player eligible for it, counting only games played while that player was on the roster."
                : brand.lineup === "daily"
                  ? "Efficiency is the points a manager actually scored divided by the best lineups that were possible in hindsight: the best legal lineup on every game day, from players on the roster that day."
                  : "Efficiency is the points a manager actually scored divided by the best lineup that was possible in hindsight from that week's roster."}{" "}
              Nobody can hit 100% without knowing the future; the point is who gets closest.
            </p>
            <p>
              {brand.sport === "nfl"
                ? `Regular-season weeks only. Built from ${brand.source ?? "Sleeper"}'s weekly lineups and player scores.`
                : `Regular-season weeks only. Built from ${brand.source ?? "Sleeper"}'s lineups and per-game box scores.`}
            </p>
          </>
        )}
      </Explain>
    </div>
  );
}
