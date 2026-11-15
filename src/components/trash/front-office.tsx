"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { FrontOffice } from "@/lib/front-office";
import { diagnose, evaluateTrade, market, metricsFor, profile, type Metric, type Mover } from "@/lib/fo-analysis";
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
                    <p className="truncate text-sm font-semibold">
                      {p?.name} <span className="font-normal text-[var(--muted)]">{p?.pos.join("/")}</span>
                    </p>
                    <p className="truncate text-xs text-[var(--muted)]">{m.owner ? (mine ? "Your team" : nick(m.owner)) : "Free agent"}</p>
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
  const [tab, setTab] = useState<"team" | "trade" | "market">("team");
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
  const profiles = useMemo(() => data.teams.map((t) => profile(t, P, data.slots, sport)), [data, P, sport]);
  const mine = profiles.find((p) => p.id === me)!;
  const d = useMemo(() => diagnose(mine, profiles, P, data.teams, data.free, data.slots, sport), [mine, profiles, P, data, sport]);
  // The trade partner can never be your own team (e.g. after your team is restored from a past
  // visit); fall back to the first other team so the picker, titles and rosters always agree.
  const partner = them !== me && ids.includes(them) ? them : ids.find((x) => x !== me)!;
  const meTeam = data.teams.find((t) => t.id === me)!;
  const themTeam = data.teams.find((t) => t.id === partner)!;
  const trade = give.length && get.length ? evaluateTrade(give, get, meTeam, themTeam, P, data.slots, undefined, sport) : null;

  const mk = useMemo(() => market(P, data.teams, sport), [P, data, sport]);
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
    <div data-no-rico className="xmas-drift rounded-[28px] border border-white/10 bg-[rgba(16,40,30,0.55)] p-5 md:p-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Segmented id="fo-tab" value={tab} onChange={setTab} options={[["team", "Team analyzer"], ["trade", "Trade analyzer"], ["market", "Buy low / sell high"]]} />
        <p className="text-xs text-[var(--muted)]">Live Season 4 rosters, week {data.week}</p>
      </div>
      <div className="mt-6">
        <p className="mb-2 text-sm text-[var(--muted)]">Your team</p>
        <Picker ids={ids} value={me} onChange={pickMe} nick={nick} label="me" />
      </div>

      <AnimatePresence mode="wait">
        {tab === "team" ? (
          <motion.div key={`team-${me}`} initial={{ opacity: 0, y: reduce ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="mt-8">
            {/* verdict */}
            <div className="rounded-3xl border border-white/10 bg-black/25 p-6 md:p-8">
              <p className="text-sm text-[var(--muted)]">{nick(me)}&apos;s front office report</p>
              <motion.p
                initial={reduce ? false : { scale: 1.4, opacity: 0, rotate: -4 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ type: "spring", duration: 0.6, bounce: 0.35 }}
                className="font-display mt-1 text-[clamp(2.8rem,8vw,5rem)] leading-[0.9] font-black"
              >
                {d.archetype}
              </motion.p>
              <p className="mt-3 max-w-[60ch] text-lg text-[var(--paper)]/85">{d.pitch}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                {d.strengths.map((s) => (
                  <span key={s} className="rounded-full px-3 py-1 font-semibold" style={{ background: "rgba(127,212,154,0.18)", color: GOOD }}>
                    Strong: {s}
                  </span>
                ))}
                {d.weaknesses.map((s) => (
                  <span key={s} className="rounded-full px-3 py-1 font-semibold" style={{ background: "rgba(255,138,122,0.15)", color: BAD }}>
                    Lacking: {s}
                  </span>
                ))}
              </div>
            </div>

            {/* league ranks */}
            <h3 className="font-display mt-10 text-3xl font-black">Where you rank</h3>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {METRICS.map(({ key, label, info }, i) => {
                const r = d.rank[key as Metric];
                const n = profiles.length;
                const tone = r <= 3 ? GOOD : r > n - 3 ? BAD : "var(--paper)";
                return (
                  <li key={key} className="rounded-2xl bg-black/20 p-4" title={info}>
                    <div className="flex items-baseline justify-between">
                      <span className="font-semibold">{label}</span>
                      <span className="font-display text-2xl font-black tabular-nums" style={{ color: tone }}>
                        #{r}
                        <span className="text-sm text-[var(--muted)]"> of {n}</span>
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
                    <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{info}</p>
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
                  className="rounded-2xl border border-white/10 bg-black/25 p-5"
                >
                  <p className="font-display text-2xl font-black">{a.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--paper)]/80">{a.text}</p>
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
                              <span className="block truncate text-sm font-semibold">
                                {P[t.pid]?.name} <span className="font-normal text-[var(--muted)]">{P[t.pid]?.pos.join("/")}</span>
                              </span>
                              <span className="block text-xs text-[var(--muted)]">
                                {t.owner ? `${nick(t.owner)}: ${t.why}` : `Free agent, ${t.why}`}
                              </span>
                            </span>
                            <span className="text-sm font-bold tabular-nums">{n0(P[t.pid]?.value ?? 0)}</span>
                            {t.owner ? <span className="text-xs font-semibold text-[var(--wood)]">Analyze trade</span> : null}
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
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p ? p.name : "Empty"}</span>
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
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
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
                              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
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
                          <span className="truncate">{pid ? P[pid].name : "Empty"}</span>
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
