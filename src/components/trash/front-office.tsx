"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { FrontOffice } from "@/lib/front-office";
import { diagnose, evaluateTrade, market, metricsFor, profile, tradeFinder, tradeNotes, type Metric, type Mover, fullStrength } from "@/lib/fo-analysis";
import type { Manager } from "@/lib/league";
import { Explain, Segmented } from "./intel";
import { Handle, MgrPhoto } from "@/components/trash/brand";
import { PlayerBadge, useBrand } from "@/components/trash/brand";
import { LeagueName } from "@/components/trash/brand";

const LocalPhotos = createContext<Set<string>>(new Set());
const Who = createContext<FrontOffice["players"]>({});
const n0 = (x: number) => Math.round(x).toLocaleString();
const GOOD = "#7fd49a";
const BAD = "#ff8a7a";

/** Player photo: ours when we have it, Sleeper's otherwise, a plain disc if neither loads. */
function Head({ pid, size = 36 }: { pid: string; size?: number }) {
  const [ok, setOk] = useState(true);
  const local = useContext(LocalPhotos).has(pid);
  const who = useContext(Who)[pid];
  if (useBrand().headshots === "badge")
    return <PlayerBadge pid={pid} name={who?.name} pos={who?.pos?.[0]} size={size} className="rounded-full" />;
  return ok ? (
    <Image
      src={local ? `/players/${pid}.jpg` : `https://sleepercdn.com/content/nba/players/${pid}.jpg`}
      alt=""
      width={size}
      height={size}
      onError={() => setOk(false)}
      className="shrink-0 rounded-full bg-[var(--bin-3)] object-cover object-top"
      style={{ width: size, height: size }}
    />
  ) : (
    <span className="shrink-0 rounded-full bg-[var(--bin-3)]" style={{ width: size, height: size }} />
  );
}

function Picker({ ids, value, onChange, nick, label }: { ids: string[]; value: string; onChange: (v: string) => void; nick: (id: string) => string; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {ids.map((id) => {
        const on = id === value;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={on}
            aria-label={nick(id)}
            title={nick(id)}
            className={`relative size-11 cursor-pointer rounded-full transition-[transform,opacity] duration-200 ${on ? "scale-110" : "opacity-50 hover:opacity-100"}`}
          >
            <MgrPhoto id={id} alt="" width={44} height={44} className="size-11 rounded-full object-cover" />
            {on ? <span className="absolute -inset-1 rounded-full ring-2 ring-[var(--paper)]" /> : null}
          </button>
        );
      })}
    </div>
  );
}

function Injury({ p }: { p: { injury: string | null; onIR: boolean } }) {
  if (!p.injury && !p.onIR) return null;
  return <span className="rounded bg-[var(--ticket)] px-1 py-px text-[10px] font-bold text-white">{p.onIR ? "IR" : p.injury === "Questionable" ? "Q" : p.injury === "Out" ? "OUT" : (p.injury ?? "").slice(0, 3)}</span>;
}

