"use client";

import confetti from "canvas-confetti";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Players } from "@/lib/extras";
import type { Suspect } from "@/lib/lineup";
import { sfx } from "./dive/sfx";
import { Face } from "./player";
import { Leaderboard, type Person } from "./leaderboard";
import { useBrand } from "@/components/trash/brand";

const TRIES = 8;
const LAUNCH = Date.UTC(2026, 10, 14);
type Mark = "hit" | "close" | "miss";
const BG: Record<Mark, string> = { hit: "#7fd49a", close: "#c98a4b", miss: "#1d3329" };
const YR = ["", "’23", "’24", "’25", "’26"];

const todayET = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, "");
const ft = (h: number) => `${Math.floor(h / 12)}′${h % 12}″`;
const store = {
  get<T>(k: string): T | null {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },
};

type Clue = { label: string; value: string; mark: Mark; arrow?: "up" | "down" };

/** Compare a guess to the suspect. Arrows point toward the answer. */
function clues(g: Suspect, t: Suspect, nick: (id: string) => string, league = "Trash"): Clue[] {
  const num = (a: number, b: number, near: number) =>
    ({ mark: a === b ? "hit" : Math.abs(a - b) <= near ? "close" : "miss", arrow: a === b ? undefined : b > a ? "up" : "down" }) as const;
  const posHit = g.pos.length === t.pos.length && g.pos.every((p) => t.pos.includes(p));
  const posNear = g.pos.some((p) => t.pos.includes(p));
  return [
    { label: "Team", value: g.team, mark: g.team === t.team ? "hit" : g.conf && g.conf === t.conf ? "close" : "miss" },
    { label: "Pos", value: g.pos.join("/") || "?", mark: posHit ? "hit" : posNear ? "close" : "miss" },
    { label: "Height", value: ft(g.height), ...num(g.height, t.height, 2) },
    { label: "Age", value: g.age ? String(g.age) : "?", ...num(g.age, t.age, 2) },
    { label: `${league} weeks`, value: String(g.weeks), ...num(g.weeks, t.weeks, 15) },
    { label: `${league} teams`, value: String(g.owners.length), ...num(g.owners.length, t.owners.length, 1) },
    { label: "Top owner", value: nick(g.owner), mark: g.owner === t.owner ? "hit" : t.owners.includes(g.owner) ? "close" : "miss" },
    { label: "First season", value: YR[g.first], ...num(g.first, t.first, 1) },
  ];
}

/** What every column means, shown in the header popovers and the key. */
const colsFor = (league: string): { label: string; info: string }[] => [
  { label: "Team", info: "His NBA team right now. Brown means same conference." },
  { label: "Pos", info: "Fantasy positions on Sleeper. Brown means at least one position in common." },
  { label: "Height", info: "Brown means within 2 inches. The arrow points toward the suspect's height." },
  { label: "Age", info: "Age today. Brown means within 2 years." },
  { label: `${league} weeks`, info: `Total weeks he's spent on any ${league} roster, all seasons. Brown means within 15.` },
  { label: `${league} teams`, info: `How many different ${league} managers have rostered him. Brown means off by one.` },
  { label: "Top owner", info: "The manager who rostered him the longest. Brown means the suspect was on that manager's roster at some point." },
  { label: "First season", info: `The first ${league} season he was on a roster ('23 is 2023–24). Brown means one season off.` },
];
const GRID = "md:grid-cols-8";

