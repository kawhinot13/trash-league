"use client";

import { useCallback, useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { PlayGate } from "@/components/app/play-gate";
import { MgrPhoto } from "@/components/trash/brand";
import { buyCost, hoodiePrice, MAX_QTY, sellValue } from "@/packs/trash/market/math";
import type { MarketState } from "@/packs/trash/market/server";

/**
 * The Trash Exchange board (Trash pack only). Everyone can watch the board; trading opens for the
 * league's managers once they're signed in as themselves (the daily games' gate). Play money.
 */
type State = ({ enabled: true; me: string | null; error?: string } & Partial<MarketState>) | { enabled: false; error?: string };
type Team = MarketState["teams"][number];

const money = (h: number, dp = 2) => (h / 100).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const pct = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(1)}%`;
const UP = "text-[var(--up)]";
const DOWN = "text-[var(--down)]";

/* ── The three currencies ──────────────────────────────────────────── */
export function Bucks({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <rect x="1.5" y="5.5" width="21" height="13" rx="2.5" fill="#2f7a4f" stroke="#a9e3bd" strokeWidth="1.2" />
      <circle cx="12" cy="12" r="3.6" fill="none" stroke="#a9e3bd" strokeWidth="1.2" />
      <path d="M10.6 10.2h2a1 1 0 0 1 0 2h-2v-2Zm0 2h2.3a1 1 0 0 1 0 2h-2.3v-2Z" fill="none" stroke="#f6f3ea" strokeWidth="1" />
      <path d="M5 8.5c1-.9 2.2-.9 3 0M16 8.5c1-.9 2.2-.9 3 0" stroke="#f6f3ea" strokeWidth="1.1" strokeLinecap="round" fill="none" />
    </svg>
  );
}
export function Coin({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <circle cx="12" cy="12" r="10" fill="#c99a2e" stroke="#f3d77e" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="7" fill="none" stroke="#f3d77e" strokeWidth="0.8" strokeDasharray="1.2 1.2" />
      <path d="M10 16.5v-9h2.8a2.6 2.6 0 0 1 0 5.2H10" fill="none" stroke="#fff6d6" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
export function Hoodie({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        d="M8.5 3.5c1-.8 2.2-1.2 3.5-1.2s2.5.4 3.5 1.2l4.3 2.4c.8.4 1.3 1.2 1.4 2.1l.8 7.5-3 .6-.6-4.6V21H5.6v-9.5L5 16.1l-3-.6.8-7.5c.1-.9.6-1.7 1.4-2.1l4.3-2.4Z"
        fill="var(--hoodie)"
        stroke="#c8b0ff"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path d="M9 3.9c.4 2.2 1.5 3.4 3 3.4s2.6-1.2 3-3.4" fill="#4d2f8f" stroke="#c8b0ff" strokeWidth="0.9" />
      <path d="M11 7.6v3.2M13 7.6v3.2" stroke="#f6f3ea" strokeWidth="0.9" strokeLinecap="round" />
      <path d="M8.4 15.5h7.2v3H8.4z" fill="#5f3bb0" stroke="#c8b0ff" strokeWidth="0.7" />
    </svg>
  );
}

/* ── Pieces ────────────────────────────────────────────────────────── */
function Spark({ h, up }: { h: number[]; up: boolean }) {
  if (h.length < 2) return <span className="block h-7 w-20" aria-hidden />;
  const lo = Math.min(...h);
  const hi = Math.max(...h);
  const span = hi - lo || 1;
  const pts = h.map((v, i) => `${((i / (h.length - 1)) * 80).toFixed(1)},${(26 - ((v - lo) / span) * 22).toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 80 28" className="h-7 w-20" aria-hidden>
      <polyline points={pts} fill="none" stroke={up ? "var(--up)" : "var(--down)"} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Tape({ teams }: { teams: Team[] }) {
  const reduce = useReducedMotion();
  const items = teams.map((t) => (
    <span key={t.id} className="flex shrink-0 items-baseline gap-2 px-5">
      <span className="font-display text-lg font-black tracking-wide">{t.ticker}</span>
      <span className="tabular-nums">{money(t.price)}</span>
      <span className={`text-sm tabular-nums ${t.change >= 0 ? UP : DOWN}`}>
        {t.change >= 0 ? "▲" : "▼"} {pct(t.change)}
      </span>
    </span>
  ));
  return (
    <div className="group overflow-hidden border-y border-[var(--line)] bg-black/30 py-2.5" aria-label="Ticker">
      <div className={`flex w-max ${reduce ? "flex-wrap" : "animate-[ticker_45s_linear_infinite] group-hover:[animation-play-state:paused]"}`}>
        {items}
        {reduce ? null : <span aria-hidden className="flex">{items}</span>}
      </div>
    </div>
  );
}

const chip = "inline-flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-full px-4 text-sm font-semibold transition-[background-color,transform] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40";

function Qty({ q, setQ, max }: { q: number; setQ: (n: number) => void; max: number }) {
  const lim = Math.max(1, Math.min(MAX_QTY, max));
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" aria-label="One fewer" className={`${chip} bg-white/10 hover:bg-white/15`} onClick={() => setQ(Math.max(1, q - 1))} disabled={q <= 1}>
        −
      </button>
      <span className="min-w-10 text-center font-display text-2xl font-black tabular-nums" aria-live="polite">
        {q}
      </span>
      <button type="button" aria-label="One more" className={`${chip} bg-white/10 hover:bg-white/15`} onClick={() => setQ(Math.min(lim, q + 1))} disabled={q >= lim}>
        +
      </button>
      {[5, 10].map((n) => (
        <button key={n} type="button" className={`${chip} bg-white/5 hover:bg-white/10`} onClick={() => setQ(Math.min(lim, q + n))} disabled={q >= lim}>
          +{n}
        </button>
      ))}
    </div>
  );
}

