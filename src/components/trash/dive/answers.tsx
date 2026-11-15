"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { Players } from "@/lib/extras";
import { Face, pname } from "../player";
import { tierOf } from "./stage";

/** Every right answer for a prompt, rarest first, with your pick highlighted. */
export function AnswerBoard({
  answers,
  mine,
  players,
}: {
  answers: [string, number][];
  mine: string | null;
  players: Players;
}) {
  const reduce = useReducedMotion();
  const [all, setAll] = useState(false);
  const shown = all ? answers : answers.slice(0, 24);
  return (
    <div>
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {shown.map(([pid, s], i) => {
          const t = tierOf(s);
          const me = pid === mine;
          return (
            <motion.li
              key={pid}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.015, 0.4) }}
              className={`flex items-center gap-2.5 rounded-xl px-2 py-1.5 ${me ? "bg-white/12 ring-2 ring-[var(--paper)]" : "bg-black/20"}`}
            >
              <Face pid={pid} players={players} size={28} />
              <span className="min-w-0 flex-1 break-words text-sm">
                {pname(players, pid)}
                {me ? <span className="ml-1.5 text-xs text-[var(--muted)]">your pick</span> : null}
              </span>
              <span
                className="rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums"
                style={{ background: t.hex, color: "#10141a" }}
                title={t.label}
              >
                {s}
              </span>
            </motion.li>
          );
        })}
      </ul>
      {answers.length > 24 ? (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-3 cursor-pointer text-sm font-semibold text-[var(--paper)]/80 underline-offset-4 hover:underline"
        >
          {all ? "Show fewer" : `Show all ${answers.length}`}
        </button>
      ) : null}
    </div>
  );
}
