"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { QuizManager, Trait } from "@/lib/extras";
import { Explain } from "./intel";
import { MgrPhoto, Src } from "@/components/trash/brand";

type Answer = { text: string; v: Partial<Record<Trait, number>> };
const QUESTIONS: { q: string; a: Answer[] }[] = [
  {
    q: "The trade deadline is in an hour. Where are you?",
    a: [
      { text: "Four offers out, two counters pending.", v: { trades: 1.6 } },
      { text: "Open to it if someone comes to me.", v: { trades: 0 } },
      { text: "Trading is for people who drafted badly.", v: { trades: -1.3, draft: 0.8 } },
    ],
  },
  {
    q: "Your bench guard drops 62 on a Tuesday. What now?",
    a: [
      { text: "Lock it in. He's benched until Monday.", v: { lockin: 1.5 } },
      { text: "Let it ride, he might do it again.", v: { lockin: -0.6 } },
      { text: "I find out on Sunday.", v: { lockin: -1.5, wire: -0.6 } },
    ],
  },
  {
    q: "How often do you check the waiver wire?",
    a: [
      { text: "Before I check my texts.", v: { wire: 1.5 } },
      { text: "When an injury makes me.", v: { wire: -0.2 } },
      { text: "I have a roster. It's fine.", v: { wire: -1.4 } },
    ],
  },
  {
    q: "Draft night. What's your prep?",
    a: [
      { text: "Spreadsheets, tiers, mock drafts all week.", v: { draft: 1.4, lockin: 0.4 } },
      { text: "A ranking I found an hour before.", v: { draft: 0 } },
      { text: "Vibes. And whoever played well last night.", v: { draft: -1.4 } },
    ],
  },
  {
    q: "Pick one. Which season would you rather have?",
    a: [
      { text: "Limp in as the 6 seed and win the title.", v: { rings: 1.5, wins: -0.3 } },
      { text: "Go 17–4 and lose in the semis.", v: { wins: 1.5, rings: -0.4 } },
      { text: "Go 9–12 and win every argument in the chat.", v: { wins: -1, trades: 0.6 } },
    ],
  },
  {
    q: "A leaguemate sends you a trade that's clearly in your favour.",
    a: [
      { text: "Accept before they wake up.", v: { trades: 0.9, wins: 0.4 } },
      { text: "Counter for more. Always counter.", v: { trades: 1.3 } },
      { text: "Decline. Something's up.", v: { trades: -1, rings: 0.3 } },
    ],
  },
];

const TRAIT_WORD: Record<Trait, [string, string]> = {
  trades: ["Deal-maker", "Keeps the roster close"],
  wire: ["Lives on the wire", "Sets and forgets"],
  lockin: ["Locks in", "Leaves points on the bench"],
  draft: ["Drafts sharp", "Drafts on vibes"],
  wins: ["Regular-season machine", "Scrapes by"],
  rings: ["Built for May", "Still waiting"],
};

function match(managers: QuizManager[], picks: Answer[]) {
  const sum: Partial<Record<Trait, number[]>> = {};
  for (const p of picks)
    for (const [t, v] of Object.entries(p.v) as [Trait, number][])
      (sum[t] ??= []).push(v);
  const you = Object.fromEntries(
    Object.entries(sum).map(([t, xs]) => [t, xs!.reduce((a, b) => a + b, 0) / xs!.length]),
  ) as Partial<Record<Trait, number>>;
  const scored = managers
    .map((m) => {
      let d = 0;
      for (const [t, v] of Object.entries(you) as [Trait, number][])
        d += (m.z[t] - v) ** 2;
      return { m, d };
    })
    .sort((a, b) => a.d - b.d);
  // The two traits where you and your match agree most strongly, in the direction you lean.
  const top = scored[0].m;
  const shared = (Object.entries(you) as [Trait, number][])
    .filter(([t, v]) => Math.sign(v) === Math.sign(top.z[t]) && v !== 0 && Math.abs(top.z[t]) > 0.35)
    .sort((a, b) => Math.abs(top.z[b[0]]) - Math.abs(top.z[a[0]]))
    .slice(0, 3)
    .map(([t]) => t);
  return { top, runner: scored[1].m, shared, fit: Math.max(0, 1 - scored[0].d / 12) };
}

