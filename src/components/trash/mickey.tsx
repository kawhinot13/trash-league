"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import type { Players } from "@/lib/extras";
import type { Exhibit, RingRun } from "@/lib/rings";
import { Explain } from "./intel";
import { pname } from "./player";

const n0 = (x: number) => Math.round(x).toLocaleString();
const LEGIT = "#7fd49a";

/** A title ring that sprouts mouse ears in proportion to the case against it. */
function Ring({ share }: { share: number }) {
  const reduce = useReducedMotion();
  const ear = 18 + share * 30;
  return (
    <svg viewBox="0 0 200 200" className="h-auto w-40 md:w-52" aria-hidden>
      {[-1, 1].map((side) => (
        <motion.circle
          key={side}
          cx={100 + side * 58}
          cy={52}
          fill="#10141a"
          initial={{ r: reduce ? ear : 0 }}
          whileInView={{ r: ear }}
          viewport={{ once: true }}
          transition={{ type: "spring", duration: 0.9, bounce: 0.4, delay: 0.3 }}
        />
      ))}
      <circle cx="100" cy="112" r="62" fill="none" stroke="var(--gold)" strokeWidth="18" />
      <circle cx="100" cy="112" r="62" fill="none" stroke="#b8902f" strokeWidth="4" strokeDasharray="2 10" />
      <path d="M78 56 L100 34 L122 56 L100 70 Z" fill="#fbf6ec" stroke="#b8902f" strokeWidth="4" strokeLinejoin="round" />
      <text x="100" y="120" textAnchor="middle" className="font-display" fontSize="26" fontWeight="900" fill="var(--gold)">
        S3
      </text>
    </svg>
  );
}

function Tape({ run, players }: { run: RingRun; players: Players }) {
  const reduce = useReducedMotion();
  const max = Math.max(...run.games.flatMap((g) => [g.me.act, g.op.opt])) * 1.05;
  const pct = (x: number) => `${(x / max) * 100}%`;
  return (
    <ol className="grid gap-4 md:grid-cols-3">
      {run.games.map((g, i) => (
        <li key={g.week} className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="text-sm text-[var(--muted)]">
            {g.round}, week {g.week}
          </p>
          <p className="font-display mt-1 text-2xl leading-tight font-black">
            vs {g.opp} <span className="text-[var(--muted)]">#{g.oppSeed}</span>
          </p>
          <div className="mt-4 space-y-2.5 text-xs">
            {[
              { label: "Oscar31", v: g.me.act, color: "var(--gold)" },
              { label: g.opp, v: g.op.act, color: "var(--paper)" },
              { label: `${g.opp}'s best lineup`, v: g.op.opt, color: "var(--ticket)", ghost: true },
            ].map((b) => (
              <div key={b.label}>
                <div className="flex justify-between">
                  <span className={b.ghost ? "text-[var(--ticket)]" : ""}>{b.label}</span>
                  <span className="font-semibold tabular-nums">{n0(b.v)}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-white/8">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: b.ghost
                        ? "repeating-linear-gradient(135deg, var(--ticket) 0 6px, transparent 6px 10px)"
                        : b.color,
                    }}
                    initial={{ width: reduce ? pct(b.v) : "0%" }}
                    whileInView={{ width: pct(b.v) }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.1 + i * 0.12, ease: [0.23, 1, 0.32, 1] }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">
            Carried by{" "}
            {g.carry.map((c, k) => (
              <span key={c.pid}>
                <span className="text-[var(--paper)]">{pname(players, c.pid)}</span> {n0(c.pts)}
                {k < g.carry.length - 1 ? ", " : ""}
              </span>
            ))}
          </p>
        </li>
      ))}
    </ol>
  );
}

function Stamp({ ruling, delay }: { ruling: Exhibit["ruling"]; delay: number }) {
  const reduce = useReducedMotion();
  const mickey = ruling === "mickey";
  return (
    <motion.span
      className="font-display inline-block shrink-0 rounded-md border-[3px] px-2.5 py-1 text-lg leading-none font-black tracking-wide"
      style={{
        color: mickey ? "var(--ticket)" : LEGIT,
        borderColor: mickey ? "var(--ticket)" : LEGIT,
        rotate: mickey ? -7 : 5,
      }}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ type: "spring", duration: 0.45, bounce: 0.35, delay }}
    >
      {mickey ? "MICKEY" : "LEGIT"}
    </motion.span>
  );
}

export function MickeyRing({
  run,
  exhibits,
  mickey,
  players,
}: {
  run: RingRun;
  exhibits: Exhibit[];
  mickey: number;
  players: Players;
}) {
  const verdict =
    mickey >= 4
      ? { head: "Mickey Mouse ring. Case closed.", sub: "The group chat was right." }
      : mickey === 3
        ? { head: "Half Mickey.", sub: "A real ring with mouse ears on it. Both sides of the chat get to be right." }
        : { head: "Legit ring.", sub: "The group chat owes Oscar an apology." };
  return (
    <div className="rounded-[28px] border border-white/10 bg-[rgba(16,40,30,0.55)] p-5 md:p-10">
      <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
        <Ring share={mickey / exhibits.length} />
        <div>
          <div className="flex items-center gap-3">
            <Image src="/avatars/Oscar31.jpg" alt="" width={44} height={44} className="size-11 rounded-full object-cover" />
            <p className="text-[var(--muted)]">
              The People v. Oscar31, {run.years} champion
            </p>
          </div>
          <p className="font-display mt-3 max-w-[18ch] text-[clamp(2.4rem,6vw,4rem)] leading-[0.9] font-black">
            Was it a Mickey Mouse ring?
          </p>
        </div>
      </div>

      <h3 className="font-display mt-12 text-3xl font-black">The tape</h3>
      <p className="mt-1 mb-5 max-w-[60ch] text-sm text-[var(--muted)]">
        Every playoff game, per Sleeper. The striped bar is what the opponent could have scored with their best lineup that week.
      </p>
      <Tape run={run} players={players} />

      <h3 className="font-display mt-12 text-3xl font-black">The exhibits</h3>
      <ol className="mt-5 grid gap-3 md:grid-cols-2">
        {exhibits.map((e, i) => (
          <li
            key={e.title}
            className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <div>
              <p className="text-xs text-[var(--muted)]">Exhibit {String.fromCharCode(65 + i)}</p>
              <p className="font-semibold">{e.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--paper)]/80">{e.finding}</p>
            </div>
            <Stamp ruling={e.ruling} delay={0.05 * i} />
          </li>
        ))}
      </ol>

      <div className="mt-12 rounded-3xl border-2 border-[var(--gold)]/50 bg-black/30 p-6 text-center md:p-10">
        <p className="text-[var(--muted)]">
          The ruling: {mickey} of {exhibits.length} exhibits say Mickey Mouse
        </p>
        <p className="font-display mt-3 text-[clamp(2.6rem,7vw,5rem)] leading-[0.9] font-black">{verdict.head}</p>
        <p className="mx-auto mt-3 max-w-[48ch] text-[var(--paper)]/85">{verdict.sub}</p>
      </div>

      <Explain>
        <p>
          Playoff scores and lineups come from Sleeper&apos;s weekly data. For this season they match the official bracket
          in every round. &ldquo;Best lineup&rdquo; uses the Lock-In Index method: every starting spot filled with the best
          single game a player on the roster had that week.
        </p>
        <p>
          The comparison uses the 2023–24 title run. Sleeper&apos;s 2024–25 playoff scores don&apos;t match the official
          bracket, so that run is left out.
        </p>
      </Explain>
    </div>
  );
}
