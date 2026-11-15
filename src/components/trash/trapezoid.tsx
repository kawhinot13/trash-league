"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MgrLink, MgrPhoto, useBrand } from "@/components/trash/brand";
import { Explain, Segmented } from "@/components/trash/intel";
import type { backtest as Backtest, Classification, TrapPoint, TrapView } from "@/lib/core/trapezoid";

type Bt = ReturnType<typeof Backtest>;
type Person = { id: string; nick: string };

const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
const n1 = (x: number) => x.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const sign = (x: number, f = n1) => `${x >= 0 ? "+" : "−"}${f(Math.abs(x))}`;
const ZONE = "var(--zone)";
const CLASS_ORDER: Classification[] = ["Elite Contender", "On the Bubble", "Sleeping Giant", "Record Merchant", "Outside the Window", "Small Sample"];
const CLASS_NOTE: Record<Classification, string> = {
  "Elite Contender": "Inside the window: scoring and winning like a champion.",
  "On the Bubble": "Just outside the window.",
  "Sleeping Giant": "Scores like a contender, but the record is behind. Could be tough matchups.",
  "Record Merchant": "Wins enough, but scoring is below the champions' floor.",
  "Outside the Window": "Below the scoring and winning benchmarks.",
  "Small Sample": "Too few games to read much into yet.",
};

/** Nice tick steps for an axis. */
function ticks(lo: number, hi: number, count = 5) {
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}

type Geo = ReturnType<typeof geometry>;
/** Domains, scales and the window's outline for one view in one y mode. */
function geometry(v: TrapView, mode: "avg" | "index", w: number, h: number, compact: boolean) {
  const pad = { l: compact ? 44 : 58, r: 14, t: 14, b: compact ? 40 : 48 };
  const yOf = (p: TrapPoint) => (mode === "avg" ? p.avg : p.index);
  const idxToY = (s: number) => (mode === "avg" && v.leagueAvg ? (s * v.leagueAvg) / 100 : s);
  const xs = v.points.map((p) => p.win);
  const ys = v.points.map(yOf);
  const floorY = idxToY(v.th.floor);
  let xLo = Math.max(0, Math.min(...xs, v.th.base - 0.08) - 0.04);
  // A little room past the highest win rate (even 100%) so markers aren't cut off at the edge.
  let xHi = Math.min(1.06, Math.max(...xs, v.th.base + 0.1) + 0.05);
  if (xHi - xLo < 0.3) {
    xLo = Math.max(0, xLo - 0.1);
    xHi = Math.min(1.06, xHi + 0.1);
  }
  const span = Math.max(...ys, floorY) - Math.min(...ys, floorY) || 10;
  const yLo = Math.min(...ys, floorY) - span * 0.1;
  const yHi = Math.max(...ys, floorY) + span * 0.12;
  const pw = w - pad.l - pad.r;
  const ph = h - pad.t - pad.b;
  const X = (x: number) => pad.l + ((x - xLo) / (xHi - xLo)) * pw;
  const Y = (y: number) => pad.t + (1 - (y - yLo) / (yHi - yLo)) * ph;
  // The window in (win, index) space, extended past the plot and clipped by it: open at the top
  // and right. Left edge: required win rate falls by `slope` per index point above the floor.
  const th = v.th;
  const sTop = mode === "avg" && v.leagueAvg ? (yHi * 100) / v.leagueAvg + 50 : yHi + 50;
  const sZero = th.floor + th.base / th.slope; // where the required win rate reaches 0
  const left: [number, number][] = [[th.base, th.floor]];
  if (sZero < sTop) left.push([0, sZero], [0, sTop]);
  else left.push([th.base - th.slope * (sTop - th.floor), sTop]);
  const zone = [...left.slice().reverse(), [th.base, th.floor], [1.2, th.floor], [1.2, sTop]] as [number, number][];
  const path = (pts: [number, number][]) => pts.map(([x, s], i) => `${i ? "L" : "M"}${X(x).toFixed(1)},${Y(idxToY(s)).toFixed(1)}`).join("");
  return {
    pad,
    pw,
    ph,
    X,
    Y,
    yOf,
    xTicks: ticks(xLo, xHi, compact ? 4 : 6).filter((t) => t <= 1),
    yTicks: ticks(yLo, yHi, compact ? 4 : 6),
    zonePath: `${path([...zone, [1.2, sTop]])}Z`,
    edgePath: path([...left.slice().reverse(), [1.2, th.floor]]),
    floorY,
  };
}

