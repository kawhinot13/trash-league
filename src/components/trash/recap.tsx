"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { Players, RecapWeek } from "@/lib/extras";
import type { Manager } from "@/lib/league";
import { Segmented } from "./intel";
import { Face, pname } from "./player";
import { MgrPhoto } from "@/components/trash/brand";

const n1 = (x: number) => (Math.round(x * 10) / 10).toLocaleString();

function Card({
  label,
  tone,
  children,
  i,
}: {
  label: string;
  tone: string;
  children: React.ReactNode;
  i: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 14, rotate: i % 2 ? 1 : -1 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.4, delay: i * 0.05, ease: [0.23, 1, 0.32, 1] }}
      className="rounded-2xl border border-white/10 bg-black/25 p-4"
    >
      <p className="text-xs font-bold" style={{ color: tone }}>
        {label}
      </p>
      <div className="mt-2">{children}</div>
    </motion.li>
  );
}

const Av = ({ id }: { id: string }) => (
  <MgrPhoto id={id} alt="" width={36} height={36} className="size-9 shrink-0 rounded-full object-cover" />
);

export function WeeklyRecap({
  weeks,
  years,
  players,
  managers,
}: {
  weeks: RecapWeek[];
  years: string;
  players: Players;
  managers: Manager[];
}) {
  const [wk, setWk] = useState(weeks[0]?.week ?? 1);
  const nick = (id: string) => managers.find((m) => m.id === id)?.nick ?? id;
  const r = weeks.find((w) => w.week === wk);
  if (!weeks.length || !r)
    return <p className="text-[var(--muted)]">The first recap lands after week 1 of {years} wraps up.</p>;
  let i = 0;
  return (
    <div className="rounded-[28px] border border-white/10 bg-[rgba(16,40,30,0.55)] p-5 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-display text-4xl font-black">Week {r.week}</p>
        <Segmented
          id="recap-week"
          value={String(wk)}
          onChange={(v) => setWk(Number(v))}
          options={weeks.map((w) => [String(w.week), `Week ${w.week}`] as [string, string])}
        />
      </div>
      <AnimatePresence mode="wait">
        <motion.ul key={wk} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {r.results?.length ? (
            <li className="rounded-2xl border border-white/10 bg-black/25 p-4 sm:col-span-2 lg:col-span-4">
              <p className="text-xs font-bold text-[var(--paper)]">Results</p>
              <ul className="mt-2 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {r.results.map((g) => (
                  <li key={g.w + g.l} className="flex items-center gap-2">
                    <Av id={g.w} />
                    <span>
                      <span className="font-semibold">{nick(g.w)}</span> <span className="text-[var(--muted)]">beat</span> {nick(g.l)}
                    </span>
                  </li>
                ))}
              </ul>
              {!r.exact ? (
                <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
                  Team scores aren&apos;t shown for this week. Sleeper&apos;s data feed reports them inconsistently for
                  daily-lineup leagues, so the only exact source is the official season points total, which the site
                  started saving after week 3. Every week from 4 on gets exact scores.
                </p>
              ) : null}
            </li>
          ) : null}
          {r.blowout ? (
            <Card label="Blowout of the week" tone="var(--ticket)" i={i++}>
              <div className="flex items-center gap-2">
                <Av id={r.blowout.w} />
                <p className="text-sm">
                  <span className="font-semibold">{nick(r.blowout.w)}</span> buried {nick(r.blowout.l)}
                </p>
              </div>
              <p className="font-display mt-2 text-3xl font-black tabular-nums">
                {n1(r.blowout.ws)}–{n1(r.blowout.ls)}
              </p>
            </Card>
          ) : null}
          {r.close ? (
            <Card label="Nail-biter" tone="var(--wood)" i={i++}>
              <div className="flex items-center gap-2">
                <Av id={r.close.w} />
                <p className="text-sm">
                  <span className="font-semibold">{nick(r.close.w)}</span> edged {nick(r.close.l)}
                </p>
              </div>
              <p className="font-display mt-2 text-3xl font-black tabular-nums">by {n1(r.close.ws - r.close.ls)}</p>
            </Card>
          ) : null}
          {r.high ? (
            <Card label="Top score" tone="#7fd49a" i={i++}>
              <div className="flex items-center gap-2">
                <Av id={r.high.id} />
                <p className="font-semibold">{nick(r.high.id)}</p>
              </div>
              <p className="font-display mt-2 text-3xl font-black tabular-nums">{n1(r.high.pts)}</p>
            </Card>
          ) : null}
          {r.low ? (
            <Card label="The basement" tone="var(--muted)" i={i++}>
              <div className="flex items-center gap-2">
                <Av id={r.low.id} />
                <p className="font-semibold">{nick(r.low.id)}</p>
              </div>
              <p className="font-display mt-2 text-3xl font-black tabular-nums">{n1(r.low.pts)}</p>
            </Card>
          ) : null}
          {r.crime ? (
            <Card label="Bench crime" tone="var(--ticket)" i={i++}>
              <div className="flex items-center gap-2">
                <Av id={r.crime.id} />
                <p className="text-sm">
                  <span className="font-semibold">{nick(r.crime.id)}</span> scored {n1(r.crime.act)} with {n1(r.crime.opt)} available
                </p>
              </div>
              <p className="font-display mt-2 text-3xl font-black text-[var(--ticket)] tabular-nums">−{n1(r.crime.opt - r.crime.act)}</p>
            </Card>
          ) : null}
          {r.locked ? (
            <Card label="Most locked in" tone="#7fd49a" i={i++}>
              <div className="flex items-center gap-2">
                <Av id={r.locked.id} />
                <p className="text-sm">
                  <span className="font-semibold">{nick(r.locked.id)}</span> played the best possible lineup, nearly
                </p>
              </div>
              <p className="font-display mt-2 text-3xl font-black tabular-nums">{((r.locked.act / r.locked.opt) * 100).toFixed(1)}%</p>
            </Card>
          ) : null}
          {r.top[0] ? (
            <Card label="Performance of the week" tone="var(--paper)" i={i++}>
              <div className="flex items-center gap-2">
                <Face pid={r.top[0].pid} players={players} size={36} />
                <p className="text-sm">
                  <span className="font-semibold">{pname(players, r.top[0].pid)}</span> for {nick(r.top[0].id)}
                </p>
              </div>
              <p className="font-display mt-2 text-3xl font-black tabular-nums">{n1(r.top[0].pts)}</p>
              {r.top.length > 1 ? (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Then {r.top
                    .slice(1)
                    .map((t) => `${pname(players, t.pid)} ${n1(t.pts)}`)
                    .join(", ")}
                </p>
              ) : null}
            </Card>
          ) : null}
          {r.steal ? (
            <Card label="Waiver steal" tone="var(--wood)" i={i++}>
              <div className="flex items-center gap-2">
                <Face pid={r.steal.pid} players={players} size={36} />
                <p className="text-sm">
                  <span className="font-semibold">{pname(players, r.steal.pid)}</span>, picked up by {nick(r.steal.id)}
                </p>
              </div>
              <p className="font-display mt-2 text-3xl font-black tabular-nums">{n1(r.steal.pts)}</p>
            </Card>
          ) : null}
        </motion.ul>
      </AnimatePresence>
      <p className="mt-4 text-xs text-[var(--muted)]">
        Results and team scores come from Sleeper&apos;s official records and season points totals. Player performances come from NBA box scores.
      </p>
    </div>
  );
}
