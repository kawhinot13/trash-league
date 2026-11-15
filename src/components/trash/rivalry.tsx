"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import type { Manager, Season } from "@/lib/league";
import { Explain } from "./intel";
import { MgrPhoto } from "@/components/trash/brand";

const yrs: Record<string, string> = {
  s1: "2023–24",
  s2: "2024–25",
  s3: "2025–26",
  s4: "2026–27",
};
const round = (r: number) =>
  ({ 1: "Quarterfinal", 2: "Semifinal", 3: "Final" })[r] ?? `Round ${r}`;

function Picker({
  managers,
  value,
  onChange,
  other,
  label,
}: {
  managers: Manager[];
  value: string;
  onChange: (v: string) => void;
  other: string;
  label: string;
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm text-[var(--muted)]">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {managers.map((m) => {
          const on = m.id === value;
          return (
            <button
              key={m.id}
              type="button"
              disabled={m.id === other}
              onClick={() => onChange(m.id)}
              aria-pressed={on}
              aria-label={m.id}
              title={m.id}
              className={`relative size-12 cursor-pointer rounded-full transition-[transform,opacity] duration-200 disabled:cursor-not-allowed disabled:opacity-25 ${on ? "scale-110" : "opacity-60 hover:scale-105 hover:opacity-100"}`}
            >
              <MgrPhoto
                id={m.id}
                alt=""
                width={48}
                height={48}
                className="size-12 rounded-full object-cover"
              />
              {on ? (
                <motion.span
                  layoutId={`ring-${label}`}
                  className="absolute -inset-1 rounded-full ring-2 ring-[var(--gold)]"
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

const Stat = ({
  label,
  x,
  y,
  fmt = (v: number) => String(v),
}: {
  label: string;
  x: number;
  y: number;
  fmt?: (v: number) => string;
}) => (
  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-white/8 py-2.5">
    <span
      className={`font-display text-right text-2xl font-black tabular-nums ${x > y ? "text-[var(--gold)]" : ""}`}
    >
      {fmt(x)}
    </span>
    <span className="w-36 text-center text-xs text-[var(--muted)]">
      {label}
    </span>
    <span
      className={`font-display text-2xl font-black tabular-nums ${y > x ? "text-[var(--gold)]" : ""}`}
    >
      {fmt(y)}
    </span>
  </div>
);

export function RivalryMachine({
  managers,
  seasons,
  h2h,
}: {
  managers: Manager[];
  seasons: Season[];
  h2h: Record<string, Record<string, number>>;
}) {
  const [a, setA] = useState("KawhiNot13");
  const [b, setB] = useState("GreenBean69420");
  const A = managers.find((m) => m.id === a)!;
  const B = managers.find((m) => m.id === b)!;
  const data = useMemo(() => {
    const aw = h2h[a]?.[b] ?? 0;
    const bw = h2h[b]?.[a] ?? 0;
    const trades = seasons.flatMap((s) =>
      s.trades
        .filter((t) => t.sides[a] && t.sides[b])
        .map((t) => ({ ...t, years: yrs[s.code] })),
    );
    const playoffs = seasons.flatMap((s) =>
      s.bracket
        .filter((g) => (g.a === a && g.b === b) || (g.a === b && g.b === a))
        .map((g) => ({ ...g, years: yrs[s.code] })),
    );
    const both = seasons
      .map((s) => ({
        s,
        ra: s.standings.find((r) => r.manager === a),
        rb: s.standings.find((r) => r.manager === b),
      }))
      .filter((x) => x.ra && x.rb);
    const finishedAhead = both.filter((x) => x.ra!.seed < x.rb!.seed).length;
    // A simple, explainable verdict: one point each for head to head, playoff meetings, titles,
    // career win rate and finishing ahead more often.
    const pw = playoffs.filter((g) => g.winner === a).length;
    const pl = playoffs.filter((g) => g.winner === b).length;
    let score = 0;
    score +=
      Math.sign(aw - bw) +
      Math.sign(pw - pl) +
      Math.sign(A.titles.length - B.titles.length);
    score +=
      Math.sign(A.pct - B.pct) +
      Math.sign(finishedAhead - (both.length - finishedAhead));
    return { aw, bw, trades, playoffs, both, finishedAhead, pw, pl, score };
  }, [a, b, A, B, h2h, seasons]);
  const leader = data.score > 0 ? A.id : data.score < 0 ? B.id : null;
  return (
    <div className="rounded-[28px] border border-white/10 bg-[rgba(16,40,30,0.55)] p-5 md:p-10">
      <div className="grid gap-6 md:grid-cols-2">
        <Picker
          managers={managers}
          value={a}
          onChange={setA}
          other={b}
          label="Manager one"
        />
        <Picker
          managers={managers}
          value={b}
          onChange={setB}
          other={a}
          label="Manager two"
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={a + b}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          <div className="mt-10 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="flex flex-col items-end text-right">
              <MgrPhoto
                id={a}
                alt=""
                width={88}
                height={88}
                className="rounded-full"
                style={{ boxShadow: `0 0 0 4px ${A.color}` }}
              />
              <p className="font-display mt-3 text-3xl leading-none font-black md:text-5xl">
                {A.nick}
              </p>
              <p className="text-sm text-[var(--muted)]">{a}</p>
            </div>
            <p className="font-display text-4xl font-black text-[var(--muted)]">
              vs
            </p>
            <div className="flex flex-col items-start">
              <MgrPhoto
                id={b}
                alt=""
                width={88}
                height={88}
                className="rounded-full"
                style={{ boxShadow: `0 0 0 4px ${B.color}` }}
              />
              <p className="font-display mt-3 text-3xl leading-none font-black md:text-5xl">
                {B.nick}
              </p>
              <p className="text-sm text-[var(--muted)]">{b}</p>
            </div>
          </div>

          <p className="font-display mx-auto mt-8 max-w-2xl text-center text-3xl leading-tight font-black md:text-4xl">
            {leader
              ? `${leader === a ? A.nick : B.nick} has the upper hand.`
              : "Dead even. Nobody blinks."}
          </p>

          <div className="mx-auto mt-6 max-w-2xl">
            <Stat label="Head to head (per Sleeper)" x={data.aw} y={data.bw} />
            <Stat label="Playoff meetings won" x={data.pw} y={data.pl} />
            <Stat label="Titles" x={A.titles.length} y={B.titles.length} />
            <Stat
              label="Career win rate"
              x={A.pct}
              y={B.pct}
              fmt={(v) => `${(v * 100).toFixed(1)}%`}
            />
            <Stat
              label="Finished ahead"
              x={data.finishedAhead}
              y={data.both.length - data.finishedAhead}
            />
            <Stat label="Trades made, career" x={A.trades} y={B.trades} />
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <section>
              <h3 className="font-display text-3xl font-black">
                Trades between them
              </h3>
              {data.trades.length ? (
                <ul className="mt-4 space-y-3">
                  {data.trades.map((t, i) => (
                    <li key={i} className="rounded-2xl bg-black/20 p-3 text-sm">
                      <p className="text-xs text-[var(--muted)]">
                        {t.years}, week {t.week}
                      </p>
                      {[a, b].map((who) => (
                        <p key={who} className="mt-1">
                          <span className="font-semibold">{who}</span> got{" "}
                          <span className="text-[var(--paper)]/85">
                            {(t.sides[who] ?? [])
                              .map((p) => p.name)
                              .join(", ") || "nothing"}
                          </span>
                        </p>
                      ))}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-[var(--muted)]">
                  They have never traded with each other.
                </p>
              )}
            </section>
            <section>
              <h3 className="font-display text-3xl font-black">
                Playoff meetings
              </h3>
              {data.playoffs.length ? (
                <ul className="mt-4 space-y-2">
                  {data.playoffs.map((g, i) => (
                    <li
                      key={i}
                      className="flex justify-between rounded-2xl bg-black/20 p-3 text-sm"
                    >
                      <span>
                        {g.years} {round(g.round)}
                      </span>
                      <span className="font-semibold text-[var(--gold)]">
                        {g.winner} won
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-[var(--muted)]">
                  They have never met in the playoffs.
                </p>
              )}
              <h3 className="font-display mt-8 text-3xl font-black">
                Season by season
              </h3>
              <ul className="mt-4 space-y-2">
                {data.both.map(({ s, ra, rb }) => (
                  <li
                    key={s.code}
                    className="grid grid-cols-[6rem_1fr_1fr] gap-2 text-sm"
                  >
                    <span className="text-[var(--muted)]">{yrs[s.code]}</span>
                    <span
                      className={
                        ra!.seed < rb!.seed
                          ? "font-semibold text-[var(--gold)]"
                          : ""
                      }
                    >
                      #{ra!.seed}, {ra!.w}–{ra!.l}
                    </span>
                    <span
                      className={
                        rb!.seed < ra!.seed
                          ? "font-semibold text-[var(--gold)]"
                          : ""
                      }
                    >
                      #{rb!.seed}, {rb!.w}–{rb!.l}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </motion.div>
      </AnimatePresence>

      <Explain>
        <p>
          The verdict scores five things one point each: head to head, playoff
          meetings, titles, career win rate and how often one finished ahead of
          the other. Most points has the upper hand.
        </p>
        <p>
          Trades, playoff results, titles and finishes come from Sleeper&apos;s
          official records. Head to head comes from Sleeper&apos;s weekly
          scores, which don&apos;t always match the official standings for this
          league.
        </p>
      </Explain>
    </div>
  );
}
