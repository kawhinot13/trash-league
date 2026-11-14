"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { Guy, GuysRow, Players } from "@/lib/extras";
import type { Manager } from "@/lib/league";
import { Explain } from "./intel";
import { Face, pname } from "./player";

const n0 = (x: number) => Math.round(x).toLocaleString();
const yrs: Record<string, string> = { s1: "’23", s2: "’24", s3: "’25", s4: "’26" };

function List({
  title,
  guys,
  metric,
  players,
}: {
  title: string;
  guys: Guy[];
  metric: "weeks" | "pts";
  players: Players;
}) {
  const reduce = useReducedMotion();
  const max = Math.max(...guys.map((g) => g[metric]));
  return (
    <section>
      <h3 className="font-display text-2xl font-black">{title}</h3>
      <ol className="mt-3 space-y-2">
        {guys.map((g, i) => (
          <li key={g.pid} className="flex items-center gap-3">
            <Face pid={g.pid} players={players} size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-semibold">{pname(players, g.pid)}</p>
                <p className="shrink-0 text-sm tabular-nums">
                  {metric === "weeks" ? `${g.weeks} wks` : `${n0(g.pts)} pts`}
                </p>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-white/8">
                <motion.div
                  className="h-full rounded-full bg-[var(--paper)]"
                  initial={{ width: reduce ? `${(g[metric] / max) * 100}%` : "0%" }}
                  animate={{ width: `${(g[metric] / max) * 100}%` }}
                  transition={{ duration: 0.6, delay: i * 0.04, ease: [0.23, 1, 0.32, 1] }}
                />
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {g.starts} starts, seasons {g.seasons.map((s) => yrs[s]).join(" ")}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function MyGuys({
  rows,
  players,
  managers,
}: {
  rows: GuysRow[];
  players: Players;
  managers: Manager[];
}) {
  const [who, setWho] = useState("jgood432");
  const reduce = useReducedMotion();
  const row = rows.find((r) => r.id === who) ?? rows[0];
  const m = managers.find((x) => x.id === row.id)!;
  // "Their guy": owned the longest among the top scorers, so it's loyalty and production at once.
  const guy = [...row.best].sort((a, b) => b.weeks * b.pts - a.weeks * a.pts)[0];

  return (
    <div className="rounded-[28px] border border-white/10 bg-[rgba(16,40,30,0.55)] p-5 md:p-10">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Pick a manager">
        {rows.map((r) => {
          const on = r.id === row.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setWho(r.id)}
              aria-pressed={on}
              aria-label={managers.find((x) => x.id === r.id)?.nick ?? r.id}
              className={`relative size-11 cursor-pointer rounded-full transition-[transform,opacity] duration-200 ${on ? "scale-110" : "opacity-55 hover:opacity-100"}`}
            >
              <Image src={`/avatars/${r.id}.jpg`} alt="" width={44} height={44} className="size-11 rounded-full object-cover" />
              {on ? (
                <motion.span layoutId="guys-ring" className="absolute -inset-1 rounded-full ring-2 ring-[var(--paper)]" />
              ) : null}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={row.id}
          initial={{ opacity: 0, y: reduce ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        >
          <div
            className="relative mt-8 overflow-hidden rounded-3xl p-6 md:p-8"
            style={{ background: `linear-gradient(120deg, ${m.color}cc, rgba(0,0,0,0.35))` }}
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <Face pid={guy.pid} players={players} size={112} />
              <div>
                <p className="text-sm text-[var(--paper)]/80">{m.nick}&apos;s guy</p>
                <p className="font-display text-[clamp(2.4rem,6vw,4.2rem)] leading-[0.9] font-black">
                  {pname(players, guy.pid)}
                </p>
                <p className="mt-2 text-[var(--paper)]/85">
                  {guy.weeks} weeks on the roster, {n0(guy.pts)} points locked in across {guy.seasons.length} season
                  {guy.seasons.length > 1 ? "s" : ""}.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <List title="Owned the most" guys={row.most} metric="weeks" players={players} />
            <List title="Did the most for them" guys={row.best} metric="pts" players={players} />
          </div>
        </motion.div>
      </AnimatePresence>

      <Explain>
        <p>
          Weeks count every week a player sat on that manager&apos;s roster, playoffs included, across all four seasons.
          Points are only what the player scored while in that manager&apos;s starting lineup, so a guy riding the bench
          gets nothing.
        </p>
        <p>&ldquo;Their guy&rdquo; balances both: the top scorer they also held the longest.</p>
      </Explain>
    </div>
  );
}
