"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useReducedMotion } from "motion/react";
import { PlayGate } from "@/components/app/play-gate";
import { LivePlayerPhoto, MgrPhoto } from "@/components/trash/brand";
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
type Pt = { d: string; p: number; w?: number };
/** A point's label: rebuilt week ends say which week, saved days say the date. */
const label = (x: Pt) => (x.w === undefined ? day(x.d) : x.w === 0 ? "Season start" : `After week ${x.w}`);

function Spark({ h, up }: { h: Pt[]; up: boolean }) {
  if (h.length < 2) return <span className="block h-7 w-14 md:w-20" aria-hidden />;
  const v = h.map((x) => x.p);
  const lo = Math.min(...v);
  const span = Math.max(...v) - lo || 1;
  const pts = v.map((y, i) => `${((i / (v.length - 1)) * 80).toFixed(1)},${(26 - ((y - lo) / span) * 22).toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 80 28" preserveAspectRatio="none" className="h-7 w-14 md:w-20" aria-hidden>
      <polyline points={pts} fill="none" stroke={up ? "var(--up)" : "var(--down)"} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const RANGES = [
  ["1W", 7],
  ["1M", 31],
  ["All", 0],
] as const;

/** A team's price over time: line + soft area, with a crosshair and readout on hover or touch. */
function PriceChart({ h, ticker, empty, note }: { h: Pt[]; ticker: string; empty?: string; note?: string }) {
  const [range, setRange] = useState<(typeof RANGES)[number][0]>("All");
  const [hover, setHover] = useState<number | null>(null);
  const gid = `fill-${ticker.replace(/[^A-Za-z0-9]/g, "")}`;
  const days = RANGES.find((r) => r[0] === range)![1];
  // Counted back from the latest price, so the range is the same whenever the page is open.
  const end = h.length ? Date.parse(`${h[h.length - 1].d}T12:00:00Z`) : 0;
  const cut = days ? new Date(end - days * 86_400_000).toISOString().slice(0, 10) : "";
  const pts = days ? h.filter((x) => x.d >= cut) : h;
  if (h.length < 2)
    return <p className="rounded-2xl bg-black/20 p-4 text-sm text-[var(--muted)]">{empty ?? `${ticker}'s chart fills in day by day, from the nightly official totals.`}</p>;
  const data = pts.length >= 2 ? pts : h.slice(-2);
  const v = data.map((x) => x.p);
  const lo0 = Math.min(...v);
  const hi0 = Math.max(...v);
  const pad = Math.max((hi0 - lo0) * 0.12, hi0 * 0.01);
  const lo = lo0 - pad;
  const hi = hi0 + pad;
  const X = (i: number) => (i / (data.length - 1)) * 100;
  const Y = (p: number) => 100 - ((p - lo) / (hi - lo)) * 100;
  const line = data.map((x, i) => `${i ? "L" : "M"}${X(i).toFixed(2)},${Y(x.p).toFixed(2)}`).join(" ");
  const first = data[0].p;
  const last = data[data.length - 1].p;
  const up = last >= first;
  const color = up ? "var(--up)" : "var(--down)";
  const sel = hover === null ? null : data[hover];
  const ticks = [hi0, (hi0 + lo0) / 2, lo0];
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setHover(Math.round(f * (data.length - 1)));
  };
  return (
    <figure className="rounded-2xl bg-black/20 p-4 select-none [-webkit-touch-callout:none] [-webkit-user-select:none]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <figcaption>
          <span className="block text-xs font-semibold tracking-[0.2em] text-[var(--muted)] uppercase">{sel ? label(sel) : `${ticker} · ${range === "All" ? "season" : range}`}</span>
          <span className="font-display text-3xl leading-none font-black tabular-nums">{money(sel ? sel.p : last)}</span>{" "}
          <span className={`text-sm tabular-nums ${up ? UP : DOWN}`}>{pct((sel ? sel.p : last) / first - 1)}</span>
        </figcaption>
        <div role="group" aria-label="Time range" className="flex gap-1 rounded-full bg-black/25 p-1">
          {RANGES.map(([k]) => (
            <button
              key={k}
              type="button"
              aria-pressed={range === k}
              onClick={() => setRange(k)}
              className={`h-9 min-w-11 cursor-pointer rounded-full px-3 text-sm font-semibold transition-colors duration-150 ${range === k ? "bg-[var(--paper)] text-[var(--bin)]" : "text-[var(--muted)] hover:text-[var(--paper)]"}`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <div
          className="relative h-40 flex-1 touch-pan-y select-none md:h-48"
          onContextMenu={(e) => e.preventDefault()}
          onPointerMove={move}
          onPointerDown={move}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={`${ticker} price from ${money(first)} (${label(data[0])}) to ${money(last)} (${label(data[data.length - 1])}), low ${money(lo0)}, high ${money(hi0)}.`}
        >
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
            <defs>
              <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {ticks.map((t, i) => (
              <line key={i} x1="0" x2="100" y1={Y(t)} y2={Y(t)} stroke="var(--line)" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
            ))}
            <path d={`${line} L100,100 L0,100 Z`} fill={`url(#${gid})`} />
            <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {sel ? (
            <>
              <span aria-hidden className="pointer-events-none absolute inset-y-0 w-px bg-[var(--paper)]/40" style={{ left: `${X(hover!)}%` }} />
              <span
                aria-hidden
                className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--bin)]"
                style={{ left: `${X(hover!)}%`, top: `${Y(sel.p)}%`, background: color }}
              />
            </>
          ) : null}
        </div>
        <div aria-hidden className="relative h-40 w-12 shrink-0 text-right text-xs text-[var(--muted)] tabular-nums md:h-48">
          {ticks.map((t, i) => (
            <span key={i} className="absolute right-0 -translate-y-1/2" style={{ top: `${Y(t)}%` }}>
              {money(t, 0)}
            </span>
          ))}
        </div>
      </div>
      <div aria-hidden className="mt-2 flex justify-between pr-14 text-xs text-[var(--muted)]">
        <span>{label(data[0])}</span>
        <span>{label(data[data.length - 1])}</span>
      </div>
      {note || data.some((x) => x.w !== undefined) ? (
        <p className="mt-2 text-xs text-[var(--muted)]">
          {note ?? "Weeks before the nightly saves began are rebuilt from the official records and Sleeper's weekly scores (per Sleeper), scaled to match the official totals."}
        </p>
      ) : null}
    </figure>
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

type Entry = MarketState["feed"][number];
/** One ledger line, in plain words, with what changed hands. */
function ledgerLine(f: Entry) {
  const amt = money(f.amount);
  if (f.kind === "buy") return `bought ${f.qty} ${f.ticker} for ${amt} BB`;
  if (f.kind === "sell") return `sold ${f.qty} ${f.ticker} for ${amt} BB`;
  if (f.kind === "short") return `shorted ${f.qty} ${f.ticker}, putting up ${amt} BB`;
  if (f.kind === "reprice")
    return f.sign >= 0
      ? `got ${amt} BB back: past player trades re-priced with today's pricing`
      : `gave back ${amt} BB: past player trades re-priced with today's pricing`;
  if (f.kind === "q-buy") return `ordered ${f.qty} ${f.ticker} at Monday's price (${amt} BB set aside)`;
  if (f.kind === "q-sell") return `ordered to sell ${f.qty} ${f.ticker} at Monday's price`;
  if (f.kind === "q-cover") return `ordered to close a ${f.qty}-share ${f.ticker} short at Monday's price`;
  if (f.kind === "shortq") return `placed a ${f.qty}-share ${f.ticker} short to open at next week's price (${amt} BB set aside)`;
  if (f.kind === "cancel") return `cancelled a waiting ${f.ticker} short (${amt} BB back)`;
  if (f.kind === "cover") return `closed a ${f.qty}-share ${f.ticker} short for ${amt} BB`;
  if (f.kind === "coin") return `swapped ${amt} BB for ${f.qty} Perren Coin`;
  if (f.kind === "uncoin") return `cashed ${f.qty} Perren Coin into ${amt} BB`;
  if (f.kind === "dividend" && f.ticker === "STORM")
    return `got ${amt} Perren Coin from The Great Storm${f.stormWeek ? " (Storm week: both won, ×1.5)" : ""} (${f.qty} shares)`;
  if (f.kind === "dividend")
    return f.upset
      ? `got ${amt} Perren Coin: ${f.ticker} beat ${f.upset.vs ?? "their opponent"}, ×${f.upset.x.toFixed(2)} (${f.qty} shares)`
      : `got ${amt} Perren Coin from ${f.ticker}'s win (${f.qty} shares)`;
  return `bought ${f.qty === 1 ? "a Xan Purple Hoodie" : `${f.qty} Xan Purple Hoodies`} for ${amt} PC`;
}
const when = (at: string) =>
  new Date(at).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

type Folio = NonNullable<MarketState["portfolios"]>[string];
function Portfolio({ name, id, p, onClose }: { name: string; id: string; p: Folio; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  const Line = ({ label, value, gain, tag }: { label: string; value: number; gain: number; tag?: string }) => (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 py-2.5">
      <span className="min-w-0 break-words">
        {tag ? <span className="mr-1.5 rounded bg-[var(--down)]/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-[var(--down)] uppercase">{tag}</span> : null}
        {label}
      </span>
      <span className="tabular-nums">
        <span className="font-semibold">{money(value)} BB</span>{" "}
        <span className={`text-sm ${gain >= 0 ? UP : DOWN}`}>
          {gain >= 0 ? "+" : "−"}
          {money(Math.abs(gain))}
        </span>
      </span>
    </li>
  );
  const up = [...p.holdings, ...p.shorts].reduce((t, h) => t + h.gain, 0);
  // Rendered on <body> so no parent's stacking (or the phone tab bar) can sit on top of it.
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${name}'s portfolio`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-[28px] border border-white/10 bg-[var(--bin-2)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-[28px] md:p-7"
      >
        <div className="flex items-center gap-3">
          <MgrPhoto id={id} alt="" width={44} height={44} className="size-11 rounded-full object-cover" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-[0.2em] text-[var(--muted)] uppercase">Portfolio</p>
            <p className="font-display text-3xl leading-none font-black break-words">{name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`${chip} bg-white/10 hover:bg-white/15`}>
            ✕
          </button>
        </div>
        <p className="mt-4 font-display text-4xl leading-none font-black tabular-nums">
          {money(p.worth, 0)} <span className="text-lg text-[var(--muted)]">BB net worth</span>
        </p>
        <ul className="mt-3 flex flex-wrap gap-2 text-sm">
          <li className="flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-1.5">
            <Bucks className="size-4" /> {money(p.bucks)}
          </li>
          <li className="flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-1.5">
            <Coin className="size-4" /> {money(p.coins)}
          </li>
          <li className="flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-1.5">
            <Hoodie className="size-4" /> {p.hoodies}
          </li>
        </ul>
        <p className="mt-5 flex flex-wrap items-baseline justify-between gap-x-3 text-xs font-semibold tracking-[0.2em] text-[var(--muted)] uppercase">
          <span>Holdings</span>
          {p.holdings.length || p.shorts.length ? (
            <span className={`tracking-normal normal-case ${up >= 0 ? UP : DOWN}`}>
              {up >= 0 ? "Up " : "Down "}
              {money(Math.abs(up))} BB overall
            </span>
          ) : null}
        </p>
        {p.holdings.length || p.shorts.length ? (
          <ul className="mt-1 divide-y divide-[var(--line)]">
            {p.holdings.map((h) => (
              <Line key={h.asset} label={`${h.name} · ${h.shares} ${h.shares === 1 ? "share" : "shares"}`} value={h.value} gain={h.gain} />
            ))}
            {p.shorts.map((h, i) => (
              <Line key={`s${i}`} tag="Short" label={`${h.name} · ${h.shares} ${h.shares === 1 ? "share" : "shares"}`} value={h.value} gain={h.gain} />
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-[var(--muted)]">Nothing on the books. All cash.</p>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Where a desk's money sits, as a donut (fixed slot order; validated categorical palette, dark). */
const MIX = [
  ["Bushy Bucks", "#3987e5"],
  ["Teams", "#d95926"],
  ["Players", "#199e70"],
  ["Perren Coin", "#c98500"],
  ["Companies", "#d55181"],
  ["Shorts", "#9085e9"],
] as const;
function Mix({ parts, total }: { parts: number[]; total: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const sum = parts.reduce((a, b) => a + b, 0);
  if (sum <= 0) return null;
  const R = 42;
  const C = 2 * Math.PI * R;
  const lens = parts.map((v) => (v / sum) * C);
  const arcs = lens.map((len, i) => ({ i, len, at: lens.slice(0, i).reduce((a, b) => a + b, 0) }));
  const sel = hover === null ? null : { name: MIX[hover][0], v: parts[hover] };
  return (
    <figure className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative size-40 shrink-0">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label={`Portfolio mix: ${MIX.map(([n], i) => (parts[i] > 0 ? `${n} ${Math.round((parts[i] / sum) * 100)}%` : null)).filter(Boolean).join(", ")}`}>
          {arcs
            .filter((a) => a.len > 0)
            .map((a) => (
              <circle
                key={a.i}
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke={MIX[a.i][1]}
                strokeWidth={hover === a.i ? 14 : 12}
                strokeDasharray={`${Math.max(0, a.len - (parts.filter((x) => x > 0).length > 1 ? 1.2 : 0))} ${C}`}
                strokeDashoffset={-a.at}
                onPointerEnter={() => setHover(a.i)}
                onPointerLeave={() => setHover(null)}
                onClick={() => setHover(hover === a.i ? null : a.i)}
                className="cursor-pointer transition-[stroke-width] duration-150"
              />
            ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-semibold tracking-[0.2em] text-[var(--muted)] uppercase">{sel ? sel.name : "Net worth"}</span>
          <span className="font-display text-2xl leading-none font-black tabular-nums">{money(sel ? sel.v : total, 0)}</span>
          <span className="text-[10px] text-[var(--muted)]">{sel ? `${Math.round((sel.v / sum) * 100)}%` : "BB"}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-2.5 text-sm">
        {MIX.map(([name, color], i) =>
          parts[i] > 0 ? (
            <li
              key={name}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              className={`transition-opacity duration-150 ${hover !== null && hover !== i ? "opacity-50" : ""}`}
            >
              <div className="flex items-baseline gap-2">
                <span aria-hidden className="size-2.5 shrink-0 self-center rounded-full" style={{ background: color }} />
                <span className="min-w-0 flex-1 break-words">{name}</span>
                <span className="text-[var(--muted)] tabular-nums">{money(parts[i], 0)} BB</span>
                <span className="w-10 text-right font-semibold tabular-nums">{Math.round((parts[i] / sum) * 100)}%</span>
              </div>
              <div aria-hidden className="mt-1 ml-[18px] h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full" style={{ width: `${(parts[i] / sum) * 100}%`, background: color }} />
              </div>
            </li>
          ) : null,
        )}
      </ul>
    </figure>
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
  const [allFeed, setAllFeed] = useState(false);
  const [tab, setTab] = useState<"teams" | "players" | "companies">("teams");
  const [find, setFind] = useState("");
  const [shown, setShown] = useState(25);
  const [sort, setSort] = useState<"price" | "up" | "down">("price");
  const [peek, setPeek] = useState<string | null>(null);

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
  // Shorts: put up the stats-only value; closing pays 2x that minus the value then (0 to 2x).
  const shortOf = (id: string) => w?.shorts?.find((x) => x.asset === id);
  const shortControls = (id: string, fairNow: number, label: string, blocked: string | null) => {
    if (!w) return null;
    const sh = shortOf(id);
    const put = fairNow * q;
    const back = sh && sh.shares >= q ? Math.round((sh.value / sh.shares) * q) : 0;
    return (
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3">
        <span className="mr-auto text-xs text-[var(--muted)]">
          {sh?.shares ? `You're short ${sh.shares} (worth ${money(sh.value)} BB to close). ` : !sh?.waiting ? "Think it's due to drop? Short it. " : ""}
          {sh?.waiting ? `${sh.waiting} waiting to open at next week's price (${money(sh.waitingPut)} BB set aside). ` : ""}
        </span>
        <button
          type="button"
          disabled={busy || !!blocked || put > w.bucks}
          onClick={() => void order({ kind: "short", team: id, qty: q }, `Shorted ${q} ${label}.`)}
          className={`${chip} border border-[var(--down)]/40 text-[var(--down)] hover:bg-white/5`}
        >
          {blocked ?? `Short for ${money(put)} BB`}
        </button>
        {sh?.waiting || w.orders?.some((x) => x.asset === id) ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void order({ kind: "cancel", team: id, qty: 1 }, `Cancelled what was waiting on ${label}.`)}
            className={`${chip} bg-white/10 hover:bg-white/15`}
          >
            Cancel waiting
          </button>
        ) : null}
        {sh?.shares ? (
          <button
            type="button"
            disabled={busy || sh.shares < q || blocked === "Locked: game on" || blocked === "Opens Monday"}
            onClick={() => void order({ kind: "cover", team: id, qty: q }, `Closed ${q} ${label} short.`)}
            className={`${chip} bg-white/10 hover:bg-white/15`}
          >
            {blocked === "Opens Monday" ? "Close opens Monday" : sh.shares >= q ? `Close for ${money(back)} BB` : `Short ${sh.shares}`}
          </button>
        ) : null}
      </div>
    );
  };
  // Shares bought this week don't earn this week's coin (they start next week).
  const fresh = (id: string) => {
    const h = w?.holdings.find((x) => x.team === id);
    return h ? h.shares - h.counting : 0;
  };
  // The stepper goes as high as either direction allows (buying with bucks, or cashing coin in).
  const coinMax = w ? Math.max(Math.floor(w.bucks / s.coinRate!), Math.floor(w.coins / 100)) : 0;
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
              <div className="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              {/* Holdings: what you own, what it's worth now, and how it's done. */}
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-[0.2em] text-[var(--muted)] uppercase">Your holdings</p>
                {w.holdings.length ? (
                  <ul className="mt-2 divide-y divide-[var(--line)] rounded-2xl bg-black/20">
                    {[...w.holdings].sort((a, b) => b.value - a.value).map((h) => {
                      const gain = h.value - h.invested;
                      return (
                        <li key={h.team}>
                          <button
                            type="button"
                            onClick={() => {
                              setTab(h.kind === "player" ? "players" : h.kind === "storm" ? "companies" : "teams");
                              // Players: search him so he's on the list (it only shows the first 25).
                              setFind(h.kind === "player" ? h.name : "");
                              setOpen(h.team);
                              setQ(1);
                              setNote(null);
                              setTimeout(() => document.getElementById(h.kind === "storm" ? "asset-storm" : `asset-${h.team}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
                            }}
                            className="flex w-full cursor-pointer flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-3 text-left transition-colors duration-150 hover:bg-white/[0.04]"
                          >
                            <span className="min-w-0">
                              <span className="font-semibold break-words">{h.name}</span>{" "}
                              <span className="text-sm text-[var(--muted)]">
                                {h.shares} {h.shares === 1 ? "share" : "shares"}

                              </span>
                            </span>
                            <span className="text-right tabular-nums">
                              <span className="font-semibold">{money(h.value)} BB</span>{" "}
                              <span className={`text-sm ${gain >= 0 ? UP : DOWN}`}>
                                {gain >= 0 ? "+" : "−"}
                                {money(Math.abs(gain))}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-[var(--muted)]">Nothing yet. Pick a team or a player on the board below.</p>
                )}
                {w.shorts?.length ? (
                  <ul className="mt-2 divide-y divide-[var(--line)] rounded-2xl bg-black/20">
                    {w.shorts.map((sh) => {
                      const gain = sh.value - sh.put;
                      const shownValue = sh.value + sh.waitingPut;
                      return (
                        <li key={sh.asset} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-3">
                          <span className="min-w-0">
                            <span className="mr-1.5 rounded bg-[var(--down)]/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-[var(--down)] uppercase">Short</span>
                            <span className="font-semibold break-words">{sh.name}</span>{" "}
                            <span className="text-sm text-[var(--muted)]">
                              {sh.shares ? `${sh.shares} ${sh.shares === 1 ? "share" : "shares"}` : ""}
                              {sh.waiting ? `${sh.shares ? " · " : ""}${sh.waiting} waiting for next week` : ""}
                            </span>
                          </span>
                          <span className="text-right tabular-nums">
                            <span className="font-semibold">{money(shownValue)} BB</span>{" "}
                            <span className={`text-sm ${gain >= 0 ? UP : DOWN}`}>
                              {gain >= 0 ? "+" : "−"}
                              {money(Math.abs(gain))}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
              {/* Portfolio mix: where your money sits. */}
              {(() => {
                const by = (k: string) => w.holdings.filter((h) => h.kind === k).reduce((t, h) => t + h.value, 0);
                const parts = [w.bucks, by("team"), by("player"), Math.round((w.coins * (s.coinBack ?? 3000)) / 100), by("storm"), (w.shorts ?? []).reduce((t, x) => t + x.value, 0)];
                return parts.some((x, i) => i > 0 && x > 0) ? (
                  <div className="rounded-2xl bg-black/20 p-4 md:p-5">
                    <p className="mb-4 text-xs font-semibold tracking-[0.2em] text-[var(--muted)] uppercase">Portfolio mix</p>
                    <Mix parts={parts} total={w.worth} />
                    <p className="mt-4 text-xs text-[var(--muted)]">Coin at what cashing it in pays. Hoodies aren&apos;t counted: they&apos;re never sold.</p>
                  </div>
                ) : null;
              })()}
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-black/20 p-4">
                  <p className="flex items-center gap-2 font-semibold">
                    <Coin /> Swap Perren Coin
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">Buy at {money(s.coinRate!, 0)} Bushy Bucks a coin, cash in at {money(s.coinBack!, 0)}. Coin goes furthest on hoodies.</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <Qty q={coinQ} setQ={setCoinQ} max={coinMax} />
                    <button
                      type="button"
                      disabled={busy || s.coinRate! * coinQ > w.bucks}
                      onClick={() => void order({ kind: "coin", qty: coinQ }, `Bought ${coinQ} Perren Coin.`)}
                      className={`${chip} bg-[var(--paper)] text-[var(--bin)]`}
                    >
                      Buy for {money(s.coinRate! * coinQ, 0)} BB
                    </button>
                    <button
                      type="button"
                      disabled={busy || coinQ * 100 > w.coins}
                      onClick={() => void order({ kind: "uncoin", qty: coinQ }, `Cashed ${coinQ} Perren Coin into ${money(s.coinBack! * coinQ, 0)} Bushy Bucks.`)}
                      className={`${chip} bg-white/10 hover:bg-white/15`}
                    >
                      Cash in for {money(s.coinBack! * coinQ, 0)} BB
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

      {/* The board: teams or players */}
      <div className="mx-auto max-w-6xl px-5 md:px-10">
        <div role="tablist" aria-label="Board" className="inline-flex flex-wrap gap-1 rounded-full bg-black/25 p-1">
          {(["teams", "players", "companies"] as const).map((k) => (
            <button
              key={k}
              role="tab"
              type="button"
              aria-selected={tab === k}
              onClick={() => {
                setTab(k);
                setOpen(null);
                setNote(null);
              }}
              className={`h-11 cursor-pointer rounded-full px-5 text-sm font-semibold transition-colors duration-150 ${tab === k ? "bg-[var(--paper)] text-[var(--bin)]" : "text-[var(--muted)] hover:text-[var(--paper)]"}`}
            >
              {k === "teams" ? "Teams" : k === "players" ? "Players" : "Companies"}
            </button>
          ))}
        </div>
      </div>
      {tab === "teams" ? (
      <section aria-label="Teams" className="mx-auto max-w-6xl px-5 md:px-10">
        <h2 className="font-display text-3xl font-black md:text-4xl">The board</h2>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">
          One stock per team. Prices follow official points and records from Sleeper, plus how many shares the league holds. Tap a team to trade.
        </p>
        {(() => {
          // Over/under-performing: actual wins against what official points for and against suggest.
          const byLuck = [...teams].filter((t) => Math.abs(t.luck) >= 0.3).sort((a, b) => b.luck - a.luck);
          const over = byLuck.filter((t) => t.luck > 0).slice(0, 3);
          const under = byLuck.filter((t) => t.luck < 0).reverse().slice(0, 3);
          if (!over.length && !under.length) return null;
          const Row = ({ t }: { t: Team }) => (
            <li className="flex items-baseline justify-between gap-3 py-1.5">
              <span className="min-w-0 break-words">
                <span className="font-display text-lg font-black tracking-wide">{t.ticker}</span> <span className="text-sm text-[var(--muted)]">{t.record}</span>
              </span>
              <span className={`text-sm font-semibold tabular-nums ${t.luck > 0 ? UP : DOWN}`}>
                {t.luck > 0 ? "+" : "−"}
                {Math.abs(t.luck).toFixed(1)} wins
              </span>
            </li>
          );
          return (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-black/20 p-4">
                <p className="text-xs font-semibold tracking-[0.2em] text-[var(--muted)] uppercase">Over-performing</p>
                <p className="mt-1 text-xs text-[var(--muted)]">More wins than their points suggest. Due for a cool-off?</p>
                <ul className="mt-2">{over.length ? over.map((t) => <Row key={t.id} t={t} />) : <li className="py-1.5 text-sm text-[var(--muted)]">Nobody yet.</li>}</ul>
              </div>
              <div className="rounded-2xl bg-black/20 p-4">
                <p className="text-xs font-semibold tracking-[0.2em] text-[var(--muted)] uppercase">Under-performing</p>
                <p className="mt-1 text-xs text-[var(--muted)]">Fewer wins than their points suggest. Buy-low candidates.</p>
                <ul className="mt-2">{under.length ? under.map((t) => <Row key={t.id} t={t} />) : <li className="py-1.5 text-sm text-[var(--muted)]">Nobody yet.</li>}</ul>
              </div>
            </div>
          );
        })()}
        <ul className="mt-6 divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {teams.map((t) => {
            const mine = owned(t.id);
            const isOpen = open === t.id;
            const cost = buyCost(t.fair, t.held, q);
            const pay = mine >= q ? sellValue(t.fair, t.held, q) : 0;
            return (
              <li key={t.id} id={`asset-${t.id}`} className="scroll-mt-28">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => {
                    setOpen(isOpen ? null : t.id);
                    setQ(1);
                    setNote(null);
                  }}
                  className="grid w-full cursor-pointer grid-cols-[auto_1fr_auto_auto] items-center gap-3 py-3.5 text-left transition-colors duration-150 hover:bg-white/[0.03] md:grid-cols-[auto_1fr_auto_auto_auto] md:gap-5"
                >
                  <MgrPhoto id={t.id} alt="" width={44} height={44} className="size-11 rounded-full object-cover" />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-display text-xl font-black tracking-wide">{t.ticker}</span>
                      <span className="font-semibold break-words">{t.name}</span>
                    </span>
                    <span className="block text-sm break-words text-[var(--muted)]">
                      {t.record} · {t.pf.toLocaleString("en-US")} pts · expected {t.xw.toFixed(1)} wins{mine ? <span className="text-[var(--paper)]"> · you own {mine}</span> : null}
                      {t.vs ? (
                        <span className="block">
                          vs {t.vs.ticker} · a win pays{" "}
                          <span className={t.vs.winPays > 100 ? "font-semibold text-[var(--paper)]" : ""}>{money(t.vs.winPays)} PC</span> a share
                        </span>
                      ) : null}
                      {false && fresh(t.id) ? <span className="ml-1.5 inline-block rounded-full bg-white/10 px-2 py-0.5 text-xs text-[var(--paper)]">{fresh(t.id)} count next week</span> : null}
                    </span>
                  </span>
                  <span>
                    <Spark h={t.history} up={t.change >= 0} />
                  </span>
                  <span className="hidden text-right text-sm text-[var(--muted)] tabular-nums md:block">{t.held} held</span>
                  <span className="text-right">
                    <span className="block font-display text-2xl leading-none font-black tabular-nums">{money(t.price)}</span>
                    <span className={`text-sm tabular-nums ${t.change >= 0 ? UP : DOWN}`}>{pct(t.change)} wk</span>
                  </span>
                </button>
                {isOpen ? (
                  <div className="space-y-3 pb-5">
                    <PriceChart h={t.history} ticker={t.ticker} />
                    {w ? (
                      <div className="flex flex-col gap-3 rounded-2xl bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <Qty q={q} setQ={setQ} max={MAX_QTY} />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy || cost > w.bucks || t.id === s.me || !s.teamWindow}
                            onClick={() => void order({ kind: "buy", team: t.id, qty: q }, `Bought ${q} ${t.ticker}.`)}
                            className={`${chip} bg-[var(--paper)] text-[var(--bin)]`}
                          >
                            {t.id === s.me ? "Can't buy your own team" : s.teamWindow ? `Buy for ${money(cost)} BB` : "Opens Monday"}
                          </button>
                          <button
                            type="button"
                            disabled={busy || mine < q || !s.teamWindow}
                            onClick={() => void order({ kind: "sell", team: t.id, qty: q }, `Sold ${q} ${t.ticker}.`)}
                            className={`${chip} bg-white/10 hover:bg-white/15`}
                          >
                            {!s.teamWindow ? (mine ? `Sell opens Monday` : "Nothing to sell") : mine >= q ? `Sell for ${money(pay)} BB` : mine ? `You own ${mine}` : "Nothing to sell"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {w && !s.teamWindow ? (
                      <p className="text-xs text-[var(--muted)]">
                        Team stocks trade on Mondays before 7 PM Eastern, once last week&apos;s results are in. Closed the rest of the week.
                      </p>
                    ) : null}
                    {w ? shortControls(t.id, t.fair, t.ticker, t.id === s.me ? "Can't short your own team" : !s.teamWindow ? "Opens Monday" : null) : (
                      <p className="text-sm text-[var(--muted)]">Sign in as yourself at the top of the page to trade.</p>
                    )}
                    <p className="text-xs text-[var(--muted)]">
                      Shares bought now earn Perren Coin starting next week (weeks start Monday). Fair value {money(t.fair)} BB. Every share the league holds adds 0.4% to the price, and selling brings it back down. Expected wins: what official points for and against suggest.
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
      ) : tab === "players" ? (
        <section aria-label="Players" className="mx-auto max-w-6xl px-5 md:px-10">
          <h2 className="font-display text-3xl font-black md:text-4xl">Player stocks</h2>
          <p className="mt-2 max-w-2xl text-[var(--muted)]">
            Every active NBA player, on a Trash roster or not (NBA free agents aren&apos;t listed). A share costs his fantasy points a game, 60% his last 5 games and 40% his season, scored with Trash&apos;s settings from real
            box scores. Player stocks pay no coin: buy low, sell high. A player locks once his game starts and reopens at 6 AM Eastern the next day.
          </p>
          <label htmlFor="find-player" className="sr-only">
            Find a player
          </label>
          <input
            id="find-player"
            value={find}
            onChange={(e) => {
              setFind(e.target.value);
              setShown(25);
            }}
            placeholder="Find a player, NBA team or manager"
            autoComplete="off"
            className="mt-5 h-12 w-full max-w-md rounded-full border border-[var(--line)] bg-[var(--bin-2)] px-5 text-base placeholder:text-[var(--muted)] focus:border-[var(--wood)] focus:outline-none"
          />
          <div role="group" aria-label="Sort players" className="mt-3 flex flex-wrap gap-2">
            {(
              [
                ["price", "Top price"],
                ["up", "Trending up ▲"],
                ["down", "Trending down ▼"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={sort === k}
                onClick={() => {
                  setSort(k);
                  setShown(25);
                  setOpen(null);
                }}
                className={`h-10 cursor-pointer rounded-full px-4 text-sm font-semibold transition-colors duration-150 ${sort === k ? "bg-[var(--paper)] text-[var(--bin)]" : "bg-white/10 text-[var(--muted)] hover:text-[var(--paper)]"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {(() => {
            const qx = find.trim().toLowerCase();
            const found = (s.players ?? []).filter((p) => !qx || `${p.name} ${p.nba} ${p.owner ?? ""}`.toLowerCase().includes(qx));
            // Trending: biggest change in price over the last 7 days (players with a week of history first).
            const list =
              sort === "price"
                ? found
                : [...found].sort((a, b) => (sort === "up" ? b.change - a.change : a.change - b.change) || b.price - a.price);
            return (
              <>
                <ul className="mt-5 divide-y divide-[var(--line)] border-y border-[var(--line)]">
                  {list.slice(0, shown).map((p) => {
                    const mine = owned(p.id);
                    const isOpen = open === p.id;
                    const cost = buyCost(p.fair, p.held, q);
                    const pay = mine >= q ? sellValue(p.fair, p.held, q) : 0;
                    return (
                      <li key={p.id} id={`asset-${p.id}`} className="scroll-mt-28">
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          onClick={() => {
                            setOpen(isOpen ? null : p.id);
                            setQ(1);
                            setNote(null);
                          }}
                          className="grid w-full cursor-pointer grid-cols-[auto_1fr_auto_auto] items-center gap-3 py-3 text-left transition-colors duration-150 hover:bg-white/[0.03] md:gap-5"
                        >
                          <LivePlayerPhoto pid={p.id.slice(2)} name={p.name} pos={p.pos[0]} width={44} height={44} className="size-11 rounded-full bg-black/30 object-cover" />
                          <span className="min-w-0">
                            <span className="block font-semibold break-words">{p.name}</span>
                            <span className="block text-sm break-words text-[var(--muted)]">
                              {[p.nba, p.pos.join("/"), p.owner ? `on ${p.owner}'s roster` : null].filter(Boolean).join(" · ")}
                              {mine ? <span className="text-[var(--paper)]"> · you own {mine}</span> : null}
                            </span>
                            {p.locked ? (
                              <span className="mt-1 inline-block rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-[var(--paper)]">Locked: game on, reopens 6 AM ET</span>
                            ) : null}
                            <span className="block text-xs text-[var(--muted)] tabular-nums">
                              {p.last5.toFixed(1)} last 5 · {p.avg.toFixed(1)} season · {p.games} games
                            </span>
                          </span>
                          <span>
                            <Spark h={p.history} up={p.change >= 0} />
                          </span>
                          <span className="text-right">
                            <span className="block font-display text-2xl leading-none font-black tabular-nums">{money(p.price)}</span>
                            <span className={`text-sm tabular-nums ${p.change >= 0 ? UP : DOWN}`}>{pct(p.change)} wk</span>
                          </span>
                        </button>
                        {isOpen ? (
                          <div className="space-y-3 pb-5">
                            <PriceChart h={p.history} ticker={p.name} empty={`${p.name}'s chart fills in as he plays.`} note="His value after each day's games, from box scores, with today's pricing (60% last 5 games, 40% season)." />
                            {w ? (
                              <div className="flex flex-col gap-3 rounded-2xl bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                                <Qty q={q} setQ={setQ} max={MAX_QTY} />
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    disabled={busy || cost > w.bucks || p.locked}
                                    onClick={() => void order({ kind: "buy", team: p.id, qty: q }, `Bought ${q} ${p.name}.`)}
                                    className={`${chip} bg-[var(--paper)] text-[var(--bin)]`}
                                  >
                                    {p.locked ? "Locked: game on" : `Buy for ${money(cost)} BB`}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy || mine < q || p.locked}
                                    onClick={() => void order({ kind: "sell", team: p.id, qty: q }, `Sold ${q} ${p.name}.`)}
                                    className={`${chip} bg-white/10 hover:bg-white/15`}
                                  >
                                    {mine >= q ? `Sell for ${money(pay)} BB` : mine ? `You own ${mine}` : "Nothing to sell"}
                                  </button>
                                </div>
                              </div>
                            ) : null}
                            {w ? shortControls(p.id, p.fair, p.name, p.locked ? "Locked: game on" : p.ownerId === s.me ? "He's on your roster" : null) : (
                              <p className="text-sm text-[var(--muted)]">Sign in as yourself at the top of the page to trade.</p>
                            )}
                            <p className="text-xs text-[var(--muted)]">
                              Fair value {money(p.fair)} BB: 60% his last 5 games, 40% his season average (until he has 5 games it starts from last season&apos;s average, or 15 for a rookie; holds while he sits out). Every share the league holds adds 0.4%.
                            </p>
                            {note && open === p.id ? (
                              <p role="status" className={`text-sm font-semibold ${note.ok ? UP : DOWN}`}>
                                {note.text}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                {list.length > shown ? (
                  <button type="button" onClick={() => setShown(shown + 25)} className={`${chip} mt-4 bg-white/10 hover:bg-white/15`}>
                    Show more ({list.length - shown} left)
                  </button>
                ) : null}
                {!list.length ? <p className="mt-5 text-[var(--muted)]">No player matches that.</p> : null}
              </>
            );
          })()}
        </section>
      ) : null}

      {/* The Great Storm: Junkyard Dog + KawhiNot as one stock (Trash lore). */}
      {tab === "companies" && s.storm ? (
        <section id="asset-storm" aria-label="Companies" className="mx-auto max-w-6xl scroll-mt-28 px-5 md:px-10">
          <h2 className="font-display text-3xl font-black md:text-4xl">Companies</h2>
          <p className="mt-2 mb-6 max-w-2xl text-[var(--muted)]">Publicly traded companies built from Trash teams.</p>
          {(() => {
            const st = s.storm!;
            const mine = owned(st.id);
            const isOpen = open === st.id;
            const cost = buyCost(st.fair, st.held, q);
            const pay = mine >= q ? sellValue(st.fair, st.held, q) : 0;
            const member = !!s.me && st.members.some((m) => m.id === s.me);
            return (
              <div className="relative overflow-hidden rounded-[28px] border border-[var(--storm)]/25 bg-[radial-gradient(120%_90%_at_85%_0%,rgba(159,182,220,0.22),transparent_60%),linear-gradient(180deg,rgba(20,33,43,0.9),var(--bin))] p-5 md:p-8">
                <svg aria-hidden viewBox="0 0 120 160" className="pointer-events-none absolute -top-4 right-4 h-40 w-auto opacity-[0.12] md:h-56">
                  <path d="M70 0 20 90h34L40 160l60-100H62L80 0z" fill="var(--storm)" />
                </svg>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => {
                    setOpen(isOpen ? null : st.id);
                    setQ(1);
                    setNote(null);
                  }}
                  className="relative grid w-full cursor-pointer grid-cols-1 items-end gap-4 text-left sm:grid-cols-[1fr_auto]"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold tracking-[0.25em] text-[var(--storm)] uppercase">Publicly traded · STORM</span>
                    <span className="mt-1 block font-display text-4xl leading-none font-black md:text-6xl">The Great Storm</span>
                    <span className="mt-3 flex flex-wrap items-center gap-2">
                      {st.members.map((m) => (
                        <span key={m.id} className="inline-flex items-center gap-2 rounded-full bg-black/30 py-1 pr-3 pl-1">
                          <MgrPhoto id={m.id} alt="" width={28} height={28} className="size-7 rounded-full object-cover" />
                          <span className="text-sm font-semibold">{m.name}</span>
                          <span className="text-xs whitespace-nowrap text-[var(--muted)] tabular-nums">{m.record}</span>
                        </span>
                      ))}
                    </span>
                    <span className="mt-3 block max-w-xl text-sm text-[var(--muted)]">
                      Before Season 4, Junkyard Dog and KawhiNot warned the league they were coming for the top. One stock for both, worth
                      the average of the two teams. It pays coin each week: half the usual when one of them wins, the full amount plus a 1.5x
                      bonus when both win (a Storm week), nothing when both lose.
                      {mine ? <span className="text-[var(--paper)]"> You own {mine}.</span> : null}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 sm:block sm:text-right">
                    <span className="block sm:ml-auto sm:w-fit"><Spark h={st.history} up={st.change >= 0} /></span>
                    <span className="block font-display text-4xl leading-none font-black tabular-nums md:text-5xl">{money(st.price)}</span>
                    <span className={`text-sm tabular-nums ${st.change >= 0 ? UP : DOWN}`}>{pct(st.change)} wk</span>
                    {st.stormWeekPays ? (
                      <span className="mt-1 block text-xs text-[var(--storm)] tabular-nums">Storm week pays {money(st.stormWeekPays)} PC a share</span>
                    ) : null}
                  </span>
                </button>
                {isOpen ? (
                  <div className="relative mt-5 space-y-3">
                    <PriceChart h={st.history} ticker="STORM" note="Before STORM traded: the average of Junkyard Dog's and KawhiNot's values each night." />
                    {!s.teamWindow ? <p className="text-xs text-[var(--muted)]">Companies trade on Mondays before 7 PM Eastern, like team stocks. Closed the rest of the week.</p> : null}
                    {w ? (
                      <div className="flex flex-col gap-3 rounded-2xl bg-black/25 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <Qty q={q} setQ={setQ} max={MAX_QTY} />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy || cost > w.bucks || member || !s.teamWindow}
                            onClick={() => void order({ kind: "buy", team: st.id, qty: q }, `Bought ${q} STORM.`)}
                            className={`${chip} bg-[var(--storm)] text-[var(--bin)]`}
                          >
                            {member ? "You're part of the Storm" : !s.teamWindow ? "Opens Monday" : `Buy for ${money(cost)} BB`}
                          </button>
                          <button
                            type="button"
                            disabled={busy || mine < q || !s.teamWindow}
                            onClick={() => void order({ kind: "sell", team: st.id, qty: q }, `Sold ${q} STORM.`)}
                            className={`${chip} bg-white/10 hover:bg-white/15`}
                          >
                            {!s.teamWindow ? (mine ? "Sell opens Monday" : "Nothing to sell") : mine >= q ? `Sell for ${money(pay)} BB` : mine ? `You own ${mine}` : "Nothing to sell"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--muted)]">Sign in as yourself at the top of the page to trade.</p>
                    )}
                    {note && open === st.id ? (
                      <p role="status" className={`text-sm font-semibold ${note.ok ? UP : DOWN}`}>
                        {note.text}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })()}
        </section>
      ) : null}

      <div className="mx-auto grid max-w-6xl gap-12 px-5 md:grid-cols-2 md:px-10">
        <section aria-label="Standings">
          <h2 className="font-display text-3xl font-black md:text-4xl">Richest in Trash</h2>
          <p className="mt-2 text-[var(--muted)]">Most hoodies wins. Net worth breaks ties. Tap a name to see their portfolio and how each investment is doing.</p>
          {s.standings!.length ? (
            <ol className="mt-5 divide-y divide-[var(--line)] border-y border-[var(--line)]">
              {s.standings!.map((r, i) => (
                <li key={r.manager} className={`flex items-center gap-3 py-3 ${r.manager === s.me ? "bg-white/[0.04]" : ""}`}>
                  <span className="w-6 text-right font-display text-xl font-black text-[var(--muted)] tabular-nums">{i + 1}</span>
                  <MgrPhoto id={r.manager} alt="" width={36} height={36} className="size-9 rounded-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPeek(r.manager)}
                    className="min-w-0 flex-1 cursor-pointer text-left font-semibold break-words underline decoration-[var(--line)] underline-offset-4 hover:decoration-[var(--paper)]"
                  >
                    {r.name}
                  </button>
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
        <section aria-label="Every transaction">
          <h2 className="font-display text-3xl font-black md:text-4xl">The ledger</h2>
          <p className="mt-2 text-[var(--muted)]">Every transaction in the league, newest first. Nothing on this exchange is private.</p>
          {s.feed!.length ? (
            <>
              <ul className="mt-5 divide-y divide-[var(--line)] border-y border-[var(--line)]">
                {(allFeed ? s.feed! : s.feed!.slice(0, 12)).map((f, i) => (
                  <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2.5 text-sm">
                    <span className="min-w-0 break-words">
                      <button
                        type="button"
                        onClick={() => setPeek(f.manager)}
                        className="cursor-pointer font-semibold underline decoration-[var(--line)] underline-offset-4 hover:decoration-[var(--paper)]"
                      >
                        {f.name}
                      </button>{" "}
                      <span className="text-[var(--muted)]">{ledgerLine(f)}</span>
                    </span>
                    <time dateTime={f.at} className="shrink-0 text-xs text-[var(--muted)] tabular-nums">
                      {when(f.at)}
                    </time>
                  </li>
                ))}
              </ul>
              {s.feed!.length > 12 ? (
                <button type="button" onClick={() => setAllFeed(!allFeed)} className={`${chip} mt-4 bg-white/10 hover:bg-white/15`}>
                  {allFeed ? "Show fewer" : `Show all ${s.feed!.length}`}
                </button>
              ) : null}
            </>
          ) : (
            <p className="mt-5 text-[var(--muted)]">Quiet on the floor. For now.</p>
          )}
        </section>
      </div>

      {/* Anyone's portfolio (everything here is public, like the ledger). */}
      {peek && s.portfolios?.[peek] ? (
        <Portfolio
          name={s.standings?.find((x) => x.manager === peek)?.name ?? "Manager"}
          id={peek}
          p={s.portfolios[peek]}
          onClose={() => setPeek(null)}
        />
      ) : null}

      <section aria-label="How it works" className="mx-auto max-w-6xl px-5 md:px-10">
        <h2 className="font-display text-3xl font-black md:text-4xl">How it works</h2>
        <ul className="mt-5 grid gap-4 md:grid-cols-3">
          <li className="rounded-2xl bg-black/20 p-5">
            <p className="flex items-center gap-2 font-semibold">
              <Bucks /> Bushy Bucks
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Everyone starts with 1,000. Buy shares in any team except your own. A team&apos;s price rises with its official points and record, and
              with demand.
            </p>
          </li>
          <li className="rounded-2xl bg-black/20 p-5">
            <p className="flex items-center gap-2 font-semibold">
              <Coin /> Perren Coin
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Paid out when a week goes final, for every share you owned before that week&apos;s Monday 7 PM game time. Team stocks trade only on Mondays before 7 PM Eastern. A win pays the loser&apos;s value ÷ the winner&apos;s, from 0.5 coin (a favourite beating a weak team) up to 3 (a big upset). A tie pays half. Buy coin at 40 BB; cashing it back in pays 30. Shorts (teams and players): put up today&apos;s value, and closing pays you what the price fell (or costs what it rose, never more than you put up); no coin either way; not your own team or roster.
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
        <p className="mt-5 text-xs text-[var(--muted)]">Player stocks cost what a player averages a game (Trash scoring, real box scores) and pay no coin. Play money, just for Trash: none of it can be bought, sold or cashed out for anything real. No entry fee, no prizes. Resets each season.</p>
      </section>
    </div>
  );
}