function ColHead({ label, info }: { label: string; info: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="group relative flex items-center justify-center gap-1 text-center">
      <span className="leading-tight">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        aria-label={`What ${label} means`}
        aria-expanded={open}
        className="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full border border-current text-[9px] leading-none font-bold opacity-70 hover:opacity-100"
      >
        i
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-full left-1/2 z-40 mt-2 w-52 -translate-x-1/2 rounded-xl border border-white/12 bg-[#0d241a] p-3 text-left text-xs leading-relaxed font-normal text-[var(--paper)] shadow-xl transition-opacity duration-150 group-hover:opacity-100 ${open ? "opacity-100" : "opacity-0"}`}
      >
        {info}
      </span>
    </span>
  );
}

/** The color key, plus every category explained. Works on phones, where there are no headers. */
function Key() {
  const brand = useBrand();
  return (
    <details className="group mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold select-none">
        <span className="inline-flex size-5 items-center justify-center rounded-full border border-current text-xs transition-transform duration-200 group-open:rotate-45">
          +
        </span>
        How to read the clues
      </summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {[
          ["hit", "Green", "Exact match with the suspect."],
          ["close", "Brown", "Close. Each category says what close means."],
          ["miss", "Dark", "Not close."],
        ].map(([m, name, text]) => (
          <div key={m} className="flex items-center gap-2">
            <span className="size-6 shrink-0 rounded-md" style={{ background: BG[m as Mark] }} />
            <span>
              <span className="font-semibold">{name}:</span> <span className="text-[var(--muted)]">{text}</span>
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[var(--muted)]">
        <span className="font-semibold text-[var(--paper)]">↑ ↓ Arrows</span> point toward the suspect: ↑ means the
        suspect is taller, older, has more weeks, and so on.
      </p>
      <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {colsFor(brand.name).map((c) => (
          <div key={c.label}>
            <dt className="font-semibold">{c.label}</dt>
            <dd className="text-[var(--muted)]">{c.info}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function Chip({ c, i, fresh }: { c: Clue; i: number; fresh: boolean }) {
  const reduce = useReducedMotion();
  const anim = !reduce && fresh;
  const delay = i * 0.16;
  return (
    <div className="[perspective:600px]">
      <motion.div
        initial={anim ? { rotateX: -90, opacity: 0, scale: 0.9 } : false}
        animate={
          anim && c.mark === "hit"
            ? { rotateX: 0, opacity: 1, scale: [0.9, 1.14, 1], boxShadow: ["0 0 0 0 rgba(127,212,154,0)", "0 0 0 6px rgba(127,212,154,0.45)", "0 0 0 0 rgba(127,212,154,0)"] }
            : { rotateX: 0, opacity: 1, scale: 1 }
        }
        transition={{ duration: anim ? 0.55 : 0, delay: anim ? delay : 0, ease: [0.23, 1, 0.32, 1] }}
        onAnimationStart={() => {
          if (anim) setTimeout(() => sfx.tick(), delay * 1000 + 80);
        }}
        className="flex min-h-14 flex-col items-center justify-center rounded-xl px-1.5 py-1.5 text-center [transform-origin:50%_0%]"
        style={{ background: BG[c.mark], color: c.mark === "miss" ? "#f6f3ea" : "#10141a" }}
      >
        <span className="text-[10px] leading-none font-semibold opacity-70 md:hidden">{c.label}</span>
        <span className="mt-0.5 flex max-w-full items-center gap-1 text-sm leading-tight font-black">
          <span className="truncate">{c.value}</span>
          {c.arrow ? (
            <span className={c.arrow === "up" ? "lu-up" : "lu-down"} aria-label={c.arrow === "up" ? "higher" : "lower"}>
              {c.arrow === "up" ? "↑" : "↓"}
            </span>
          ) : null}
        </span>
      </motion.div>
    </div>
  );
}

/* Height chart: 6′0″ sits on the floor line, 7′2″ near the top. Positions are % of the wall. */
const FLOOR = 80;
const topAt = (h: number) => FLOOR - (Math.max(70, Math.min(87, h)) - 72) * 4.6;

/** A person in the lineup: head at their real height, body down to the floor. */
function Figure({ pid, players, dark, n }: { pid?: string; players: Players; dark?: boolean; n?: number }) {
  return (
    <div className="flex h-full w-full flex-col items-center">
      <div className="relative z-10 aspect-square w-[62%] shrink-0 overflow-hidden rounded-full" style={{ background: dark ? "#030806" : "#163a2c" }}>
        {pid && !dark ? <div className="h-full w-full [&>*]:!h-full [&>*]:!w-full"><Face pid={pid} players={players} size={96} /></div> : null}
      </div>
      <div
        className="-mt-[8%] w-full flex-1 rounded-t-[42%]"
        style={{ background: dark ? "#030806" : "linear-gradient(180deg,#24493a,#163a2c)" }}
      >
        {n !== undefined ? (
          <span className="mx-auto mt-[38%] block w-[70%] rounded-sm bg-[var(--paper)] py-0.5 text-center text-[10px] font-black text-[#10141a]">
            #{n}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** A wrong guess walks into the lineup, stands at their height, gets stamped and shoved out. */
function WalkIn({ pid, height, n, players }: { pid: string; height: number; n: number; players: Players }) {
  const reduce = useReducedMotion();
  useEffect(() => {
    const t = setTimeout(() => sfx.slam(), reduce ? 0 : 1050);
    return () => clearTimeout(t);
  }, [reduce]);
  return (
    <motion.div
      className="absolute z-20 w-[27%]"
      style={{ left: "63%", top: `${topAt(height) - 5}%`, bottom: `${100 - FLOOR}%` }}
      initial={{ x: reduce ? 0 : "260%", opacity: reduce ? 0 : 1 }}
      animate={reduce ? { opacity: [0, 1, 1, 0] } : { x: ["260%", "0%", "0%", "-30%", "260%"], rotate: [0, 0, 0, -6, 4] }}
      transition={{ duration: reduce ? 2.4 : 2.8, times: reduce ? [0, 0.1, 0.85, 1] : [0, 0.22, 0.72, 0.8, 1], ease: "easeInOut" }}
    >
      <Figure pid={pid} players={players} n={n} />
      <motion.span
        className="font-display absolute top-[42%] left-1/2 z-30 -ml-[40%] rounded-md border-[3px] border-[var(--ticket)] bg-[#0b1d15]/85 px-2 py-1 text-lg leading-none font-black whitespace-nowrap text-[var(--ticket)] shadow-lg"
        initial={{ opacity: 0, scale: 2.4, rotate: -24 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [2.4, 1, 1, 1], rotate: -12 }}
        transition={{ duration: 1.9, times: [0, 0.12, 0.85, 1], delay: reduce ? 0 : 0.95 }}
      >
        NOT HIM
      </motion.span>
    </motion.div>
  );
}

/** The lineup wall: height chart, the hidden suspect, walk-ins, and the big reveal. */
function Wall({
  solved,
  suspect,
  players,
  flashKey,
  walk,
}: {
  solved: boolean | null;
  suspect: Suspect | null;
  players: Players;
  flashKey: number;
  walk: { pid: string; height: number; n: number } | null;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b1d15]" style={{ aspectRatio: "4 / 5" }}>
      {/* height chart */}
      {[72, 75, 78, 81, 84].map((h) => (
        <div key={h} className="absolute inset-x-0 border-t border-dashed border-white/15" style={{ top: `${topAt(h)}%` }}>
          <span className="absolute -top-2.5 left-1.5 text-[10px] font-semibold text-white/45">{ft(h)}</span>
          <span className="absolute -top-2.5 right-1.5 text-[10px] font-semibold text-white/45">{ft(h)}</span>
        </div>
      ))}
      <div className="absolute inset-x-0 bottom-0 bg-[#07130e]" style={{ top: `${FLOOR}%` }} />

      {/* the suspect: a silhouette whose head fades into shadow, so it doesn't give the height away */}
      <AnimatePresence>
        {solved === null ? (
          <motion.div
            key="sil"
            className="absolute w-[30%]"
            style={{ left: "22%", top: "8%", bottom: `${100 - FLOOR}%` }}
            initial={false}
            animate={reduce ? {} : { scaleY: [1, 1.012, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            exit={solved === false || reduce ? { opacity: 0 } : { x: "-260%", skewX: -18, opacity: 0, transition: { duration: 0.45, ease: "easeIn" } }}
          >
            <div className="h-full w-full [mask-image:linear-gradient(180deg,transparent,black_38%)]">
              <Figure players={players} dark />
            </div>
            <span className="font-display absolute top-[30%] left-1/2 -translate-x-1/2 text-5xl font-black text-white/15">?</span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* the reveal: the real suspect rises into place at their real height */}
      <AnimatePresence>
        {solved !== null && suspect ? (
          <motion.div
            key="reveal"
            className="absolute w-[30%]"
            style={{ left: "22%", top: `${topAt(suspect.height) - 6}%`, bottom: `${100 - FLOOR}%` }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", duration: 0.8, bounce: 0.35, delay: solved ? 0.55 : 1.1 }}
          >
            <Figure pid={suspect.pid} players={players} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>{walk && solved === null ? <WalkIn key={walk.n} {...walk} players={players} /> : null}</AnimatePresence>

      {/* spotlight sweep on a win */}
      <AnimatePresence>
        {solved && !reduce ? (
          <motion.div
            key={`spot-${flashKey}`}
            className="pointer-events-none absolute -top-[20%] left-1/2 h-[140%] w-[70%] origin-top bg-[conic-gradient(from_160deg_at_50%_0%,transparent,rgba(255,240,200,0.28)_20deg,transparent_40deg)]"
            initial={{ rotate: 55, x: "-50%", opacity: 0 }}
            animate={{ rotate: [55, -40, -8], opacity: [0, 1, 0.6] }}
            transition={{ duration: 1.4, ease: "easeInOut" }}
          />
        ) : null}
      </AnimatePresence>

      {/* police lights when they get away */}
      <AnimatePresence>
        {solved === false && !reduce ? (
          <motion.div
            key="siren"
            className="pointer-events-none absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 1, 0, 1, 0, 1, 0],
              background: [
                "rgba(214,52,44,0.45)",
                "rgba(214,52,44,0.45)",
                "rgba(60,110,255,0.45)",
                "rgba(60,110,255,0.45)",
                "rgba(214,52,44,0.45)",
                "rgba(60,110,255,0.45)",
                "rgba(0,0,0,0)",
              ],
            }}
            transition={{ duration: 1.6 }}
          />
        ) : null}
      </AnimatePresence>

      {/* placard */}
      <div className="absolute inset-x-[14%] bottom-[5%] z-30 rounded-md border-2 border-[#10141a] bg-[var(--paper)] px-2 py-1.5 text-center text-[#10141a] shadow-lg">
        <p className="text-[10px] leading-none font-bold tracking-wide opacity-70">TRASH PD</p>
        <p className="font-display mt-0.5 truncate text-lg leading-none font-black">
          {solved !== null && suspect ? suspect.name : "Unidentified"}
        </p>
      </div>

      {/* camera flash */}
      <AnimatePresence>
        {flashKey && !reduce ? (
          <motion.div
            key={flashKey}
            className="pointer-events-none absolute inset-0 z-40 bg-white"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        ) : null}
      </AnimatePresence>

      {/* verdict stamp */}
      <AnimatePresence>
        {solved !== null ? (
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 2.6, rotate: -24 }}
            animate={{ opacity: 1, scale: 1, rotate: -12 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.45, delay: solved ? 0.9 : 1.6 }}
            className="font-display absolute top-[6%] right-[5%] z-40 rounded-md border-4 bg-[#0b1d15]/70 px-2 py-0.5 text-2xl font-black"
            style={{ color: solved ? "#7fd49a" : "var(--ticket)", borderColor: solved ? "#7fd49a" : "var(--ticket)" }}
          >
            {solved ? "IDENTIFIED" : "GOT AWAY"}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function Lineup({
  suspects,
  answers,
  nicks,
  players,
  people,
}: {
  suspects: Suspect[];
  answers: string[];
  nicks: Record<string, string>;
  players: Players;
  people: Person[];
}) {
  const brand = useBrand();
  const [day, setDay] = useState<string | null>(null);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const [flash, setFlash] = useState(0);
  const [copied, setCopied] = useState(false);
  const [walk, setWalk] = useState<{ pid: string; height: number; n: number } | null>(null);
  const [rootRef, animateRoot] = useAnimate();
  const fx = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const byId = useMemo(() => new Map(suspects.map((s) => [s.pid, s])), [suspects]);
  const nick = (id: string) => nicks[id] ?? id;

  useEffect(() => {
    const d = todayET();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDay(d);
    setGuesses(store.get<string[]>(brand.key(`lineup:${d}`)) ?? []);
  }, [brand]);
  const edition = day ? Math.floor((Date.parse(day) - LAUNCH) / 86400000) + 1 : 1;
  const target = day ? byId.get(answers[(edition * 53 + 29) % answers.length]) ?? null : null;
  const won = !!target && guesses.includes(target.pid);
  const over = won || guesses.length >= TRIES;

  const nq = norm(q).trim();
  const toks = nq.split(" ").filter(Boolean);
  // Every word typed must start some word of the name, so "joel em" finds Joel Embiid.
  const hits =
    nq.length < 2
      ? []
      : suspects
          .filter((s) => {
            if (guesses.includes(s.pid)) return false;
            const words = norm(s.name).split(" ");
            return toks.every((t) => words.some((w) => w.startsWith(t)));
          })
          .slice(0, 6);
  const [nope, setNope] = useState(false);

  const guess = (pid: string) => {
    if (!target || over || guesses.includes(pid)) return;
    const next = [...guesses, pid];
    setGuesses(next);
    setFresh(pid);
    setQ("");
    setHi(0);
    if (day) store.set(brand.key(`lineup:${day}`), next);
    const g = byId.get(pid);
    if (g && pid !== target.pid) setWalk({ pid, height: g.height, n: next.length });
    const reveal = reduce ? 0 : 8 * 160 + 400;
    if (pid === target.pid)
      setTimeout(() => {
        setFlash(Date.now());
        sfx.chime(95);
        if (!reduce && rootRef.current) void animateRoot(rootRef.current, { x: [0, -7, 6, -3, 0] }, { duration: 0.35, delay: 0.9 });
        if (fx.current && !reduce)
          void confetti.create(fx.current, { resize: true, useWorker: true })({
            particleCount: 100,
            spread: 70,
            origin: { x: 0.25, y: 0.4 },
            colors: ["#d93a3a", "#3fae5a", "#e9c46a", "#f6f3ea", "#c8102e"],
          });
      }, reveal);
    else if (next.length >= TRIES)
      setTimeout(() => {
        sfx.buzz();
        if (!reduce && rootRef.current) void animateRoot(rootRef.current, { x: [0, -10, 9, -5, 0] }, { duration: 0.4, delay: 1.5 });
      }, reveal + 2600);
  };

  const share = async () => {
    if (!target) return;
    const sq = { hit: "🟩", close: "🟫", miss: "⬛" };
    const rows = guesses.map((g) => clues(byId.get(g)!, target, nick, brand.name).map((c) => sq[c.mark]).join("")).join("\n");
    try {
      await navigator.clipboard.writeText(`${brand.games.lineup} #${edition} ${won ? guesses.length : "X"}/${TRIES}\n${rows}\n${location.origin}${brand.base || "/"}#lineup`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div data-no-rico ref={rootRef} className="xmas-drift relative rounded-[28px] border border-white/10 bg-[radial-gradient(120%_70%_at_20%_0%,rgba(246,243,234,0.07),rgba(12,32,24,0.94)_60%)] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.7)]">
      <canvas ref={fx} className="pointer-events-none absolute inset-0 z-20 h-full w-full" aria-hidden />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4 md:px-8">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-3xl leading-none font-black md:text-4xl">The Lineup</span>
          <span className="text-sm text-[var(--muted)]">Case No. {edition}</span>
        </div>
        <div className="flex gap-1" aria-label={`${TRIES - guesses.length} guesses left`}>
          {Array.from({ length: TRIES }, (_, k) => (
            <span
              key={k}
              className="h-6 w-2.5 rounded-full transition-colors duration-300"
              style={{ background: k < guesses.length ? (guesses[k] === target?.pid ? "#7fd49a" : "rgba(246,243,234,0.18)") : "var(--paper)" }}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-6 p-5 md:grid-cols-[300px_1fr] md:p-8">
        <div className="mx-auto w-full max-w-[300px]">
          <Wall solved={over ? won : null} suspect={target} players={players} flashKey={flash} walk={walk} />
          <div className="mt-3 space-y-1.5" aria-label="Tip line">
            {target
              ? [
                  { at: 3, label: "Tip", text: target.conf ? `Plays in the ${target.conf}` : "Currently a free agent" },
                  {
                    at: 5,
                    label: "Tip",
                    text: `Initials ${target.name
                      .split(" ")
                      .map((w) => w[0])
                      .join(".")}.`,
                  },
                  { at: 7, label: "Tip", text: target.team === "FA" ? "No current NBA team" : `Plays for ${target.team}` },
                ].map((h) => {
                  const misses = guesses.filter((g) => g !== target.pid).length;
                  const open = misses >= h.at || over;
                  return (
                    <motion.div
                      key={h.at}
                      initial={false}
                      animate={open && !reduce ? { scale: [1, 1.04, 1] } : { scale: 1 }}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${open ? "border-[var(--wood)]/60 bg-[var(--wood)]/10" : "border-white/10"}`}
                    >
                      <span className="text-xs font-bold text-[var(--wood)]">{h.label}</span>
                      <span className={open ? "" : "text-[var(--muted)]"}>{open ? h.text : `Unlocks after ${h.at} misses`}</span>
                    </motion.div>
                  );
                })
              : null}
          </div>
        </div>

        <div className="min-w-0">
          {!over ? (
            <div className="relative">
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setHi(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHi((h) => Math.min(h + 1, Math.max(0, hits.length - 1)));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHi((h) => Math.max(0, h - 1));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    if (hits[hi]) guess(hits[hi].pid);
                    else if (nq.length >= 2) {
                      setNope(true);
                      sfx.buzz();
                      setTimeout(() => setNope(false), 2400);
                    }
                  }
                }}
                placeholder={`Name a suspect (${TRIES - guesses.length} left)`}
                aria-label="Guess a player"
                autoComplete="off"
                className="h-14 w-full rounded-2xl border-2 border-white/15 bg-black/30 px-5 text-lg font-semibold text-[var(--paper)] outline-none placeholder:font-normal placeholder:text-[var(--muted)] focus:border-[var(--paper)]/60"
              />
              {nope ? (
                <p role="status" className="mt-2 text-sm font-semibold text-[var(--ticket)]">
                  No {brand.name} player by that name. Pick one from the list.
                </p>
              ) : null}
              {hits.length ? (
                <ul role="listbox" className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-white/12 bg-[#0d241a] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                  {hits.map((h, k) => (
                    <li key={h.pid} role="option" aria-selected={k === hi}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => guess(h.pid)}
                        className={`flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left ${k === hi ? "bg-white/10" : "hover:bg-white/5"}`}
                      >
                        <Face pid={h.pid} players={players} size={32} />
                        <span className="font-semibold">{h.name}</span>
                        <span className="ml-auto text-xs text-[var(--muted)]">{h.team}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : target ? (
            <motion.div
              initial={{ opacity: 0, y: reduce ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0 : 1.2 }}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 p-4"
              style={{ borderColor: won ? "#7fd49a" : "var(--ticket)" }}
            >
              <div>
                <p className="text-sm text-[var(--muted)]">{won ? `Cracked in ${guesses.length}` : "The suspect was"}</p>
                <p className="font-display text-3xl leading-none font-black">{target.name}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {nick(target.owner)}&apos;s guy, {target.weeks} weeks on {brand.name} rosters
                </p>
              </div>
              <button
                type="button"
                onClick={share}
                className="font-display inline-flex h-12 cursor-pointer items-center rounded-full bg-[var(--paper)] px-6 text-xl font-black text-[var(--bin)] transition-transform duration-150 active:scale-[0.96]"
              >
                {copied ? "Copied" : "Copy my case file"}
              </button>
            </motion.div>
          ) : null}

          <Key />

          {over ? (
            <Leaderboard
              game="lineup"
              day={day}
              people={people}
              result={{ score: won ? (TRIES + 1 - guesses.length) * 15 : 0, label: won ? `Cracked in ${guesses.length}` : "Got away" }}
            />
          ) : null}

          {/* statements */}
          <div className="mt-5">
            <div className={`hidden gap-1.5 px-1.5 pb-2 text-[11px] font-semibold text-[var(--muted)] md:grid ${GRID}`}>
              {colsFor(brand.name).map((c) => (
                <ColHead key={c.label} {...c} />
              ))}
            </div>
            <ol className="space-y-2">
              {[...guesses].reverse().map((pid) => {
                const g = byId.get(pid);
                if (!g || !target) return null;
                const cs = clues(g, target, nick, brand.name);
                const isNew = pid === fresh;
                return (
                  <motion.li
                    key={pid}
                    layout={!reduce}
                    initial={isNew && !reduce ? { opacity: 0, y: -10 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    className={`grid grid-cols-4 gap-1.5 rounded-2xl bg-black/20 p-1.5 ${GRID}`}
                  >
                    <div className="col-span-4 flex min-w-0 items-center gap-2 px-1 py-1 md:col-span-8">
                      <Face pid={pid} players={players} size={34} />
                      <span className="truncate text-sm font-semibold">{g.name}</span>
                    </div>
                    {cs.map((c, i) => (
                      <Chip key={c.label} c={c} i={i} fresh={isNew} />
                    ))}
                  </motion.li>
                );
              })}
            </ol>
            {!guesses.length ? (
              <p className="mt-2 rounded-2xl border border-dashed border-white/15 p-5 text-center text-sm text-[var(--muted)]">
                No statements yet. Start with someone you remember from the league.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
