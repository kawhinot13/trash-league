"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import type { GradedTrade, Players } from "@/lib/extras";
import type { Manager } from "@/lib/league";
import { Explain, Segmented } from "./intel";
import { Face, pname } from "./player";
import { MgrPhoto, useBrand } from "@/components/trash/brand";
import { lineupTerms } from "@/lib/core/lineup-terms";

const n0 = (x: number) => Math.round(x).toLocaleString();
const WIN = "#7fd49a";

function TradeCard({ t, players, nick, i }: { t: GradedTrade; players: Players; nick: (id: string) => string; i: number }) {
  const reduce = useReducedMotion();
  const terms = lineupTerms(useBrand().lineup);
  const max = Math.max(1, ...t.sides.map((s) => s.pts));
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.2), ease: [0.23, 1, 0.32, 1] }}
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-[var(--muted)]">
          {t.years}, week {t.week}
        </p>
        <span
          className="font-display rounded-md border-2 px-2 py-0.5 text-sm leading-none font-black"
          style={{ color: t.winner ? WIN : "var(--muted)", borderColor: t.winner ? WIN : "rgba(255,255,255,0.2)", rotate: t.winner ? "-3deg" : "0deg" }}
        >
          {t.winner ? `${nick(t.winner)} won by ${n0(t.margin)}` : "Even trade"}
        </span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {t.sides.map((s) => {
          const won = t.winner === s.who;
          return (
            <div key={s.who} className={`rounded-xl p-3 ${won ? "bg-[rgba(127,212,154,0.1)] ring-1 ring-[rgba(127,212,154,0.4)]" : "bg-black/20"}`}>
              <div className="flex items-center gap-2">
                <MgrPhoto id={s.who} alt="" width={26} height={26} className="size-[26px] rounded-full object-cover" />
                <p className="text-sm font-semibold">
                  {nick(s.who)} <span className="font-normal text-[var(--muted)]">got</span>
                </p>
              </div>
              <ul className="mt-2 space-y-1.5">
                {s.got.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-sm">
                    {p.startsWith("pick:") ? (
                      <span className="flex size-7 items-center justify-center rounded-full bg-[var(--wood)]/25 text-[10px] font-bold text-[var(--wood)]">PK</span>
                    ) : (
                      <Face pid={p} players={players} size={28} />
                    )}
                    <span className="break-words">{pname(players, p)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-baseline justify-between text-xs">
                <span className="text-[var(--muted)]">Value for {nick(s.who)} after</span>
                <span className="font-display text-xl font-black tabular-nums" style={{ color: won ? WIN : undefined }}>
                  {n0(s.pts)}
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-white/8">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: won ? WIN : "var(--paper)" }}
                  initial={{ width: reduce ? `${(s.pts / max) * 100}%` : "0%" }}
                  whileInView={{ width: `${(s.pts / max) * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                />
              </div>
              <p className="mt-1 text-[11px] text-[var(--muted)]">
                {s.starts === null
                  ? `${s.held} player-weeks on the roster afterwards`
                  : `${terms.starts(s.starts)} after the trade, ${s.held} player-weeks on the roster`}
              </p>
            </div>
          );
        })}
      </div>
    </motion.li>
  );
}

export function TradeCourt({
  trades,
  records,
  players,
  managers,
}: {
  trades: GradedTrade[];
  records: { id: string; w: number; l: number; e: number; net: number }[];
  players: Players;
  managers: Manager[];
}) {
  const [season, setSeason] = useState("all");
  const [who, setWho] = useState<string | null>(null);
  const [sort, setSort] = useState<"heist" | "recent">("heist");
  const [shown, setShown] = useState(8);
  const nick = (id: string) => managers.find((m) => m.id === id)?.nick ?? id;
  const list = useMemo(() => {
    const f = trades.filter((t) => (season === "all" || t.code === season) && (!who || t.sides.some((s) => s.who === who)));
    return sort === "heist" ? [...f].sort((a, b) => b.margin - a.margin) : [...f].reverse();
  }, [trades, season, who, sort]);
  const seasons = [...new Set(trades.map((t) => t.code))];
  const yrs = Object.fromEntries(trades.map((t) => [t.code, t.years]));

  return (
    <div className="rounded-[28px] border border-white/10 bg-[rgba(16,40,30,0.55)] p-5 md:p-10">
      {/* records */}
      <h3 className="font-display text-3xl font-black">Trade records</h3>
      <p className="mt-1 text-sm text-[var(--muted)]">Wins and losses in trades, and the net value gained across all of them (per Sleeper).</p>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {records.map((r, i) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => {
                setWho(who === r.id ? null : r.id);
                setShown(8);
              }}
              aria-pressed={who === r.id}
              className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-150 ${who === r.id ? "bg-white/12 ring-1 ring-[var(--paper)]/50" : "bg-black/20 hover:bg-black/30"}`}
            >
              <span className="font-display w-5 text-lg font-black text-[var(--muted)] tabular-nums">{i + 1}</span>
              <MgrPhoto id={r.id} alt="" width={30} height={30} className="size-[30px] rounded-full object-cover" />
              <span className="min-w-0 flex-1 break-words font-semibold">{nick(r.id)}</span>
              <span className="text-sm tabular-nums">
                {r.w}–{r.l}
                {r.e ? <span className="text-[var(--muted)]">–{r.e}</span> : null}
              </span>
              <span className={`w-16 text-right text-sm font-bold tabular-nums ${r.net >= 0 ? "text-[#7fd49a]" : "text-[#ff8a7a]"}`}>
                {r.net >= 0 ? "+" : ""}
                {n0(r.net)}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Segmented
          id="tc-season"
          value={season}
          onChange={(v) => {
            setSeason(v);
            setShown(8);
          }}
          options={[["all", "All"], ...seasons.map((c) => [c, yrs[c]] as [string, string])]}
        />
        <Segmented id="tc-sort" value={sort} onChange={setSort} options={[["heist", "Biggest heists"], ["recent", "Most recent"]]} />
      </div>
      <p className="mt-3 text-sm text-[var(--muted)]">
        {list.length} trade{list.length === 1 ? "" : "s"}
        {who ? ` involving ${nick(who)}` : ""}.{" "}
        {who ? (
          <button type="button" onClick={() => setWho(null)} className="cursor-pointer font-semibold text-[var(--paper)] underline underline-offset-4">
            Show everyone
          </button>
        ) : null}
      </p>

      <AnimatePresence mode="popLayout">
        <motion.ol key={`${season}-${who}-${sort}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4 grid gap-3 lg:grid-cols-2">
          {list.slice(0, shown).map((t, i) => (
            <TradeCard key={t.id} t={t} players={players} nick={nick} i={i} />
          ))}
        </motion.ol>
      </AnimatePresence>
      {list.length > shown ? (
        <button
          type="button"
          onClick={() => setShown((n) => n + 12)}
          className="mt-5 inline-flex h-11 cursor-pointer items-center rounded-full border border-white/15 px-5 font-semibold transition-colors hover:bg-white/8"
        >
          Show more trades
        </button>
      ) : null}

      <Explain>
        <p>
          Each side of a trade is judged by what it actually got. For the rest of that season (playoffs included),
          every week an incoming player is in that manager&apos;s starting lineup, he earns his average score as a
          starter that season. Weeks on the bench earn nothing, and one huge or empty game doesn&apos;t swing a trade.
          Players who got flipped right away earn little, and value from a flip shows up in the next trade instead.
          Built from Sleeper&apos;s weekly lineups (per Sleeper).
        </p>
        <p>Draft picks are listed but not scored. A trade within {60} points either way is called even.</p>
      </Explain>
    </div>
  );
}