export function ManagerQuiz({ managers }: { managers: QuizManager[] }) {
  const [step, setStep] = useState(0);
  const [picks, setPicks] = useState<Answer[]>([]);
  const reduce = useReducedMotion();
  const done = step >= QUESTIONS.length;
  const res = done ? match(managers, picks) : null;

  const choose = (a: Answer) => {
    setPicks((p) => [...p.slice(0, step), a]);
    setStep((s) => s + 1);
  };
  const restart = () => {
    setPicks([]);
    setStep(0);
  };

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[rgba(16,40,30,0.55)] p-5 md:p-10">
      <div className="flex items-center gap-1.5" aria-hidden>
        {QUESTIONS.map((_, k) => (
          <span
            key={k}
            className="h-1.5 flex-1 rounded-full transition-colors duration-300"
            style={{
              background: k < step ? "var(--paper)" : "rgba(255,255,255,0.12)",
            }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {!done ? (
          <motion.div
            key={step}
            initial={{ opacity: 0, x: reduce ? 0 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: reduce ? 0 : -16 }}
            transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
            className="mt-8"
          >
            <p className="text-sm text-[var(--muted)]" aria-live="polite">
              Question {step + 1} of {QUESTIONS.length}
            </p>
            <h3 className="font-display mt-2 max-w-[22ch] text-[clamp(2.2rem,5.5vw,3.6rem)] leading-[0.95] font-black">
              {QUESTIONS[step].q}
            </h3>
            <ul className="mt-8 grid gap-3">
              {QUESTIONS[step].a.map((a) => (
                <li key={a.text}>
                  <button
                    type="button"
                    onClick={() => choose(a)}
                    className="w-full cursor-pointer rounded-2xl border border-white/12 bg-black/20 px-5 py-4 text-left text-lg font-medium transition-[transform,background-color,border-color] duration-150 hover:border-white/30 hover:bg-black/30 active:scale-[0.985]"
                  >
                    {a.text}
                  </button>
                </li>
              ))}
            </ul>
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="mt-5 cursor-pointer text-sm text-[var(--muted)] underline-offset-4 hover:text-[var(--paper)] hover:underline"
              >
                Back a question
              </button>
            ) : null}
          </motion.div>
        ) : res ? (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: reduce ? 1 : 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="mt-8 grid gap-8 md:grid-cols-[auto_1fr] md:items-center"
          >
            <div className="relative mx-auto md:mx-0">
              <span
                aria-hidden
                className="absolute -inset-6 rounded-full opacity-50 blur-2xl"
                style={{ background: res.top.color }}
              />
              <MgrPhoto
                id={res.top.id}
                alt=""
                width={200}
                height={200}
                className="relative size-40 rounded-full object-cover md:size-52"
                style={{ boxShadow: `0 0 0 6px ${res.top.color}` }}
              />
            </div>
            <div>
              <p className="text-[var(--muted)]">You manage like</p>
              <p className="font-display text-[clamp(3.4rem,10vw,6.5rem)] leading-[0.88] font-black">
                {res.top.nick}
              </p>
              <p className="mt-4 text-sm text-[var(--muted)]">
                {res.top.id}, {Math.round(res.fit * 100)}% match
              </p>
              <ul className="mt-6 space-y-3">
                {(res.shared.length ? res.shared : (["wins"] as Trait[])).map((t) => (
                  <li key={t} className="border-t border-white/10 pt-3">
                    <p className="font-semibold">
                      {TRAIT_WORD[t][res.top.z[t] >= 0 ? 0 : 1]}
                    </p>
                    <p className="text-sm text-[var(--muted)]">
                      {res.top.facts[t]}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm text-[var(--muted)]">
                Runner-up:{" "}
                <span className="font-semibold text-[var(--paper)]">
                  {res.runner.nick}
                </span>
              </p>
              <button
                type="button"
                onClick={restart}
                className="mt-6 inline-flex h-12 cursor-pointer items-center rounded-full bg-[var(--paper)] px-6 font-semibold text-[var(--bin)] transition-transform duration-150 active:scale-[0.97]"
              >
                Take it again
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Explain>
        <p>
          Every manager has a real profile built from four seasons on <Src />:
          trades per season, waiver adds per season, lineup efficiency from the
          Lock-In Index, how their early draft picks finished versus where they
          went, career win rate, and playoff and title history.
        </p>
        <p>
          Each answer leans you one way on some of those traits. You get the
          current manager whose real numbers sit closest to yours.
        </p>
      </Explain>
    </div>
  );
}
