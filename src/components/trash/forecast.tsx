"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ForecastRow, TitleLine } from "@/lib/core/forecast";
import { Explain } from "./intel";
import { MgrLink, MgrPhoto } from "@/components/trash/brand";

const TIER: Record<ForecastRow["tier"], string> = {
  "Title favorite": "var(--gold)",
  Contender: "#7fd49a",
  "Dark horse": "#9fc3ff",
  "Playoff team": "var(--paper)",
  "Long shot": "#ff8a7a",
};
const pct = (x: number) => (x >= 0.995 ? ">99%" : x > 0 && x < 0.005 ? "<1%" : `${Math.round(x * 100)}%`);
/** The index strip runs from LO to HI (100 = league average). */
const LO = 80;
const HI = 125;
const at = (x: number) => `${Math.max(0, Math.min(100, ((x - LO) / (HI - LO)) * 100))}%`;

export type ForecastProps = {
  rows: (ForecastRow & { nick: string })[];
  line: Omit<TitleLine, "champs"> & { champs: (TitleLine["champs"][number] & { nick: string })[] };
  weeksLeft: number;
  runs: number;
  playoffTeams: number;
  recentWeeks: number;
};

/** The Forecast: the title line from this league's champions, and every team's chances, played out. */
export function Forecast({ rows, line, weeksLeft, runs, playoffTeams, recentWeeks }: ForecastProps) {
  const reduce = useReducedMotion();
  const clearing = rows.filter((r) => r.clears).length;
  return (
    <div className="space-y-5 md:space-y-6">
      {line.line !== null ? (
        <div className="relative overflow-hidden rounded-[24px] border border-[var(--gold)]/25 bg-[radial-gradient(110%_90%_at_90%_0%,rgba(212,175,95,0.16),transparent_60%),rgba(16,40,30,0.55)] p-5 md:rounded-[28px] md:p-8">
          <p className="text-xs font-semibold tracking-[0.2em] text-[var(--gold)] uppercase">The title line</p>
          <div className="mt-2 flex flex-wrap items-end gap-x-5 gap-y-2">
            <p className="font-display text-6xl leading-none font-black tabular-nums md:text-7xl">{(Math.floor(line.line * 10) / 10).toFixed(1)}</p>
            <p className="max-w-xl pb-1 text-sm text-[var(--paper)]/85 md:text-base">
              Every champion here scored at least {(Math.floor(line.line * 10) / 10).toFixed(1)}% of the league&apos;s average points a week (official). Nobody has won
              below it. {clearing === 1 ? "1 team is" : `${clearing} teams are`} projected to clear it this season.
            </p>
          </div>
          <ul className="mt-5 flex flex-wrap gap-2">
            {line.champs.map((c) => (
              <li key={c.code} className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs sm:text-sm">
                <span className="text-[var(--muted)]">{c.years}</span> <span className="font-semibold">{c.nick}</span>{" "}
                <span className="text-[var(--gold)] tabular-nums">{Math.round(c.scoring)}</span>
                <span className="text-[var(--muted)]"> · {c.seed}-seed</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-[24px] border border-white/10 bg-[rgba(16,40,30,0.55)] p-3 sm:p-5 md:rounded-[28px] md:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="font-display text-3xl font-black md:text-4xl">Title chances</p>
          <p className="text-xs text-[var(--muted)]">
            {weeksLeft ? `${weeksLeft} regular-season ${weeksLeft === 1 ? "week" : "weeks"} left` : "Regular season done"} · top {playoffTeams} make it · played out{" "}
            {runs.toLocaleString()} times
          </p>
        </div>
        <ol className="mt-4 space-y-2 md:mt-6 md:space-y-2.5">
          {rows.map((r, i) => (
            <motion.li
              key={r.id}
              initial={reduce ? false : { y: 12 }}
              whileInView={{ y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.35), ease: [0.23, 1, 0.32, 1] }}
              className={`grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 rounded-2xl border p-3 sm:p-4 md:grid-cols-[minmax(0,1fr)_16rem_6rem] md:items-center md:gap-x-6 ${i === 0 ? "border-[var(--gold)]/35 bg-[rgba(212,175,95,0.06)]" : "border-white/8 bg-black/20"}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <MgrPhoto id={r.id} alt="" width={40} height={40} className="size-9 shrink-0 rounded-full object-cover sm:size-10" />
                <div className="min-w-0">
                  <MgrLink id={r.id} className="block text-base font-semibold break-words hover:underline sm:text-lg">
                    {r.nick}
                  </MgrLink>
                  <p className="text-xs break-words text-[var(--muted)]">
                    <span className="font-bold" style={{ color: TIER[r.tier] }}>
                      {r.tier}
                    </span>{" "}
                    · proj. {r.record} · playoffs {pct(r.playoffs)}
                    {r.bye > 0.005 ? ` · bye ${pct(r.bye)}` : ""}
                  </p>
                </div>
              </div>
              <p className="text-right md:order-last">
                <span className="font-display block text-3xl leading-none font-black tabular-nums md:text-4xl">{pct(r.title)}</span>
                <span className="text-[11px] text-[var(--muted)]">title</span>
              </p>
              <div className="col-span-2 md:col-span-1">
                <div className="relative h-2.5 rounded-full bg-white/8" aria-label={`Projected at ${Math.round(r.index)}% of the league average`}>
                  <span className="absolute top-0 bottom-0 w-px bg-white/30" style={{ left: at(100) }} aria-hidden />
                  {line.line !== null ? (
                    <span className="absolute -top-1 -bottom-1 w-0.5 rounded bg-[var(--gold)]" style={{ left: at(line.line) }} aria-hidden />
                  ) : null}
                  <motion.span
                    className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--bin)]"
                    style={{ background: r.clears ? "#7fd49a" : "var(--paper)" }}
                    initial={{ left: reduce ? at(r.index) : at(100) }}
                    animate={{ left: at(r.index) }}
                    transition={{ duration: 0.8, delay: 0.15, ease: [0.23, 1, 0.32, 1] }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-[var(--muted)] tabular-nums">
                  Projected {Math.round(r.index)} · lineup {Math.round(r.lineup)}
                  {r.scoring !== null ? ` · scoring ${Math.round(r.scoring)}` : ""}
                  {r.form !== null ? ` · last ${recentWeeks} ${Math.round(r.form)}` : ""}
                </p>
              </div>
            </motion.li>
          ))}
        </ol>
        <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--muted)]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-0.5 rounded bg-[var(--gold)]" aria-hidden /> Title line
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-px bg-white/30" aria-hidden /> League average (100)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full bg-[#7fd49a]" aria-hidden /> Clears the line
          </span>
        </p>
        <Explain>
          <p>
            Every number is an index of the league average (100). <b>Lineup</b> is each team&apos;s best healthy lineup today
            from live rosters (injured players count for what they&apos;re expected to give the rest of the season).{" "}
            <b>Scoring</b> is official points for per week this season, and <b>last {recentWeeks || 3}</b> is the exact weekly
            scores of the latest weeks when they&apos;re proven. A team&apos;s projection blends results and roster: results
            count more each week (after 5 games they count as much as the roster).
          </p>
          <p>
            The rest of the regular season (Sleeper&apos;s schedule) and the playoffs (top {playoffTeams}, seeded by record
            then points) are played out {runs.toLocaleString()} times, with each week&apos;s scores drawn around every
            projection and spread as much as this league&apos;s weeks really swing (from its weekly scores, per Sleeper).
            The title line is the lowest official scoring index any champion here has had.
            {line.lineupLine !== null
              ? ` Their best possible lineups (per Sleeper) ran at least ${Math.round(line.lineupLine)}% of average too.`
              : ""}{" "}
            It&apos;s a model, not a promise: trades, injuries and luck move it every week.
          </p>
        </Explain>
      </div>
    </div>
  );
}