/* ── The board ─────────────────────────────────────────────────────── */
export function MarketBoard({ leagueId }: { leagueId: string }) {
  const url = `/api/l/${leagueId}/market`;
  const [s, setS] = useState<State | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState(1);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [coinQ, setCoinQ] = useState(1);
  const [hoodQ, setHoodQ] = useState(1);

  const load = useCallback(() => {
    void fetch(url, { cache: "no-store" })
      .then((r) => r.json() as Promise<State>)
      .catch(() => ({ enabled: true, me: null, error: "The market is closed for a minute. Try again shortly." }) as State)
      .then(setS);
  }, [url]);
  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  const order = async (body: object, done: string) => {
    setBusy(true);
    setNote(null);
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const j = ((await r?.json().catch(() => null)) ?? {}) as { ok?: boolean; error?: string };
    setBusy(false);
    setNote(r?.ok && j.ok ? { ok: true, text: done } : { ok: false, text: j.error ?? "That order didn't go through. Try again." });
    load();
  };

  if (s === null) return <div aria-busy className="mx-auto h-96 max-w-6xl rounded-[28px] border border-white/10 bg-black/20" />;
  if (!s.enabled) return <p className="mx-auto max-w-6xl px-5 text-[var(--muted)] md:px-10">The exchange opens once sign-in is switched on for this site.</p>;
  if (s.error || !s.teams) return <p className="mx-auto max-w-6xl px-5 text-[var(--muted)] md:px-10">{s.error ?? "The market is closed for a minute."}</p>;

  const teams = s.teams;
  const w = s.wallet ?? null;
  const owned = (id: string) => w?.holdings.find((h) => h.team === id)?.shares ?? 0;
  const coinMax = w ? Math.floor(w.bucks / s.coinRate!) : 0;
  let hoodCost = 0;
  for (let i = 0; i < hoodQ; i++) hoodCost += hoodiePrice(s.hoodiesSold! + i);
  let hoodMax = 0;
  for (let c = 0; w && hoodMax < MAX_QTY && c + hoodiePrice(s.hoodiesSold! + hoodMax) <= w.coins; ) c += hoodiePrice(s.hoodiesSold! + hoodMax++);

  return (
    <div className="space-y-12 md:space-y-16">
      <Tape teams={teams} />

      <div className="mx-auto max-w-6xl px-5 md:px-10">
        {/* Desk: wallet and the two swaps, for managers trading as themselves. */}
        <PlayGate game="the Trash Exchange" anchor="market" primary>
          {w ? (
            <section aria-label="Your desk" className="rounded-[28px] border border-white/10 bg-[rgba(16,40,30,0.55)] p-5 md:p-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-[0.2em] text-[var(--muted)] uppercase">Your desk</p>
                  <p className="mt-1 font-display text-4xl leading-none font-black tabular-nums md:text-5xl">
                    {money(w.worth, 0)} <span className="text-xl text-[var(--muted)]">BB net worth</span>
                  </p>
                </div>
                <ul className="flex flex-wrap gap-2">
                  <li className="flex items-center gap-2 rounded-full bg-black/25 px-4 py-2">
                    <Bucks /> <span className="font-semibold tabular-nums">{money(w.bucks)}</span> <span className="text-sm text-[var(--muted)]">Bushy Bucks</span>
                  </li>
                  <li className="flex items-center gap-2 rounded-full bg-black/25 px-4 py-2">
                    <Coin /> <span className="font-semibold tabular-nums">{money(w.coins)}</span> <span className="text-sm text-[var(--muted)]">Perren Coin</span>
                  </li>
                  <li className="flex items-center gap-2 rounded-full bg-black/25 px-4 py-2">
                    <Hoodie /> <span className="font-semibold tabular-nums">{w.hoodies}</span> <span className="text-sm text-[var(--muted)]">Xan Purple Hoodies</span>
                  </li>
                </ul>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-black/20 p-4">
                  <p className="flex items-center gap-2 font-semibold">
                    <Coin /> Buy Perren Coin
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{money(s.coinRate!, 0)} Bushy Bucks each. No way back to bucks.</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <Qty q={coinQ} setQ={setCoinQ} max={coinMax} />
                    <button
                      type="button"
                      disabled={busy || coinQ > coinMax}
                      onClick={() => void order({ kind: "coin", qty: coinQ }, `Bought ${coinQ} Perren Coin.`)}
                      className={`${chip} bg-[var(--paper)] text-[var(--bin)]`}
                    >
                      Pay {money(s.coinRate! * coinQ, 0)} BB
                    </button>
                  </div>
                </div>
                <div className="rounded-2xl bg-black/20 p-4">
                  <p className="flex items-center gap-2 font-semibold">
                    <Hoodie /> Buy a Xan Purple Hoodie
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {s.hoodiesSold} sold in the league. Each one makes the next dearer, and hoodies are never sold back.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <Qty q={hoodQ} setQ={setHoodQ} max={hoodMax} />
                    <button
                      type="button"
                      disabled={busy || hoodCost > w.coins}
                      onClick={() => void order({ kind: "hoodie", qty: hoodQ }, hoodQ === 1 ? "Hoodie on. Looking good." : `${hoodQ} hoodies on.`)}
                      className={`${chip} bg-[var(--hoodie)] text-white`}
                    >
                      Pay {money(hoodCost)} PC
                    </button>
                  </div>
                </div>
              </div>
              {note ? (
                <p role="status" className={`mt-4 text-sm font-semibold ${note.ok ? UP : DOWN}`}>
                  {note.text}
                </p>
              ) : null}
            </section>
          ) : null}
        </PlayGate>
      </div>

      {/* The board */}
      <section aria-label="Teams" className="mx-auto max-w-6xl px-5 md:px-10">
        <h2 className="font-display text-3xl font-black md:text-4xl">The board</h2>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">
          One stock per team. Prices follow official points and records from Sleeper, plus how many shares the league holds. Tap a team to trade.
        </p>
        <ul className="mt-6 divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {teams.map((t) => {
            const mine = owned(t.id);
            const isOpen = open === t.id;
            const cost = buyCost(t.fair, t.held, q);
            const pay = mine >= q ? sellValue(t.fair, t.held, q) : 0;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => {
                    setOpen(isOpen ? null : t.id);
                    setQ(1);
                    setNote(null);
                  }}
                  className="grid w-full cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 py-3.5 text-left transition-colors duration-150 hover:bg-white/[0.03] md:grid-cols-[auto_1fr_auto_auto_auto] md:gap-5"
                >
                  <MgrPhoto id={t.id} alt="" width={44} height={44} className="size-11 rounded-full object-cover" />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-display text-xl font-black tracking-wide">{t.ticker}</span>
                      <span className="font-semibold break-words">{t.name}</span>
                    </span>
                    <span className="block text-sm break-words text-[var(--muted)]">
                      {t.record} · {t.pf.toLocaleString("en-US")} pts{mine ? <span className="text-[var(--paper)]"> · you own {mine}</span> : null}
                    </span>
                  </span>
                  <span className="hidden md:block">
                    <Spark h={t.history} up={t.change >= 0} />
                  </span>
                  <span className="hidden text-right text-sm text-[var(--muted)] tabular-nums md:block">{t.held} held</span>
                  <span className="text-right">
                    <span className="block font-display text-2xl leading-none font-black tabular-nums">{money(t.price)}</span>
                    <span className={`text-sm tabular-nums ${t.change >= 0 ? UP : DOWN}`}>{pct(t.change)} wk</span>
                  </span>
                </button>
                {isOpen ? (
                  <div className="pb-5">
                    {w ? (
                      <div className="flex flex-col gap-3 rounded-2xl bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <Qty q={q} setQ={setQ} max={MAX_QTY} />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy || cost > w.bucks}
                            onClick={() => void order({ kind: "buy", team: t.id, qty: q }, `Bought ${q} ${t.ticker}.`)}
                            className={`${chip} bg-[var(--paper)] text-[var(--bin)]`}
                          >
                            Buy for {money(cost)} BB
                          </button>
                          <button
                            type="button"
                            disabled={busy || mine < q}
                            onClick={() => void order({ kind: "sell", team: t.id, qty: q }, `Sold ${q} ${t.ticker}.`)}
                            className={`${chip} bg-white/10 hover:bg-white/15`}
                          >
                            {mine >= q ? `Sell for ${money(pay)} BB` : mine ? `You own ${mine}` : "Nothing to sell"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--muted)]">Sign in as yourself at the top of the page to trade.</p>
                    )}
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      Fair value {money(t.fair)} BB. Every share the league holds adds 0.4% to the price, and selling brings it back down.
                      {t.team ? ` Team: ${t.team}.` : ""}
                    </p>
                    {note && open === t.id ? (
                      <p role="status" className={`mt-2 text-sm font-semibold ${note.ok ? UP : DOWN}`}>
                        {note.text}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mx-auto grid max-w-6xl gap-12 px-5 md:grid-cols-2 md:px-10">
        <section aria-label="Standings">
          <h2 className="font-display text-3xl font-black md:text-4xl">Richest in Trash</h2>
          <p className="mt-2 text-[var(--muted)]">Most hoodies wins. Net worth breaks ties.</p>
          {s.standings!.length ? (
            <ol className="mt-5 divide-y divide-[var(--line)] border-y border-[var(--line)]">
              {s.standings!.map((r, i) => (
                <li key={r.manager} className={`flex items-center gap-3 py-3 ${r.manager === s.me ? "bg-white/[0.04]" : ""}`}>
                  <span className="w-6 text-right font-display text-xl font-black text-[var(--muted)] tabular-nums">{i + 1}</span>
                  <MgrPhoto id={r.manager} alt="" width={36} height={36} className="size-9 rounded-full object-cover" />
                  <span className="min-w-0 flex-1 font-semibold break-words">{r.name}</span>
                  <span className="flex items-center gap-1 tabular-nums">
                    <Hoodie className="size-5" /> {r.hoodies}
                  </span>
                  <span className="w-24 text-right text-sm text-[var(--muted)] tabular-nums">{money(r.worth, 0)} BB</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-5 text-[var(--muted)]">Nobody has opened a desk yet. First one in gets the cheapest hoodie.</p>
          )}
        </section>
        <section aria-label="Recent trades">
          <h2 className="font-display text-3xl font-black md:text-4xl">Floor chatter</h2>
          <p className="mt-2 text-[var(--muted)]">The latest orders in the league.</p>
          {s.feed!.length ? (
            <ul className="mt-5 space-y-2.5">
              {s.feed!.map((f, i) => (
                <li key={i} className="text-sm">
                  <span className="font-semibold">{f.name}</span>{" "}
                  <span className="text-[var(--muted)]">
                    {f.kind === "buy"
                      ? `bought ${f.qty} ${f.ticker}`
                      : f.kind === "sell"
                        ? `sold ${f.qty} ${f.ticker}`
                        : f.kind === "coin"
                          ? `swapped into ${f.qty} Perren Coin`
                          : `bought ${f.qty === 1 ? "a Xan Purple Hoodie" : `${f.qty} Xan Purple Hoodies`}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 text-[var(--muted)]">Quiet on the floor. For now.</p>
          )}
        </section>
      </div>

      <section aria-label="How it works" className="mx-auto max-w-6xl px-5 md:px-10">
        <h2 className="font-display text-3xl font-black md:text-4xl">How it works</h2>
        <ul className="mt-5 grid gap-4 md:grid-cols-3">
          <li className="rounded-2xl bg-black/20 p-5">
            <p className="flex items-center gap-2 font-semibold">
              <Bucks /> Bushy Bucks
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Everyone starts with 1,000. Buy shares in any team, yours included. A team&apos;s price rises with its official points and record, and
              with demand.
            </p>
          </li>
          <li className="rounded-2xl bg-black/20 p-5">
            <p className="flex items-center gap-2 font-semibold">
              <Coin /> Perren Coin
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Paid out when a week goes final: 1 coin for every share you hold in a team that won (half for a tie). You can also swap bucks for coin.
            </p>
          </li>
          <li className="rounded-2xl bg-black/20 p-5">
            <p className="flex items-center gap-2 font-semibold">
              <Hoodie /> Xan Purple Hoodies
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Bought with Perren Coin, kept forever. Every hoodie sold raises the price of the next one, so early buyers get a deal.
            </p>
          </li>
        </ul>
        <p className="mt-5 text-xs text-[var(--muted)]">Play money, just for Trash. None of it can be bought, sold or cashed out for anything real. Resets each season.</p>
      </section>
    </div>
  );
}