function MoverList({
  title,
  tone,
  items,
  P,
  nick,
  me,
  onAct,
}: {
  title: string;
  tone: "buy" | "sell";
  items: Mover[];
  P: FrontOffice["players"];
  nick: (id: string) => string;
  me: string;
  onAct: (m: Mover) => void;
}) {
  const reduce = useReducedMotion();
  const color = tone === "buy" ? GOOD : "var(--wood)";
  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <h3 className="font-display text-2xl font-black" style={{ color }}>
        {title}
      </h3>
      <p className="text-xs text-[var(--muted)]">
        {tone === "buy" ? "Playing below their level, likely to bounce back." : "Playing above their level, likely to cool off."}
      </p>
      {items.length ? (
        <ul className="mt-3 space-y-2">
          {items.map((m, i) => {
            const p = P[m.pid];
            const mine = m.owner === me;
            return (
              <motion.li
                key={m.pid}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
                className="rounded-xl bg-black/25 p-3"
              >
                <div className="flex items-center gap-3">
                  <Head pid={m.pid} />
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold">
                      {p?.name} <span className="font-normal text-[var(--muted)]">{p?.pos.join("/")}</span>
                    </p>
                    <p className="break-words text-xs text-[var(--muted)]">{m.owner ? (mine ? "Your team" : nick(m.owner)) : "Free agent"}</p>
                  </div>
                  <span className="rounded-md px-1.5 py-0.5 text-xs font-black tabular-nums" style={{ background: color, color: "#10141a" }}>
                    {m.gap > 0 ? "+" : ""}
                    {Math.round(m.gap * 100)}%
                  </span>
                </div>
                <ul className="mt-2 space-y-0.5 text-xs leading-relaxed text-[var(--paper)]/80">
                  {m.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                {m.owner ? (
                  <button type="button" onClick={() => onAct(m)} className="mt-2 cursor-pointer text-xs font-semibold text-[var(--wood)] underline-offset-4 hover:underline">
                    {mine ? "Shop him in the trade analyzer" : "Analyze a trade for him"}
                  </button>
                ) : null}
              </motion.li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[var(--muted)]">Nobody stands out right now.</p>
      )}
    </section>
  );
}

export function FrontOfficeTools({ data, managers, local }: { data: FrontOffice; managers: Manager[]; local: string[] }) {
  const brand = useBrand();
  const localSet = useMemo(() => new Set(local), [local]);
  const [tab, setTab] = useState<"team" | "finder" | "trade" | "market">("team");
  const [me, setMe] = useState(data.teams[0].id);
  const [them, setThem] = useState(data.teams[1].id);
  const [give, setGive] = useState<string[]>([]);
  const [get, setGet] = useState<string[]>([]);
  const reduce = useReducedMotion();
  const P = data.players;
  const nick = (id: string) => managers.find((m) => m.id === id)?.nick ?? id;
  const ids = data.teams.map((t) => t.id);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(brand.key("fo:me"));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved && ids.includes(saved)) setMe(saved);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pickMe = (id: string) => {
    setMe(id);
    setGive([]);
    if (id === them) setThem(ids.find((x) => x !== id)!);
    try {
      localStorage.setItem(brand.key("fo:me"), id);
    } catch {}
  };

  // Football leagues get football groups, wording and scale; basketball (Trash) is unchanged.
  const sport = data.sport ?? "nba";
  const nfl = sport === "nfl";
  const METRICS = metricsFor(sport);
  // "Right now" discounts injured players (what you can field this week); "Full strength" counts
  // everyone healthy (what the roster is when they're back).
  const [strength, setStrength] = useState<"now" | "full">("now");
  // Tapping a category opens the whole league's table for it.
  const [rankOpen, setRankOpen] = useState<Metric | null>(null);
  const profiles = useMemo(
    () => data.teams.map((t) => profile(t, P, data.slots, sport, strength === "full" ? fullStrength : undefined)),
    [data, P, sport, strength],
  );
  const mine = profiles.find((p) => p.id === me)!;
  const d = useMemo(
    () => diagnose(mine, profiles, P, data.teams, data.free, data.slots, sport, strength === "full"),
    [mine, profiles, P, data, sport, strength],
  );
  // The trade partner can never be your own team (e.g. after your team is restored from a past
  // visit); fall back to the first other team so the picker, titles and rosters always agree.
  const partner = them !== me && ids.includes(them) ? them : ids.find((x) => x !== me)!;
  const meTeam = data.teams.find((t) => t.id === me)!;
  const themTeam = data.teams.find((t) => t.id === partner)!;
  const trade = give.length && get.length ? evaluateTrade(give, get, meTeam, themTeam, P, data.slots, undefined, sport) : null;

  const mk = useMemo(() => market(P, data.teams, sport), [P, data, sport]);
  // Only searched while the Trade finder is open (it tries a few hundred trades).
  const ideas = useMemo(
    () => (tab === "finder" ? tradeFinder(data.teams.find((t) => t.id === me)!, data.teams, P, data.slots, sport) : []),
    [tab, me, data, P, sport],
  );
  const openIdea = (partnerId: string, g: string[], r: string[]) => {
    setThem(partnerId);
    setGive(g);
    setGet(r);
    setTab("trade");
  };
  const sellMine = (pid: string) => {
    setGive([pid]);
    setGet([]);
    setTab("trade");
  };
  const loadTrade = (pid: string, owner: string | null) => {
    if (!owner) return;
    setThem(owner);
    setGet([pid]);
    setGive([]);
    setTab("trade");
  };

  return (
    <LocalPhotos.Provider value={localSet}>
      <Who.Provider value={data.players}>
    <div data-no-rico className="xmas-drift rounded-[24px] border border-white/10 bg-[rgba(16,40,30,0.55)] p-3 sm:rounded-[28px] sm:p-5 md:p-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Segmented id="fo-tab" value={tab} onChange={setTab} options={[["team", "Team analyzer"], ["finder", "Trade finder"], ["trade", "Trade analyzer"], ["market", "Buy low / sell high"]]} />
        <p className="text-xs text-[var(--muted)]">Live Season 4 rosters, week {data.week}</p>
      </div>
      <div className="mt-6">
        <p className="mb-2 text-sm text-[var(--muted)]">Your team</p>
        <Picker ids={ids} value={me} onChange={pickMe} nick={nick} label="me" />
      </div>

      <AnimatePresence mode="wait">
        {tab === "team" ? (
          <motion.div key={`team-${me}`} initial={{ opacity: 0, y: reduce ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="mt-8">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Segmented
                id="fo-strength"
                value={strength}
                onChange={setStrength}
                options={[
                  ["now", "Right now"],
                  ["full", "Full strength"],
                ]}
              />
              <p className="text-xs text-[var(--muted)]">
                {strength === "now"
                  ? "Injured players count less (Out and IR barely count): the team you can field this week."
                  : "Everyone counted healthy, as if injured players were back."}
              </p>
              {strength === "full" ? (
                <p className="w-full text-sm text-[var(--paper)]/85">
                  {d.out.length
                    ? `${d.out.length} of ${nick(me)}'s top 5 ${d.out.length === 1 ? "is" : "are"} out right now: ${d.out.map((p) => p.name).join(", ")}.`
                    : `None of ${nick(me)}'s top 5 are out right now.`}
                </p>
              ) : null}
            </div>
            {/* verdict */}
            <div className="rounded-3xl border border-white/10 bg-black/25 p-4 sm:p-6 md:p-8">
              <p className="text-sm text-[var(--muted)]">{nick(me)}&apos;s front office report</p>
              <motion.p
                initial={reduce ? false : { scale: 1.4, opacity: 0, rotate: -4 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ type: "spring", duration: 0.6, bounce: 0.35 }}
                className="font-display mt-1 text-[clamp(2.2rem,8vw,5rem)] leading-[0.9] font-black"
              >
                {d.archetype}
              </motion.p>
              <p className="mt-2 max-w-[60ch] text-[15px] leading-snug text-[var(--paper)]/85 sm:mt-3 sm:text-lg sm:leading-normal">{d.pitch}</p>
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs sm:mt-4 sm:gap-2 sm:text-sm">
                {d.strengths.map((s) => (
                  <span key={s} className="rounded-full px-2.5 py-1 font-semibold sm:px-3" style={{ background: "rgba(127,212,154,0.18)", color: GOOD }}>
                    Strong: {s}
                  </span>
                ))}
                {d.weaknesses.map((s) => (
                  <span key={s} className="rounded-full px-2.5 py-1 font-semibold sm:px-3" style={{ background: "rgba(255,138,122,0.15)", color: BAD }}>
                    Lacking: {s}
                  </span>
                ))}
              </div>
            </div>

            {/* league ranks */}
            <h3 className="font-display mt-8 text-2xl font-black sm:mt-10 sm:text-3xl">Where you rank</h3>
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-3">
              {METRICS.filter((x) => !(strength === "full" && x.key === "health")).map(({ key, label, info }, i) => {
                const r = d.rank[key as Metric];
                const n = profiles.length;
                const tone = r <= 3 ? GOOD : r > n - 3 ? BAD : "var(--paper)";
                const isOpen = rankOpen === key;
                const table = isOpen ? [...profiles].sort((a, b) => b.m[key] - a.m[key]) : [];
                const top = table[0]?.m[key] || 1;
                const fmt = (v: number) => (key === "health" ? `${Math.round(v * 100)}%` : n0(v));
                return (
                  <li key={key} className={`rounded-2xl bg-black/20 ${isOpen ? "col-span-2" : ""}`} title={info}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setRankOpen(isOpen ? null : key)}
                      className="block w-full cursor-pointer rounded-2xl p-3 text-left transition-colors duration-150 hover:bg-white/[0.03] sm:p-4"
                    >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <span className="text-sm font-semibold sm:text-base">{label}</span>
                      <span className="font-display text-xl font-black tabular-nums sm:text-2xl" style={{ color: tone }}>
                        #{r}
                        <span className="text-xs text-[var(--muted)] sm:text-sm"> of {n}</span>
                      </span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-white/8">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: tone }}
                        initial={{ width: reduce ? `${((n - r + 1) / n) * 100}%` : "0%" }}
                        animate={{ width: `${((n - r + 1) / n) * 100}%` }}
                        transition={{ duration: 0.7, delay: i * 0.05, ease: [0.23, 1, 0.32, 1] }}
                      />
                    </div>
                    <p className="mt-2 hidden text-xs leading-relaxed text-[var(--muted)] sm:block">{info}</p>
                    <p className="mt-2 text-xs font-semibold text-[var(--muted)]">{isOpen ? "Hide the league ▲" : "See the league ▼"}</p>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.ol
                          key="table"
                          initial={reduce ? false : { opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduce ? undefined : { opacity: 0 }}
                          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                          className="grid gap-1.5 px-3 pb-3 sm:px-4 sm:pb-4"
                          aria-label={`${label}: every team`}
                        >
                          {table.map((p, j) => {
                            const you = p.id === me;
                            return (
                              <li key={p.id} className={`grid grid-cols-[1.75rem_1fr_auto] items-center gap-x-2 rounded-lg px-2 py-1.5 text-sm ${you ? "bg-white/10 font-semibold" : ""}`}>
                                <span className="font-display tabular-nums text-[var(--muted)]">{j + 1}</span>
                                <span className="min-w-0">
                                  <span className="break-words">{nick(p.id)}{you ? " (you)" : ""}</span>
                                  <span className="mt-1 block h-1.5 rounded-full bg-white/8">
                                    <span className="block h-full rounded-full" style={{ width: `${Math.max(2, (p.m[key] / top) * 100)}%`, background: you ? tone : "rgba(246,243,234,0.45)" }} />
                                  </span>
                                </span>
                                <span className="tabular-nums text-[var(--muted)]">{fmt(p.m[key])}</span>
                              </li>
                            );
                          })}
                        </motion.ol>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ul>

            {/* advice */}
            <h3 className="font-display mt-10 text-3xl font-black">What to do</h3>
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {d.advice.map((a, i) => (
                <motion.li
                  key={a.title}
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.07 }}
                  className="rounded-2xl border border-white/10 bg-black/25 p-3 sm:p-5"
                >
                  <p className="font-display text-xl font-black sm:text-2xl">{a.title}</p>
                  <p className="mt-1 text-[13px] leading-snug text-[var(--paper)]/80 sm:text-sm sm:leading-relaxed">{a.text}</p>
                  {a.targets?.length ? (
                    <ul className="mt-3 space-y-2">
                      {a.targets.map((t) => (
                        <li key={t.pid}>
                          <button
                            type="button"
                            disabled={!t.owner}
                            onClick={() => loadTrade(t.pid, t.owner)}
                            className="flex w-full items-center gap-3 rounded-xl bg-black/25 p-2 text-left transition-colors enabled:cursor-pointer enabled:hover:bg-black/40"
                          >
                            <Head pid={t.pid} />
                            <span className="min-w-0 flex-1">
                              <span className="block break-words text-sm font-semibold">
                                {P[t.pid]?.name} <span className="font-normal text-[var(--muted)]">{P[t.pid]?.pos.join("/")}</span>
                              </span>
                              <span className="block text-xs text-[var(--muted)]">
                                {t.owner ? `${nick(t.owner)}: ${t.why}` : `Free agent, ${t.why}`}
                              </span>
                              {t.owner ? <span className="mt-0.5 block text-xs font-semibold text-[var(--wood)] sm:hidden">Analyze trade →</span> : null}
                            </span>
                            <span className="shrink-0 text-sm font-bold tabular-nums">{n0(P[t.pid]?.value ?? 0)}</span>
                            {t.owner ? <span className="hidden shrink-0 text-xs font-semibold text-[var(--wood)] sm:inline">Analyze trade</span> : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </motion.li>
              ))}
            </ul>

            {/* this team's market calls */}
            {(() => {
              const sells = mk.sell.filter((m) => m.owner === me).slice(0, 3);
              const buys = mk.buy.filter((m) => m.owner && m.owner !== me).slice(0, 3);
              if (!sells.length && !buys.length) return null;
              return (
                <div className="mt-10 grid gap-4 md:grid-cols-2">
                  {sells.length ? (
                    <MoverList title="Sell high on your team" tone="sell" items={sells} P={P} nick={nick} me={me} onAct={(m) => sellMine(m.pid)} />
                  ) : null}
                  {buys.length ? (
                    <MoverList title="Buy-low targets" tone="buy" items={buys} P={P} nick={nick} me={me} onAct={(m) => loadTrade(m.pid, m.owner)} />
                  ) : null}
                </div>
              );
            })()}

            {/* top nine + depth */}
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <section>
                <h3 className="font-display text-3xl font-black">{nfl ? "Starting lineup on paper" : "Top nine on paper"}</h3>
                <p className="text-sm text-[var(--muted)]">{n0(mine.lineup.total)} points a week at full strength</p>
                <ul className="mt-3 space-y-1.5">
                  {data.slots.map((slot, i) => {
                    const pid = mine.lineup.starters[i];
                    const p = pid ? P[pid] : null;
                    return (
                      <li key={i} className="flex items-center gap-3 rounded-xl bg-black/20 px-3 py-2">
                        <span className="w-10 text-xs font-bold text-[var(--wood)]">{slot}</span>
                        {p ? <Head pid={p.pid} size={30} /> : null}
                        <span className="min-w-0 flex-1 break-words text-sm font-semibold">{p ? p.name : "Empty"}</span>
                        {p ? <Injury p={p} /> : null}
                        <span className="text-sm tabular-nums">{p ? n0(p.value) : ""}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
              <section>
                <h3 className="font-display text-3xl font-black">Depth</h3>
                <p className="text-sm text-[var(--muted)]">
                  {nfl
                    ? "Your bench: who starts on bye weeks and when someone gets hurt."
                    : "Outside your top nine on paper. With daily swaps they still play whenever a starter sits."}
                </p>
                <ul className="mt-3 space-y-1.5">
                  {mine.lineup.bench.map((pid) => {
                    const p = P[pid];
                    return (
                      <li key={pid} className="flex items-center gap-3 rounded-xl bg-black/20 px-3 py-2">
                        <Head pid={pid} size={30} />
                        <span className="min-w-0 flex-1 break-words text-sm font-semibold">{p.name}</span>
                        <Injury p={p} />
                        <span className="text-sm tabular-nums">{n0(p.value)}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          </motion.div>
        ) : tab === "market" ? (
          <motion.div key="market" initial={{ opacity: 0, y: reduce ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="mt-8">
            <p className="max-w-[64ch] text-[var(--paper)]/85">
              Who&apos;s running hot and who&apos;s in a slump, across every roster in the league. Hot stretches cool off and slumps
              bounce back, so this is when prices are wrong.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <MoverList title="Sell high" tone="sell" items={mk.sell} P={P} nick={nick} me={me} onAct={(m) => (m.owner === me ? sellMine(m.pid) : loadTrade(m.pid, m.owner))} />
              <MoverList title="Buy low" tone="buy" items={mk.buy} P={P} nick={nick} me={me} onAct={(m) => (m.owner === me ? sellMine(m.pid) : loadTrade(m.pid, m.owner))} />
            </div>
          </motion.div>
        ) : tab === "finder" ? (
          <motion.div key={`finder-${me}`} initial={{ opacity: 0, y: reduce ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="mt-8">
            <h3 className="font-display text-3xl font-black">Trades worth sending</h3>
            <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-[var(--muted)]">
              1-for-1, 2-for-1, 1-for-2 and 2-for-2 trades with every team, kept only if your starting {nfl ? "lineup" : "nine"} gets better{" "}
              <span className="text-[var(--paper)]">and theirs stays about the same or better</span>, and you don&apos;t take more than about 15% extra
              value. So they have a reason to say yes. Players are valued for the rest of the season; nobody on IR.
            </p>
            {ideas.length ? (
              <ul className="mt-6 grid gap-3 md:grid-cols-2">
                {ideas.map((i) => (
                  <li key={i.partner + i.give.join() + i.get.join()} className="flex flex-col rounded-2xl bg-black/25 p-4 sm:p-5">
                    <p className="text-sm text-[var(--muted)]">
                      With <span className="font-semibold text-[var(--paper)]">{nick(i.partner)}</span>
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {[
                        { label: "You give", ids: i.give },
                        { label: "You get", ids: i.get },
                      ].map((col) => (
                        <div key={col.label} className="min-w-0">
                          <p className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">{col.label}</p>
                          <ul className="mt-2 space-y-2">
                            {col.ids.map((pid) => (
                              <li key={pid} className="flex items-center gap-2">
                                <Head pid={pid} size={30} />
                                <span className="min-w-0 break-words text-sm leading-tight font-semibold">
                                  {P[pid].name}
                                  <span className="block text-xs font-normal text-[var(--muted)]">
                                    {P[pid].pos.join("/")} · {n0(P[pid].value)}
                                    {P[pid].injury ? ` · ${P[pid].injury}` : ""}
                                  </span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                    <p className="mt-4 text-sm">
                      <span className="font-display text-2xl font-black tabular-nums" style={{ color: GOOD }}>
                        +{n0(i.meDelta)}
                      </span>{" "}
                      a week for your lineup,{" "}
                      <span className="font-semibold tabular-nums">{Math.abs(i.themDelta) < 0.5 ? "no change" : `${i.themDelta > 0 ? "+" : "−"}${n0(Math.abs(i.themDelta))}`}</span> for theirs
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Value: you send {n0(i.valueOut)}, you get {n0(i.valueIn)}.
                      {i.meDrops.length ? ` You'd drop ${i.meDrops.map((x) => P[x].name).join(", ")}.` : ""}
                      {i.themDrops.length ? ` They'd drop ${i.themDrops.map((x) => P[x].name).join(", ")}.` : ""}
                    </p>
                    <button
                      type="button"
                      onClick={() => openIdea(i.partner, i.give, i.get)}
                      className="mt-4 inline-flex min-h-11 cursor-pointer items-center self-start rounded-full border border-white/15 px-4 text-sm font-semibold text-[var(--wood)] transition-[background-color,transform] duration-150 hover:bg-white/5 active:scale-[0.98]"
                    >
                      Open in the trade analyzer →
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-6 rounded-2xl bg-black/20 p-5 text-[var(--muted)]">
                No trade right now makes both lineups better without overpaying. Check back after the next round of moves, or try your own
                ideas in the trade analyzer.
              </p>
            )}
          </motion.div>
        ) : (
          <motion.div key="trade" initial={{ opacity: 0, y: reduce ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="mt-6">
            <p className="mb-2 text-sm text-[var(--muted)]">Trade with</p>
            <Picker
              ids={ids.filter((x) => x !== me)}
              value={partner}
              onChange={(v) => {
                setThem(v);
                setGet([]);
              }}
              nick={nick}
              label="them"
            />
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[
                { title: `${nick(me)} gives`, team: meTeam, sel: give, set: setGive },
                { title: `${nick(partner)} gives`, team: themTeam, sel: get, set: setGet },
              ].map((col) => (
                <section key={col.title} className="rounded-2xl bg-black/20 p-4">
                  <h3 className="font-display text-2xl font-black">{col.title}</h3>
                  <ul className="mt-3 space-y-1.5">
                    {[...col.team.players]
                      .filter((id) => P[id])
                      .sort((a, b) => P[b].value - P[a].value)
                      .map((pid) => {
                        const on = col.sel.includes(pid);
                        const p = P[pid];
                        return (
                          <li key={pid}>
                            <button
                              type="button"
                              aria-pressed={on}
                              onClick={() => col.set(on ? col.sel.filter((x) => x !== pid) : [...col.sel, pid])}
                              className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-[background-color,transform] duration-150 active:scale-[0.99] ${on ? "bg-[var(--wood)]/25 ring-2 ring-[var(--wood)]" : "bg-black/20 hover:bg-black/35"}`}
                            >
                              <Head pid={pid} size={30} />
                              <span className="min-w-0 flex-1 break-words text-sm font-semibold">
                                {p.name} <span className="font-normal text-[var(--muted)]">{p.pos.join("/")}</span>
                              </span>
                              <Injury p={p} />
                              <span className="text-sm tabular-nums">{n0(p.value)}</span>
                            </button>
                          </li>
                        );
                      })}
                  </ul>
                </section>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {trade ? (
                <motion.div
                  key={give.join() + get.join()}
                  initial={{ opacity: 0, y: reduce ? 0 : 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mt-6 rounded-3xl border-2 bg-black/30 p-6"
                  style={{ borderColor: trade.verdict === "win" ? GOOD : trade.verdict === "lose" ? BAD : "rgba(255,255,255,0.2)" }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <motion.p
                      initial={reduce ? false : { scale: 2, rotate: -14, opacity: 0 }}
                      animate={{ scale: 1, rotate: -4, opacity: 1 }}
                      transition={{ type: "spring", duration: 0.5, bounce: 0.45 }}
                      className="font-display rounded-lg border-4 px-3 py-1 text-4xl font-black"
                      style={{ color: trade.verdict === "win" ? GOOD : trade.verdict === "lose" ? BAD : "var(--paper)", borderColor: "currentColor" }}
                    >
                      {trade.verdict === "win" ? "Smash accept" : trade.verdict === "lose" ? "Hang up" : "Fair deal"}
                    </motion.p>
                    <p className="text-sm">
                      {nick(partner)} would{" "}
                      <span className="font-bold" style={{ color: trade.accept === "likely" ? GOOD : trade.accept === "unlikely" ? BAD : "var(--wood)" }}>
                        {trade.accept === "likely" ? "probably say yes" : trade.accept === "maybe" ? "think about it" : "probably say no"}
                      </span>
                    </p>
                    {trade.starLoss ? (
                      <p className="text-sm text-[var(--muted)]">They&apos;d be giving up the best player in the deal without getting anyone close back. Stars win this format, so that&apos;s a no.</p>
                    ) : null}
                  </div>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    {[
                      { who: nick(me), d: trade.meDelta },
                      { who: nick(partner), d: trade.themDelta },
                    ].map((x) => (
                      <div key={x.who} className="rounded-2xl bg-black/25 p-4">
                        <p className="text-sm text-[var(--muted)]"><Handle id={x.who} />
                          {nfl ? "'s starting lineup" : "'s starting nine"}
                        </p>
                        <p className="font-display text-4xl font-black tabular-nums" style={{ color: x.d >= 0 ? GOOD : BAD }}>
                          {x.d >= 0 ? "+" : ""}
                          {n0(x.d)}
                          <span className="text-base text-[var(--muted)]"> a week</span>
                        </p>
                      </div>
                    ))}
                  </div>
                  {(() => {
                    const notes = tradeNotes(trade, give, get, P, data.slots, sport);
                    if (!notes.good.length && !notes.bad.length) return null;
                    return (
                      <div className="mt-5 grid gap-3 md:grid-cols-2">
                        {[
                          { title: "Good for you", items: notes.good, color: GOOD, mark: "+" },
                          { title: "Bad for you", items: notes.bad, color: BAD, mark: "−" },
                        ].map((col) =>
                          col.items.length ? (
                            <div key={col.title} className="rounded-2xl bg-black/25 p-4">
                              <p className="text-sm font-semibold" style={{ color: col.color }}>
                                {col.title}
                              </p>
                              <ul className="mt-2 space-y-1.5 text-sm leading-snug">
                                {col.items.map((t) => (
                                  <li key={t} className="flex gap-2">
                                    <span aria-hidden className="font-bold" style={{ color: col.color }}>
                                      {col.mark}
                                    </span>
                                    <span>{t}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null,
                        )}
                      </div>
                    );
                  })()}
                  <p className="mt-4 text-sm text-[var(--muted)]">
                    Raw value: you send {n0(trade.valueOut)} a week, you get {n0(trade.valueIn)}.{" "}
                    {trade.meDrops.length ? `You'd have to drop ${trade.meDrops.map((id) => P[id].name).join(", ")}. ` : ""}
                    {trade.themDrops.length ? `${nick(partner)} would drop ${trade.themDrops.map((id) => P[id].name).join(", ")}.` : ""}
                  </p>
                  <h4 className="mt-5 font-semibold">{nfl ? "Your new starting lineup" : "Your new starting nine"}</h4>
                  <ul className="mt-2 grid gap-1.5 sm:grid-cols-3">
                    {data.slots.map((slot, i) => {
                      const pid = trade.meAfter.starters[i];
                      const fresh = pid && get.includes(pid);
                      return (
                        <li key={i} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${fresh ? "bg-[rgba(127,212,154,0.15)] ring-1 ring-[rgba(127,212,154,0.5)]" : "bg-black/20"}`}>
                          <span className="w-9 text-[11px] font-bold text-[var(--wood)]">{slot}</span>
                          <span className="break-words">{pid ? P[pid].name : "Empty"}</span>
                        </li>
                      );
                    })}
                  </ul>
                </motion.div>
              ) : (
                <p className="mt-6 rounded-2xl border border-dashed border-white/15 p-6 text-center text-[var(--muted)]">
                  Pick at least one player from each side to see the verdict.
                </p>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <Explain>
        {nfl ? (
          <>
            <p>
              A player&apos;s value is his weekly points in this league&apos;s scoring: this season so far, blended with
              last season until there are enough games, and Sleeper&apos;s projection. Injured players count for less
              until they&apos;re back.
            </p>
            <p>
              Trades are judged by what really wins matchups: how each team&apos;s best legal starting lineup changes per
              week, so roster fit and depth are counted, not just adding up names. Within about 4 points a week is
              called fair.
            </p>
          </>
        ) : (
          <>
        <p>
          In <LeagueName /> every lineup slot counts one game a week, so a player&apos;s value is his typical best game each
          week: this season&apos;s weekly best, blended with last season (points per game × 1.3) until there are
          enough games. Injured players count for less until they&apos;re back.
        </p>
        <p>
          Trades are judged by what really wins matchups: how each team&apos;s best legal starting nine changes per
          week, so roster fit and depth are counted, not just adding up names. Within 12 points a week is called
          fair.
        </p>
          </>
        )}
      </Explain>
    </div>
      </Who.Provider>
    </LocalPhotos.Provider>
  );
}
