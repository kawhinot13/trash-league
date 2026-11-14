"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { Players, Redraft } from "@/lib/extras";
import type { Manager } from "@/lib/league";
import { Explain, Segmented } from "./intel";
import { Face, pname } from "./player";

const n0 = (x: number) => Math.round(x).toLocaleString();

function Shift({ from, to }: { from: number; to: number }) {
  const d = from - to;
  if (d === 0)
    return <span className="text-xs text-[var(--muted)]">held the spot</span>;
  const up = d > 0;
  return (
    <span
      className={`text-xs font-bold tabular-nums ${up ? "text-[#7fd49a]" : "text-[#ff8a7a]"}`}
    >
      {up ? "▲" : "▼"} {Math.abs(d)}
    </span>
  );
}

export function RedraftBoard({
  drafts,
  players,
  managers,
}: {
  drafts: Redraft[];
  players: Players;
  managers: Manager[];
}) {
  const done = drafts.filter((d) => !d.live);
  const [code, setCode] = useState(done[done.length - 1].code);
  const reduce = useReducedMotion();
  const d = drafts.find((x) => x.code === code)!;
  const nick = (id: string) => managers.find((m) => m.id === id)?.nick ?? id;

  return (
    <div>
      <Segmented
        id="redraft"
        value={code}
        onChange={setCode}
        options={drafts.map((x) => [x.code, x.years] as [string, string])}
      />
      {d.live ? (
        <p className="mt-4 max-w-[60ch] text-sm text-[var(--gold)]">
          Season 4 is {d.weeks} week{d.weeks === 1 ? "" : "s"} old. This is an
          early read and it will move every week.
        </p>
      ) : null}

      <AnimatePresence mode="wait">
        <motion.div
          key={code}
          initial={{ opacity: 0, y: reduce ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[
              {
                label: "The steal",
                p: d.steal,
                line: `Went #${d.steal.no} to ${nick(d.steal.by)}. Re-drafted #${d.steal.redo}.`,
                tone: "#7fd49a",
              },
              {
                label: "The bust",
                p: d.bust,
                line: `Went #${d.bust.no} to ${nick(d.bust.by)}. Re-drafted #${d.bust.redo}.`,
                tone: "var(--ticket)",
              },
            ].map((c) => (
              <div
                key={c.label}
                className="flex items-center gap-4 rounded-2xl border bg-black/20 p-4"
                style={{ borderColor: c.tone }}
              >
                <Face pid={c.p.pid} players={players} size={64} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: c.tone }}>
                    {c.label}
                  </p>
                  <p className="font-display truncate text-3xl leading-none font-black">
                    {pname(players, c.p.pid)}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{c.line}</p>
                </div>
              </div>
            ))}
          </div>

          <div
            aria-hidden
            className="mt-10 hidden grid-cols-[3.5rem_1fr_1fr] gap-6 px-4 text-sm text-[var(--muted)] md:grid"
          >
            <span>Pick</span>
            <span>Who they took</span>
            <span>The re-do</span>
          </div>
          <ol className="mt-3 space-y-2">
            {d.picks.map((p, i) => {
              const same = p.took.pid === p.should.pid;
              return (
                <motion.li
                  key={p.slot}
                  initial={{ opacity: 0, x: reduce ? 0 : -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{
                    duration: 0.4,
                    delay: Math.min(i * 0.035, 0.3),
                    ease: [0.23, 1, 0.32, 1],
                  }}
                  className="grid grid-cols-[2.5rem_1fr] gap-x-4 gap-y-3 rounded-2xl border border-white/8 bg-[rgba(16,40,30,0.55)] p-4 md:grid-cols-[3.5rem_1fr_1fr] md:items-center md:gap-6"
                >
                  <span className="font-display row-span-2 text-4xl leading-none font-black text-[var(--muted)] tabular-nums md:row-span-1 md:text-5xl">
                    {p.slot}
                  </span>
                  <div className="flex min-w-0 items-center gap-3">
                    <Face pid={p.took.pid} players={players} size={44} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {pname(players, p.took.pid)}
                      </p>
                      <p className="flex items-center gap-2 text-xs text-[var(--muted)]">
                        <Image
                          src={`/avatars/${p.by}.jpg`}
                          alt=""
                          width={16}
                          height={16}
                          className="size-4 rounded-full"
                        />
                        <span className="truncate">{nick(p.by)}</span>
                        <span className="ml-1">now #{p.took.redo}</span>
                        <Shift from={p.slot} to={p.took.redo} />
                      </p>
                    </div>
                  </div>
                  <div
                    className={`flex min-w-0 items-center gap-3 rounded-xl p-2 md:p-0 ${same ? "" : "bg-black/20 md:bg-transparent"}`}
                  >
                    {same ? (
                      <p className="text-sm font-semibold text-[#7fd49a]">
                        Nailed it. Same pick again.
                      </p>
                    ) : (
                      <>
                        <Face pid={p.should.pid} players={players} size={44} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {pname(players, p.should.pid)}
                          </p>
                          <p className="truncate text-xs text-[var(--muted)]">
                            Actually went #{p.should.no} to {nick(p.should.by)}
                            , {n0(p.should.value)} lock-in pts
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </motion.div>
      </AnimatePresence>

      <Explain>
        <p>
          Every player taken in that season&apos;s draft, all fourteen rounds, is
          re-ranked by what he actually gave a Trash team: his best single game
          each regular-season week, added up. That&apos;s exactly what a
          locked-in starter can score here, so durable stars who show up every
          week rise and injured ones fall.
        </p>
        <p>
          The re-do column is who should go at each pick if everyone drafted
          again knowing how the season went. Picks come from the league&apos;s
          official Sleeper draft; game scores use the league&apos;s own scoring.
        </p>
      </Explain>
    </div>
  );
}