/** Managers at the same spot (identical numbers) share one label, keyed by the first id. */
function groupSpots(points: { id: string; x: number; y: number; r: number; text: string }[]) {
  const groups: { id: string; x: number; y: number; r: number; text: string }[] = [];
  for (const p of points) {
    const g = groups.find((q) => Math.abs(q.x - p.x) < 3 && Math.abs(q.y - p.y) < 3);
    if (g) g.text += `, ${p.text}`;
    else groups.push({ ...p });
  }
  return groups;
}

/** Labels beside markers without overlapping (tries right, left, above, below). */
function placeLabels(all: { id: string; x: number; y: number; r: number; text: string }[], w: number, h: number, charW = 6.6, lineH = 15) {
  const points = groupSpots(all);
  const boxes: { x: number; y: number; w: number; h: number }[] = points.map((p) => ({ x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2 }));
  const hit = (a: (typeof boxes)[number]) => boxes.some((b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h);
  const out = new Map<string, { x: number; y: number; align: "start" | "end" | "middle"; text: string }>();
  for (const p of [...points].sort((a, b) => a.y - b.y)) {
    const tw = p.text.length * charW + 6;
    const th = lineH;
    const cands = [
      { x: p.x + p.r + 4, y: p.y - th / 2, align: "start" as const },
      { x: p.x - p.r - 4 - tw, y: p.y - th / 2, align: "end" as const },
      { x: p.x - tw / 2, y: p.y - p.r - th - 2, align: "middle" as const },
      { x: p.x - tw / 2, y: p.y + p.r + 2, align: "middle" as const },
    ];
    for (const c of cands) {
      const box = { x: c.x, y: c.y, w: tw, h: th };
      if (box.x < 0 || box.x + tw > w || box.y < 0 || box.y + th > h || hit(box)) continue;
      boxes.push(box);
      out.set(p.id, { x: c.align === "start" ? c.x + 3 : c.align === "end" ? c.x + tw - 3 : c.x + tw / 2, y: c.y + th - 4, align: c.align, text: p.text });
      break;
    }
  }
  return out;
}

export function Trapezoid({ views, bt, people }: { views: TrapView[]; bt: Bt; people: Person[] }) {
  const brand = useBrand();
  const reduce = useReducedMotion();
  const nick = (id: string) => people.find((p) => p.id === id)?.nick ?? brand.names?.[id] ?? id;
  const [key, setKey] = useState(views.find((v) => v.kind === "current")?.key ?? views[0]?.key ?? "all");
  const view = views.find((v) => v.key === key) ?? views[0];
  const [mode, setMode] = useState<"avg" | "index">("avg");
  const yMode = view?.kind === "all" ? "index" : mode;
  const [sized, setSized] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const compact = (size?.w ?? 800) < 560;
  const geo: Geo | null = useMemo(() => (view && size ? geometry(view, yMode, size.w, size.h, compact) : null), [view, yMode, size, compact]);
  const maxTx = Math.max(0.0001, ...(view?.points.map((p) => p.txRate) ?? [0]));
  const rOf = (p: TrapPoint) => (sized ? 11 + 15 * Math.sqrt(p.txRate / maxTx) : compact ? 14 : 18);
  const placed = useMemo(() => {
    if (!geo || !size || !view) return new Map();
    return placeLabels(
      view.points.map((p) => ({ id: p.id, x: geo.X(p.win), y: geo.Y(geo.yOf(p)), r: rOf(p), text: nick(p.id) })),
      size.w,
      size.h,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, size, view, sized]);

  if (!view) return <p className="text-[var(--muted)]">Insufficient data: no regular-season games yet.</p>;
  const focus = view.points.find((p) => p.id === (hover ?? picked)) ?? [...view.points].sort((a, b) => b.index - a.index)[0];
  const sorted = [...view.points].sort((a, b) => CLASS_ORDER.indexOf(a.cls) - CLASS_ORDER.indexOf(b.cls) || b.index - a.index);
  const champ = (p: TrapPoint) => (view.kind === "all" ? p.titles.length > 0 : p.playoffSpot === "champion");
  const opts = views.map((v) => [v.key, v.label] as [string, string]);
  const th = view.th;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {opts.length <= 5 ? (
          <Segmented id="trap-view" value={key} options={opts} onChange={setKey} />
        ) : (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-[var(--muted)]">Chart</span>
            <select
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="h-10 rounded-full border border-white/15 bg-black/25 px-4 font-semibold text-[var(--paper)]"
            >
              {opts.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        )}
        {view.kind !== "all" ? (
          <Segmented
            id="trap-y"
            value={mode}
            options={[
              ["avg", "Points per matchup"],
              ["index", "Scoring Index"],
            ]}
            onChange={setMode}
          />
        ) : null}
        <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-[var(--muted)]">
          <input type="checkbox" checked={sized} onChange={(e) => setSized(e.target.checked)} className="size-4 accent-[var(--paper)]" />
          Size by transactions
        </label>
      </div>

      <p className="mt-4 text-sm text-[var(--muted)]">
        {view.kind === "all" ? (
          <>Career numbers across every season, this one included (completed games only). Scoring is the Scoring Index, so seasons with different scoring compare fairly.</>
        ) : (
          <>
            <span className="font-semibold text-[var(--paper)]">{view.stage}</span>
            {view.played ? `: ${view.played} of ${view.scheduled ?? "?"} regular-season weeks played.` : "."}
            {view.kind === "current" && view.stage?.startsWith("Early") ? " A hot start isn't a contender yet." : ""}
            {view.leagueAvg ? ` League average: ${n1(view.leagueAvg)} points per matchup.` : ""}
          </>
        )}
      </p>

      <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <div ref={box} className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-white/10 bg-black/25 sm:aspect-[16/11]">
            {geo && size ? (
              <>
                <svg width={size.w} height={size.h} className="absolute inset-0" aria-hidden>
                  <defs>
                    <clipPath id="trap-plot">
                      <rect x={geo.pad.l} y={geo.pad.t} width={geo.pw} height={geo.ph} />
                    </clipPath>
                  </defs>
                  {geo.xTicks.map((t) => (
                    <g key={`x${t}`}>
                      <line x1={geo.X(t)} x2={geo.X(t)} y1={geo.pad.t} y2={geo.pad.t + geo.ph} stroke="rgba(246,243,234,0.07)" />
                      <text x={geo.X(t)} y={geo.pad.t + geo.ph + 16} textAnchor="middle" fontSize={11} fill="var(--muted)">
                        {Math.round(t * 100)}%
                      </text>
                    </g>
                  ))}
                  {geo.yTicks.map((t) => (
                    <g key={`y${t}`}>
                      <line x1={geo.pad.l} x2={geo.pad.l + geo.pw} y1={geo.Y(t)} y2={geo.Y(t)} stroke="rgba(246,243,234,0.07)" />
                      <text x={geo.pad.l - 6} y={geo.Y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
                        {Math.round(t).toLocaleString()}
                      </text>
                    </g>
                  ))}
                  <g clipPath="url(#trap-plot)">
                    <motion.path d={geo.zonePath} style={{ fill: ZONE, fillOpacity: 0.22 }} initial={false} animate={{ d: geo.zonePath }} transition={{ duration: reduce ? 0 : 0.45 }} />
                    <motion.path
                      d={geo.edgePath}
                      fill="none"
                      style={{ stroke: "var(--zone-edge)", strokeWidth: 2 }}
                      initial={false}
                      animate={{ d: geo.edgePath }}
                      transition={{ duration: reduce ? 0 : 0.45 }}
                    />
                  </g>
                  {view.kind !== "all" && yMode === "index" ? (
                    <line x1={geo.pad.l} x2={geo.pad.l + geo.pw} y1={geo.Y(100)} y2={geo.Y(100)} stroke="rgba(246,243,234,0.25)" strokeDasharray="3 4" />
                  ) : null}
                  <text x={geo.pad.l + geo.pw / 2} y={size.h - 8} textAnchor="middle" fontSize={12} fill="var(--paper)">
                    Regular-season win %
                  </text>
                  <text transform={`translate(13 ${geo.pad.t + geo.ph / 2}) rotate(-90)`} textAnchor="middle" fontSize={12} fill="var(--paper)">
                    {yMode === "avg" ? "Points per matchup" : "Scoring Index (100 = average)"}
                  </text>
                  {!compact || picked
                    ? view.points.map((p) => {
                        const l = placed.get(p.id);
                        if (!l || (compact && p.id !== picked)) return null;
                        return (
                          <text key={`l${p.id}`} x={l.x} y={l.y} textAnchor={l.align} fontSize={12} fontWeight={600} fill={champ(p) ? "var(--gold)" : "var(--paper)"}>
                            {compact ? nick(p.id) : l.text}
                          </text>
                        );
                      })
                    : null}
                </svg>
                {view.points.map((p) => {
                  const r = rOf(p);
                  const x = geo.X(p.win) - r;
                  const y = geo.Y(geo.yOf(p)) - r;
                  const ring = champ(p) ? "var(--gold)" : view.kind !== "all" && p.playoffSpot === "finalist" ? "rgba(246,243,234,0.8)" : p.inside ? "var(--zone-edge)" : "rgba(246,243,234,0.25)";
                  const on = focus?.id === p.id;
                  return (
                    <motion.button
                      key={p.id}
                      type="button"
                      aria-label={`${nick(p.id)}: ${pct(p.win)} wins, ${yMode === "avg" ? `${n1(p.avg)} points per matchup` : `Scoring Index ${n1(p.index)}`}, ${p.cls}`}
                      onClick={() => setPicked(p.id === picked ? null : p.id)}
                      onMouseEnter={() => setHover(p.id)}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover(p.id)}
                      onBlur={() => setHover(null)}
                      className="absolute top-0 left-0 cursor-pointer rounded-full"
                      style={{ width: r * 2, height: r * 2, zIndex: on ? 3 : 2, boxShadow: `0 0 0 ${champ(p) ? 3 : 2}px ${ring}${on ? ", 0 0 0 6px rgba(246,243,234,0.35)" : ""}` }}
                      initial={false}
                      animate={{ x, y, opacity: p.inside || on ? 1 : 0.8 }}
                      transition={{ duration: reduce ? 0 : 0.5, ease: [0.23, 1, 0.32, 1] }}
                    >
                      <MgrPhoto id={p.id} alt="" width={Math.round(r * 2)} height={Math.round(r * 2)} className="size-full rounded-full object-cover" />
                      {view.kind === "all" && p.titles.length > 1 ? (
                        <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-[var(--gold)] text-[11px] font-black text-[var(--bin)]">
                          {p.titles.length}
                        </span>
                      ) : null}
                    </motion.button>
                  );
                })}
              </>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--muted)]">
            <span className="inline-flex items-center gap-2">
              <span className="inline-block size-3 rounded-sm" style={{ background: ZONE, opacity: 0.6, boxShadow: "inset 0 0 0 1px var(--zone-edge)" }} />
              Trapezoid of Excellence
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-block size-3 rounded-full" style={{ boxShadow: "0 0 0 2px var(--gold)" }} />
              {view.kind === "all" ? "Champion (number = titles)" : "This season's champion"}
            </span>
            {view.kind !== "all" ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block size-3 rounded-full" style={{ boxShadow: "0 0 0 2px rgba(246,243,234,0.8)" }} />
                Runner-up
              </span>
            ) : null}
            {sized ? <span>Bigger marker = more transactions per week (adds and trades). Doesn&apos;t affect the window.</span> : null}
            <DownloadButton view={view} yMode={yMode} nick={nick} league={brand.name} />
          </div>

          <p className="mt-3 text-sm text-[var(--muted)]">
            {th.basis === "provisional" ? (
              <>
                <span className="font-semibold text-[var(--paper)]">Provisional window</span> (fewer than 3 earlier champions to learn from): Scoring
                Index of at least {n1(th.floor)} and a {pct(th.base, 0)} win rate at that floor.
              </>
            ) : (
              <>
                Window built from {th.from.length} champion{th.from.length === 1 ? "" : "s"}
                {view.kind === "all" ? "" : " before this season"}: Scoring Index of at least {n1(th.floor)} and a {pct(th.base)} win rate at
                that floor{th.basis === "percentile" ? " (20th percentile of champions)" : " (the lowest champion's numbers)"}.
              </>
            )}{" "}
            Every index point above the floor lowers the win rate needed by {pct(th.slope, 1)}.
            {view.kind === "all" ? " This compares career profiles with champions' season profiles; it isn't a career prediction." : ""}
          </p>
        </div>

        {focus ? <Details p={focus} view={view} nick={nick} pinned={picked === focus.id} /> : null}
      </div>

      <h3 className="font-display mt-10 text-3xl font-black">Every manager</h3>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[34rem] text-sm tabular-nums">
          <thead className="text-left text-xs text-[var(--muted)]">
            <tr className="border-b border-white/10">
              {["Manager", "Record", "Win %", "Pts / matchup", "Index", "Profile"].map((h) => (
                <th key={h} scope="col" className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id} className={`border-b border-white/5 ${p.id === focus?.id ? "bg-white/6" : ""}`}>
                <td className="px-3 py-2">
                  <button type="button" onClick={() => setPicked(p.id)} className="flex cursor-pointer items-center gap-2 text-left font-semibold">
                    <MgrPhoto id={p.id} alt="" width={24} height={24} className="size-6 shrink-0 rounded-full object-cover" />
                    <span className="break-words">{nick(p.id)}</span>
                    {champ(p) ? <span className="text-[var(--gold)]">{view.kind === "all" ? `★${p.titles.length > 1 ? p.titles.length : ""}` : "★"}</span> : null}
                  </button>
                </td>
                <td className="px-3 py-2">
                  {p.w}–{p.l}
                  {p.t ? `–${p.t}` : ""}
                </td>
                <td className="px-3 py-2">{pct(p.win)}</td>
                <td className="px-3 py-2">{n1(p.avg)}</td>
                <td className="px-3 py-2">{n1(p.index)}</td>
                <td className={`px-3 py-2 ${p.cls === "Elite Contender" ? "font-semibold text-[#7fd49a]" : ""}`}>{p.cls}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Explain title="How the Trapezoid of Excellence works">
        <p>
          The Trapezoid of Excellence identifies scoring and winning profiles consistent with historical championship contention. It
          measures regular-season performance, not guaranteed playoff success.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Across:</strong> regular-season win %. Wins divided by games; a tie counts as a game but not a win.
          </li>
          <li>
            <strong>Up:</strong> points per matchup, from Sleeper&apos;s official regular-season points for, divided by completed weeks.
            Playoffs, projections and unfinished weeks never count. Leagues that also play the weekly median aren&apos;t counted twice.
          </li>
          <li>
            <strong>Scoring Index:</strong> a team&apos;s points per matchup divided by the league&apos;s average that season, × 100. 110 means
            10% above average. All-time charts use it, weighted by weeks played, so a 3-week season counts less than a full one.
          </li>
          <li>
            <strong>The window:</strong> the green zone is built from this league&apos;s own champions: how well they scored and won in the
            regular season. With fewer than 3 champions it&apos;s provisional (index 105, 50% wins). With 3 to 7 it uses the lowest
            champion&apos;s numbers; with 8 or more, the 20th percentile. A season&apos;s chart only learns from champions before it, so
            nothing from the future leaks in. Scoring more lowers the win rate you need; there&apos;s no ceiling.
          </li>
          <li>
            Champions can land outside the window. That&apos;s a real finding, not a mistake: the zone isn&apos;t moved to fit them.
            Transactions never count toward the window.
          </li>
        </ul>
        <Backtests bt={bt} nick={nick} />
      </Explain>
    </div>
  );
}

function Details({ p, view, nick, pinned }: { p: TrapPoint; view: TrapView; nick: (id: string) => string; pinned: boolean }) {
  const all = view.kind === "all";
  const rows: [string, string][] = [
    ["Record", `${p.w}–${p.l}${p.t ? `–${p.t}` : ""} (${pct(p.win)})`],
    ["Points per matchup", n1(p.avg)],
    ["Scoring Index", n1(p.index)],
    ["vs league average", `${sign(p.vsAvg)} a matchup`],
    ["Points against", p.pa === null ? "Unavailable" : `${n1(p.pa)} a matchup`],
    ["Point differential", p.diff === null ? "Unavailable" : `${sign(p.diff)} a matchup`],
    ["Games", `${p.games}${all ? ` over ${p.seasons} season${p.seasons === 1 ? "" : "s"}` : ""}`],
    ["Transactions", `${p.transactions} (${p.txRate.toFixed(1)} a week)`],
  ];
  if (all) {
    rows.push(
      ["Playoffs", p.eligible ? `${p.playoffApps} of ${p.eligible} finished seasons (${pct(p.playoffApps / p.eligible, 0)})` : "No finished seasons yet"],
      ["Playoff record", `${p.playoffW}–${p.playoffL}`],
      ["Finals", String(p.finals)],
    );
  } else if (p.seed) {
    const spot = {
      champion: "Won the title",
      finalist: "Lost in the final",
      playoffs: "Made the playoffs",
      missed: "Missed the playoffs",
      "projected-in": "In a playoff spot for now (not final)",
      "projected-out": "Outside the playoff spots for now",
    } as const;
    rows.push(["Seed", `${p.seed}${p.playoffSpot ? `: ${spot[p.playoffSpot]}` : ""}`]);
    if (view.kind === "season" && p.playoffW + p.playoffL) rows.push(["Playoff record", `${p.playoffW}–${p.playoffL}`]);
  }
  const titles = p.titles.map((c) => c).length;
  return (
    <aside className="rounded-2xl border border-white/10 bg-[var(--bin-2)] p-4" aria-live="polite">
      <div className="flex items-center gap-3">
        <MgrPhoto id={p.id} alt="" width={44} height={44} className="size-11 shrink-0 rounded-full object-cover" />
        <div className="min-w-0">
          <MgrLink id={p.id} className="block break-words font-semibold hover:underline">
            {nick(p.id)}
          </MgrLink>
          <p className={`text-sm ${p.cls === "Elite Contender" ? "text-[#7fd49a]" : "text-[var(--muted)]"}`}>{p.cls}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">
        {CLASS_NOTE[p.cls]}
        {p.cls === "Small Sample" ? (p.inside ? " Inside the window for now." : " Outside the window for now.") : ""}
        {p.needed !== null && !p.inside ? ` Needs a ${pct(p.needed)} win rate at this scoring level.` : ""}
        {p.needed === null ? " Scoring is below the window's floor." : ""}
      </p>
      {titles ? (
        <p className="mt-2 text-sm font-semibold text-[var(--gold)]">
          {titles} title{titles === 1 ? "" : "s"}
          {view.kind === "season" && p.playoffSpot !== "champion" ? " before this season" : ""}
        </p>
      ) : null}
      <dl className="mt-3 space-y-1.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-wrap justify-between gap-x-3">
            <dt className="text-[var(--muted)]">{k}</dt>
            <dd className="text-right tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-[var(--muted)]">{pinned ? "Pinned. Tap again to unpin." : "Tap a marker to pin it."}</p>
    </aside>
  );
}

function Backtests({ bt, nick }: { bt: Bt; nick: (id: string) => string }) {
  if (!bt.rows.length) return <p>No finished seasons to test the window against yet.</p>;
  const s = bt.summary;
  return (
    <div className="space-y-2 pt-2">
      <p className="font-semibold text-[var(--paper)]">How the window has done so far</p>
      <p>
        Each finished season, checked with the window built only from champions before it. {bt.rows.length} season
        {bt.rows.length === 1 ? "" : "s"} is a small sample, so read this as history, not a prediction.
      </p>
      <ul className="list-disc space-y-1 pl-5">
        {bt.rows.map((r) => (
          <li key={r.code}>
            {r.years}: {r.insideCount} of {r.teams} teams inside{r.basis === "provisional" ? " (provisional window)" : ""}. Champion{" "}
            {r.championInside ? "inside" : "outside"}; {r.finalistsInside} of {r.finalists} finalists inside; {r.insideMadePlayoffs} of{" "}
            {r.insideCount} inside teams made the playoffs.
          </li>
        ))}
      </ul>
      <p>
        Champions inside the window: {s.championCapture === null ? "unavailable" : pct(s.championCapture, 0)}. Finalists inside:{" "}
        {s.finalistCapture === null ? "unavailable" : pct(s.finalistCapture, 0)}. Teams counted as contenders:{" "}
        {s.contenderShare === null ? "unavailable" : pct(s.contenderShare, 0)}. Inside teams that made the playoffs:{" "}
        {s.insidePlayoffRate === null ? "unavailable" : pct(s.insidePlayoffRate, 0)}.
        {s.championsOutside.length
          ? ` Won it from outside the window: ${s.championsOutside.map((c) => `${nick(c.id)} (${c.years})`).join(", ")}.`
          : ""}
      </p>
    </div>
  );
}

/** A square PNG of the chart for the group chat, drawn from the same numbers (initials, no photos). */
function DownloadButton({ view, yMode, nick, league }: { view: TrapView; yMode: "avg" | "index"; nick: (id: string) => string; league: string }) {
  const save = () => {
    const S = 1080;
    const c = document.createElement("canvas");
    c.width = S;
    c.height = S;
    const g = c.getContext("2d");
    if (!g) return;
    const css = getComputedStyle(document.documentElement);
    const col = (v: string, f: string) => css.getPropertyValue(v).trim() || f;
    const display = getComputedStyle(document.querySelector(".font-display") ?? document.body).fontFamily;
    const sans = getComputedStyle(document.body).fontFamily;
    g.fillStyle = col("--bin", "#0f2a20");
    g.fillRect(0, 0, S, S);
    g.fillStyle = col("--paper", "#f6f3ea");
    g.font = `900 64px ${display}`;
    g.fillText("Trapezoid of Excellence", 60, 110);
    g.font = `500 28px ${sans}`;
    g.fillStyle = col("--muted", "#a4b8ab");
    g.fillText(`${league} · ${view.kind === "all" ? "All-time" : view.years ?? view.label}${view.stage && view.kind !== "all" ? ` · ${view.stage}` : ""}`, 60, 155);
    const geo = geometry(view, yMode, S - 80, S - 280, false);
    g.save();
    g.translate(40, 190);
    g.strokeStyle = "rgba(246,243,234,0.08)";
    g.font = `500 18px ${sans}`;
    g.fillStyle = col("--muted", "#a4b8ab");
    for (const t of geo.xTicks) {
      g.beginPath();
      g.moveTo(geo.X(t), geo.pad.t);
      g.lineTo(geo.X(t), geo.pad.t + geo.ph);
      g.stroke();
      g.textAlign = "center";
      g.fillText(`${Math.round(t * 100)}%`, geo.X(t), geo.pad.t + geo.ph + 24);
    }
    for (const t of geo.yTicks) {
      g.beginPath();
      g.moveTo(geo.pad.l, geo.Y(t));
      g.lineTo(geo.pad.l + geo.pw, geo.Y(t));
      g.stroke();
      g.textAlign = "right";
      g.fillText(Math.round(t).toLocaleString(), geo.pad.l - 8, geo.Y(t) + 6);
    }
    g.save();
    g.beginPath();
    g.rect(geo.pad.l, geo.pad.t, geo.pw, geo.ph);
    g.clip();
    g.fillStyle = col("--zone", "#2f8f5b");
    g.globalAlpha = 0.45;
    g.fill(new Path2D(geo.zonePath));
    g.globalAlpha = 1;
    g.strokeStyle = col("--zone-edge", "#5fd08f");
    g.lineWidth = 3;
    g.stroke(new Path2D(geo.edgePath));
    g.restore();
    const labels = placeLabels(
      view.points.map((p) => ({ id: p.id, x: geo.X(p.win), y: geo.Y(geo.yOf(p)), r: 17, text: nick(p.id) })),
      S - 80,
      S - 280,
      11,
      24,
    );
    for (const p of view.points) {
      const x = geo.X(p.win);
      const y = geo.Y(geo.yOf(p));
      const champ = view.kind === "all" ? p.titles.length > 0 : p.playoffSpot === "champion";
      g.beginPath();
      g.arc(x, y, 17, 0, Math.PI * 2);
      g.fillStyle = col("--bin-3", "#1f4a39");
      g.fill();
      g.lineWidth = champ ? 5 : 2.5;
      g.strokeStyle = champ ? col("--gold", "#e9c46a") : p.inside ? col("--zone-edge", "#5fd08f") : "rgba(246,243,234,0.4)";
      g.stroke();
    }
    g.font = `600 20px ${sans}`;
    for (const [id, l] of labels) {
      const p = view.points.find((q) => q.id === id)!;
      const champ = view.kind === "all" ? p.titles.length > 0 : p.playoffSpot === "champion";
      g.fillStyle = champ ? col("--gold", "#e9c46a") : col("--paper", "#f6f3ea");
      g.textAlign = l.align === "start" ? "left" : l.align === "end" ? "right" : "center";
      g.fillText(l.text, l.x, l.y);
    }
    g.restore();
    g.fillStyle = col("--paper", "#f6f3ea");
    g.textAlign = "center";
    g.font = `600 22px ${sans}`;
    g.fillText(`Regular-season win %  ·  ${yMode === "avg" ? "Points per matchup" : "Scoring Index (100 = league average)"}`, S / 2, S - 50);
    g.fillStyle = col("--muted", "#a4b8ab");
    g.font = `500 18px ${sans}`;
    g.fillText("Green zone: this league's champion profile. Regular season only. Gold ring = champion.", S / 2, S - 20);
    c.toBlob((b) => {
      if (!b) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = `trapezoid-${view.key}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
  };
  return (
    <button type="button" onClick={save} className="ml-auto inline-flex min-h-10 cursor-pointer items-center rounded-full border border-white/15 px-4 font-semibold text-[var(--paper)] hover:bg-white/8">
      Download image
    </button>
  );
}
