"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import type { LiveRow, Pickup } from "@/lib/live";
import type { Manager, Season } from "@/lib/league";

const n1 = (x: number) =>
  x.toLocaleString(undefined, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
const rec = (w: number, l: number, t = 0) => `${w}–${l}${t ? `–${t}` : ""}`;
const Av = ({ id, s = 36 }: { id: string; s?: number }) => (
  <Image
    src={`/avatars/${id}.jpg`}
    alt=""
    width={s}
    height={s}
    className="shrink-0 rounded-full object-cover"
    style={{ width: s, height: s }}
  />
);

/** Expandable plain-English explanation for anything that needs one. */
export function Explain({
  children,
  title = "How this works",
  tone = "dark",
}: {
  children: React.ReactNode;
  title?: string;
  tone?: "dark" | "court";
}) {
  return (
    <details
      className={`group mt-4 rounded-2xl border px-4 py-3 text-sm ${tone === "court" ? "border-black/15 bg-black/10 text-[#1d140b]" : "border-white/10 bg-black/20 text-[var(--muted)]"}`}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold select-none">
        <span className="inline-flex size-5 items-center justify-center rounded-full border border-current text-xs transition-transform duration-200 group-open:rotate-45">
          +
        </span>
        {title}
      </summary>
      <div className="mt-3 max-w-[72ch] space-y-2 leading-relaxed">
        {children}
      </div>
    </details>
  );
}

/** Segmented control with a sliding glass thumb. */
function Segmented<T extends string>({
  value,
  options,
  onChange,
  id,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  id: string;
}) {
  return (
    <div
      role="tablist"
      className="inline-flex flex-wrap gap-1 rounded-full border border-white/12 bg-black/25 p-1 backdrop-blur-md"
    >
      {options.map(([v, label]) => (
        <button
          key={v}
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={`relative cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 ${value === v ? "text-[var(--bin)]" : "text-[var(--paper)]/80 hover:text-[var(--paper)]"}`}
        >
          {value === v ? (
            <motion.span
              layoutId={`seg-${id}`}
              className="absolute inset-0 rounded-full bg-[var(--gold)]"
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            />
          ) : null}
          <span className="relative">{label}</span>
        </button>
      ))}
    </div>
  );
}

/* ── Live table: official vs "if the week ended today" ───────────────── */
export function LiveWeek({
  week,
  rows,
  daysLeft,
}: {
  week: number;
  rows: LiveRow[];
  daysLeft: number;
}) {
  const [mode, setMode] = useState<"proj" | "now">("now");
  const list =
    mode === "proj" ? rows : [...rows].sort((a, b) => a.rankNow - b.rankNow);
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Segmented
          id="live"
          value={mode}
          onChange={setMode}
          options={[
            ["now", "Official table"],
            ["proj", "If the week ended today"],
          ]}
        />
        <p className="text-sm font-medium">
          Week {week}.{" "}
          {mode === "proj"
            ? `Every matchup decided on points locked in right now. Ties broken by points for, including this week. Projections and win chances show where it's heading (${daysLeft} day${daysLeft === 1 ? "" : "s"} left).`
            : "Completed weeks only, straight from Sleeper."}
        </p>
      </div>
      <ol className="overflow-hidden rounded-2xl bg-[#1d140b] text-[var(--paper)] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]">
        {list.map((r) => {
          const move = r.rankNow - r.rankProj;
          const rank = mode === "proj" ? r.rankProj : r.rankNow;
          return (
            <motion.li
              layout
              key={r.manager}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              className="border-b border-[var(--line)] last:border-0"
            >
              <Link
                href={`/managers/${r.manager}`}
                className="grid grid-cols-[2rem_auto_1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5 md:grid-cols-[2.5rem_auto_1fr_15rem_7rem] md:gap-5 md:px-6"
              >
                <span className="font-display text-2xl font-bold text-[var(--muted)] tabular-nums">
                  {rank}
                </span>
                <Av id={r.manager} s={40} />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 truncate font-semibold">
                    {r.manager}
                    {mode === "proj" && move !== 0 ? (
                      <span
                        className={`text-xs font-bold ${move > 0 ? "text-[#7fd49a]" : "text-[#ff8a7a]"}`}
                        aria-label={move > 0 ? `up ${move}` : `down ${-move}`}
                      >
                        {move > 0 ? "▲" : "▼"}
                        {Math.abs(move)}
                      </span>
                    ) : null}
                  </span>
                  <span className="block truncate text-xs text-[var(--muted)]">
                    <span className="text-[var(--paper)]/85">{n1(r.now)}</span>{" "}
                    now
                    {mode === "proj" ? (
                      <>
                        ,{" "}
                        <span className="text-[var(--paper)]/85">
                          {n1(r.proj)}
                        </span>{" "}
                        projected
                      </>
                    ) : null}
                    <span className="mx-1.5 opacity-50">|</span>vs {r.opp}{" "}
                    {n1(r.oppNow)}
                    {mode === "proj" ? <> (proj. {n1(r.oppProj)})</> : null}
                  </span>
                </span>
                <span className="hidden md:block">
                  <span className="mb-1 flex justify-between text-xs text-[var(--muted)]">
                    <span>Win chance</span>
                    <span className="tabular-nums text-[var(--paper)]">
                      {Math.round(r.winProb * 100)}%
                    </span>
                  </span>
                  <span className="block h-1.5 rounded-full bg-white/10">
                    <span
                      className="block h-1.5 rounded-full"
                      style={{
                        width: `${r.winProb * 100}%`,
                        background:
                          r.winProb >= 0.5 ? "var(--gold)" : "var(--ticket)",
                      }}
                    />
                  </span>
                </span>
                <span className="text-right">
                  <span className="font-display block text-2xl font-bold tabular-nums">
                    {mode === "proj"
                      ? rec(r.pw, r.pl, r.pt)
                      : rec(r.w, r.l, r.t)}
                  </span>
                  <span className="block text-xs text-[var(--muted)] md:hidden">
                    {Math.round(r.winProb * 100)}% to win
                  </span>
                </span>
              </Link>
            </motion.li>
          );
        })}
      </ol>
      <Explain tone="court">
        <p>
          <strong>How your league scores.</strong> Each of the 9 starting slots
          counts one game per week: the latest game its player played while in
          the starting lineup. A new game replaces the old one, which is why
          benching someone protects a big score.
        </p>
        <p>
          <strong>Projected.</strong> For every slot we take the better of its
          current score and the starter&apos;s next projected game
          (Sleeper&apos;s projection, scored with your league&apos;s settings),
          assuming managers play the better option. Players listed as Out are
          skipped.
        </p>
        <p>
          <strong>Win chance.</strong> Each remaining game can land about a
          third above or below its projection; we add those swings up for both
          teams and turn the projected gap into a probability. When no games are
          left it is 0% or 100%.
        </p>
        <p>
          <strong>Ranking.</strong> Record first, ties broken by points for. In
          the projected view, points for includes this week&apos;s projected
          score. Arrows show the move from the official table.
        </p>
      </Explain>
    </div>
  );
}

/* ── Advanced waiver wire ─────────────────────────────────────────────── */
type SortKey =
  | "score"
  | "recentAvg"
  | "seasonAvg"
  | "projLeft"
  | "minDelta"
  | "trend";
export function WaiverWire({
  players,
  week,
}: {
  players: Pickup[];
  week: number;
}) {
  const [pos, setPos] = useState<"ALL" | "G" | "F" | "C">("ALL");
  const [sort, setSort] = useState<SortKey>("score");
  const list = useMemo(() => {
    const f = players.filter(
      (p) =>
        pos === "ALL" ||
        p.pos.some((x) =>
          pos === "G"
            ? x === "PG" || x === "SG"
            : pos === "F"
              ? x === "SF" || x === "PF"
              : x === "C",
        ),
    );
    const v = (p: Pickup) =>
      sort === "minDelta" ? p.minRecent - p.minSeason : p[sort];
    return [...f].sort((a, b) => v(b) - v(a)).slice(0, 25);
  }, [players, pos, sort]);
  const best = {
    stream: [...players].sort((a, b) => b.projLeft - a.projLeft)[0],
    hot: [...players]
      .filter((p) => p.gp >= 3)
      .sort(
        (a, b) => b.recentAvg - b.seasonAvg - (a.recentAvg - a.seasonAvg),
      )[0],
    mins: [...players].sort(
      (a, b) => b.minRecent - b.minSeason - (a.minRecent - a.minSeason),
    )[0],
  };
  const cols: [SortKey, string][] = [
    ["score", "Pickup score"],
    ["recentAvg", "Last 5"],
    ["seasonAvg", "Season"],
    ["projLeft", "Rest of week"],
    ["minDelta", "Minutes trend"],
    ["trend", "Adds, 48h"],
  ];
  return (
    <div>
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        {[
          [
            "Best stream this week",
            best.stream,
            best.stream &&
              `${n1(best.stream.projLeft)} projected pts over ${best.stream.gamesLeft} games`,
          ],
          [
            "Heating up",
            best.hot,
            best.hot &&
              `${n1(best.hot.recentAvg)} a game lately, up from ${n1(best.hot.seasonAvg)}`,
          ],
          [
            "Minutes rising",
            best.mins,
            best.mins &&
              `${n1(best.mins.minRecent)} min lately, up from ${n1(best.mins.minSeason)}`,
          ],
        ].map(([label, p, why]) =>
          p ? (
            <div
              key={label as string}
              className="relative overflow-hidden rounded-3xl border border-white/10 bg-[rgba(22,58,44,0.55)] p-5 backdrop-blur-md"
            >
              <p className="text-sm text-[var(--gold)]">{label as string}</p>
              <div className="mt-3 flex items-center gap-4">
                <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-[var(--bin-3)]">
                  <Image
                    src={`https://sleepercdn.com/content/nba/players/${(p as Pickup).id}.jpg`}
                    alt=""
                    fill
                    sizes="96px"
                    className="object-contain object-bottom"
                    unoptimized
                  />
                </div>
                <div className="min-w-0">
                  <p className="font-display truncate text-3xl leading-none font-black">
                    {(p as Pickup).name}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {why as string}
                  </p>
                </div>
              </div>
            </div>
          ) : null,
        )}
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          id="pos"
          value={pos}
          onChange={setPos}
          options={[
            ["ALL", "All"],
            ["G", "Guards"],
            ["F", "Forwards"],
            ["C", "Centers"],
          ]}
        />
        <p className="text-sm text-[var(--muted)]">
          Unrostered in Trash, scored with this league&apos;s settings. Week{" "}
          {week}.
        </p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[rgba(22,58,44,0.45)] backdrop-blur-md">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="text-[var(--muted)]">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Player
              </th>
              {cols.map(([k, label]) => (
                <th
                  key={k}
                  scope="col"
                  className="px-3 py-3 text-right font-medium"
                >
                  <button
                    onClick={() => setSort(k)}
                    className={`cursor-pointer whitespace-nowrap transition-colors ${sort === k ? "text-[var(--gold)]" : "hover:text-[var(--paper)]"}`}
                    aria-pressed={sort === k}
                  >
                    {label}
                    {sort === k ? " ↓" : ""}
                  </button>
                </th>
              ))}
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Next week
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const dm = p.minRecent - p.minSeason;
              return (
                <tr
                  key={p.id}
                  className="border-t border-white/8 transition-colors hover:bg-white/5"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="relative h-9 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--bin-3)]">
                        <Image
                          src={`https://sleepercdn.com/content/nba/players/${p.id}.jpg`}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-contain object-bottom"
                          unoptimized
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{p.name}</p>
                        <p className="flex flex-wrap gap-1 text-xs text-[var(--muted)]">
                          <span>
                            {p.pos.join("/")} {p.team}
                          </span>
                          {p.tags.map((t) => (
                            <span
                              key={t}
                              className={`rounded-full px-1.5 ${["Out", "Questionable", "Doubtful", "Day-To-Day"].includes(t) ? "bg-[var(--ticket)]/25 text-[#ffb3a8]" : "bg-[var(--gold)]/15 text-[var(--gold)]"}`}
                            >
                              {t}
                            </span>
                          ))}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="font-display px-3 text-right text-xl font-bold tabular-nums">
                    {n1(p.score)}
                  </td>
                  <td className="px-3 text-right tabular-nums">
                    {n1(p.recentAvg)}
                  </td>
                  <td className="px-3 text-right tabular-nums text-[var(--muted)]">
                    {n1(p.seasonAvg)}
                  </td>
                  <td className="px-3 text-right tabular-nums">
                    {n1(p.projLeft)}{" "}
                    <span className="text-xs text-[var(--muted)]">
                      ({p.gamesLeft}g)
                    </span>
                  </td>
                  <td
                    className={`px-3 text-right tabular-nums ${dm >= 2 ? "text-[#7fd49a]" : dm <= -2 ? "text-[#ff8a7a]" : ""}`}
                  >
                    {dm > 0 ? "+" : ""}
                    {n1(dm)} min
                  </td>
                  <td className="px-3 text-right tabular-nums">
                    {p.trend ? p.trend.toLocaleString() : "–"}
                  </td>
                  <td className="px-4 text-right tabular-nums">
                    {p.gamesNext || "–"}g
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Explain title="What each column means">
        <p>
          <strong>Pickup score:</strong> our blend of last-5 form (45%), season
          average (25%), projected points left this week (20%), minutes trend
          and how fast Sleeper users are adding them. Injured players are marked
          down (Out −50%, Doubtful −30%, Questionable −15%).
        </p>
        <p>
          <strong>Last 5 / Season:</strong> fantasy points per game in this
          league&apos;s scoring, over the last five games played and the whole
          season.
        </p>
        <p>
          <strong>Rest of week:</strong> projected points from games still to
          play this week, with the game count in brackets. Good for streaming an
          open slot.
        </p>
        <p>
          <strong>Minutes trend:</strong> minutes per game lately minus season
          average. Rising minutes usually come before rising production.
        </p>
        <p>
          <strong>Adds, 48h:</strong> how many Sleeper leagues added the player
          in the last two days, across all of Sleeper.
        </p>
        <p>
          <strong>Next week:</strong> games scheduled next week.
        </p>
      </Explain>
    </div>
  );
}

/* ── The Almanac: league history, organised by question ──────────────── */
type Tab =
  | "luck"
  | "oddities"
  | "playoffs"
  | "partners"
  | "waivers"
  | "drafts"
  | "seasons";
export function Almanac({
  managers,
  seasons,
  partners,
}: {
  managers: Manager[];
  seasons: Season[];
  partners: { a: string; b: string; n: number }[];
}) {
  const [tab, setTab] = useState<Tab>("luck");
  const [season, setSeason] = useState(seasons[seasons.length - 2].code);
  const done = seasons.filter((s) => s.status === "complete");
  // Luck: actual wins vs expected wins from season points for/against (Pythagorean, exponent 9).
  const luck = done
    .flatMap((s) =>
      s.standings.map((r) => {
        const pa = (r as { pa?: number }).pa ?? 0;
        const g = r.w + r.l + r.t;
        const exp = g * (r.pf ** 9 / (r.pf ** 9 + pa ** 9));
        return {
          season: s.code,
          years: s.years,
          manager: r.manager,
          w: r.w,
          l: r.l,
          exp,
          luck: r.w + r.t / 2 - exp,
          pa,
        };
      }),
    )
    .sort((a, b) => b.luck - a.luck);
  const career = [...managers].map((m) => ({
    ...m,
    luck: luck
      .filter((x) => x.manager === m.id)
      .reduce((s, x) => s + x.luck, 0),
  }));
  const Bar = ({
    v,
    max,
    color,
  }: {
    v: number;
    max: number;
    color: string;
  }) => (
    <span className="block h-2 rounded-full bg-white/10">
      <span
        className="block h-2 rounded-full"
        style={{
          width: `${Math.max(2, (Math.abs(v) / max) * 100)}%`,
          background: color,
        }}
      />
    </span>
  );
  return (
    <div>
      <Segmented
        id="almanac"
        value={tab}
        onChange={setTab}
        options={[
          ["luck", "Luck index"],
          ["oddities", "Oddities"],
          ["playoffs", "Playoff résumés"],
          ["partners", "Trade network"],
          ["waivers", "Waiver hawks"],
          ["drafts", "First rounds"],
          ["seasons", "Every season"],
        ]}
      />
      <div className="mt-8 rounded-3xl border border-white/10 bg-[rgba(22,58,44,0.45)] p-5 backdrop-blur-md md:p-8">
        {tab === "luck" ? (
          <div className="grid gap-10 md:grid-cols-2">
            <div>
              <h3 className="font-display text-4xl font-black">
                Luckiest seasons
              </h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Wins above what their points for and against predicted.
              </p>
              <ol className="mt-5 space-y-3">
                {luck.slice(0, 6).map((x) => (
                  <li
                    key={x.manager + x.season}
                    className="flex items-center gap-3"
                  >
                    <Av id={x.manager} s={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {x.manager}{" "}
                        <span className="font-normal text-[var(--muted)]">
                          {x.years}
                        </span>
                      </span>
                      <Bar
                        v={x.luck}
                        max={Math.abs(luck[0].luck)}
                        color="var(--gold)"
                      />
                    </span>
                    <span className="font-display w-16 text-right text-xl font-bold tabular-nums">
                      +{x.luck.toFixed(1)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h3 className="font-display text-4xl font-black">
                Unluckiest seasons
              </h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Scored enough to win more. The schedule had other ideas.
              </p>
              <ol className="mt-5 space-y-3">
                {[...luck]
                  .reverse()
                  .slice(0, 6)
                  .map((x) => (
                    <li
                      key={x.manager + x.season}
                      className="flex items-center gap-3"
                    >
                      <Av id={x.manager} s={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {x.manager}{" "}
                          <span className="font-normal text-[var(--muted)]">
                            {x.years}
                          </span>
                        </span>
                        <Bar
                          v={x.luck}
                          max={Math.abs(luck[luck.length - 1].luck)}
                          color="var(--ticket)"
                        />
                      </span>
                      <span className="font-display w-16 text-right text-xl font-bold tabular-nums">
                        {x.luck.toFixed(1)}
                      </span>
                    </li>
                  ))}
              </ol>
            </div>
            <div className="md:col-span-2">
              <h3 className="font-display text-3xl font-black">Career luck</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {[...career]
                  .sort((a, b) => b.luck - a.luck)
                  .map((m) => (
                    <span
                      key={m.id}
                      className="flex items-center gap-2 rounded-full bg-black/25 py-1 pr-3 pl-1 text-sm"
                    >
                      <Av id={m.id} s={26} />
                      {m.id}
                      <span
                        className={`font-semibold tabular-nums ${m.luck >= 0 ? "text-[var(--gold)]" : "text-[#ff8a7a]"}`}
                      >
                        {m.luck >= 0 ? "+" : ""}
                        {m.luck.toFixed(1)}
                      </span>
                    </span>
                  ))}
              </div>
            </div>
          </div>
        ) : null}

        {tab === "oddities" ? <Oddities seasons={seasons} /> : null}

        {tab === "playoffs" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead className="text-sm text-[var(--muted)]">
                <tr>
                  {[
                    "Manager",
                    "Playoff trips",
                    "Playoff record",
                    "Finals",
                    "Titles",
                    "Win rate in playoffs",
                  ].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...managers]
                  .map(
                    (m) =>
                      m as Manager & { pw: number; pl: number; finals: number },
                  )
                  .sort(
                    (a, b) =>
                      b.titles.length - a.titles.length ||
                      b.pw - a.pw ||
                      a.pl - b.pl,
                  )
                  .map((m) => (
                    <tr key={m.id} className="border-t border-white/8">
                      <th scope="row" className="px-3 py-2.5">
                        <span className="flex items-center gap-3 font-semibold">
                          <Av id={m.id} s={30} />
                          {m.id}
                        </span>
                      </th>
                      <td className="px-3 tabular-nums">{m.playoffs}</td>
                      <td className="font-display px-3 text-xl font-bold tabular-nums">
                        {rec(m.pw, m.pl)}
                      </td>
                      <td className="px-3 tabular-nums">{m.finals}</td>
                      <td className="px-3 text-[var(--gold)]">
                        {m.titles.length ? "★".repeat(m.titles.length) : "–"}
                      </td>
                      <td className="px-3 tabular-nums">
                        {m.pw + m.pl
                          ? `${Math.round((m.pw / (m.pw + m.pl)) * 100)}%`
                          : "–"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {tab === "partners" ? (
          <div>
            <h3 className="font-display text-4xl font-black">
              Who trades with who
            </h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Every completed two-team trade since 2023, by pairing.
            </p>
            <ol className="mt-6 grid gap-3 md:grid-cols-2">
              {partners.slice(0, 12).map((p) => (
                <li
                  key={p.a + p.b}
                  className="flex items-center gap-3 rounded-2xl bg-black/20 p-3"
                >
                  <Av id={p.a} s={36} />
                  <span
                    className="h-px flex-1 bg-gradient-to-r from-[var(--gold)]/60 to-[var(--gold)]/10"
                    style={{ height: Math.min(6, 1 + p.n / 2) }}
                  />
                  <Av id={p.b} s={36} />
                  <span className="min-w-0 text-sm">
                    <span className="block truncate font-semibold">
                      {p.a} + {p.b}
                    </span>
                  </span>
                  <span className="font-display ml-auto text-2xl font-black tabular-nums">
                    {p.n}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {tab === "waivers" ? (
          <div>
            <h3 className="font-display text-4xl font-black">Waiver hawks</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Players added off waivers and free agency, all seasons.
            </p>
            <ol className="mt-6 space-y-3">
              {[...managers]
                .map((m) => m as Manager & { adds: number })
                .sort((a, b) => b.adds - a.adds)
                .map((m, i, arr) => (
                  <li key={m.id} className="flex items-center gap-3">
                    <span className="font-display w-6 text-lg text-[var(--muted)]">
                      {i + 1}
                    </span>
                    <Av id={m.id} s={30} />
                    <span className="w-40 truncate text-sm font-semibold">
                      {m.id}
                    </span>
                    <span className="flex-1">
                      <Bar v={m.adds} max={arr[0].adds} color="var(--wood)" />
                    </span>
                    <span className="font-display w-14 text-right text-xl font-bold tabular-nums">
                      {m.adds}
                    </span>
                  </li>
                ))}
            </ol>
          </div>
        ) : null}

        {tab === "drafts" ? (
          <div className="grid gap-6 md:grid-cols-2">
            {seasons.map((s) => (
              <div key={s.code}>
                <h3 className="font-display text-3xl font-black">
                  {s.years} <span className="text-[var(--muted)]">round 1</span>
                </h3>
                <ol className="mt-3 space-y-1.5">
                  {s.draft.slice(0, 12).map((p) => (
                    <li key={p.no} className="flex items-center gap-3 text-sm">
                      <span className="font-display w-6 text-lg text-[var(--muted)] tabular-nums">
                        {p.no}
                      </span>
                      <span className="flex-1 truncate font-semibold">
                        {p.player}
                      </span>
                      <span className="truncate text-[var(--muted)]">
                        {p.by}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        ) : null}

        {tab === "seasons" ? (
          <div>
            <Segmented
              id="season"
              value={season}
              onChange={setSeason}
              options={seasons.map(
                (s) => [s.code, s.years] as [typeof s.code, string],
              )}
            />
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="text-[var(--muted)]">
                  <tr>
                    {[
                      "#",
                      "Manager",
                      "Record",
                      "Points for",
                      "Points against",
                      "Waiver adds",
                    ].map((h) => (
                      <th key={h} scope="col" className="px-3 py-2 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {seasons
                    .find((s) => s.code === season)!
                    .standings.map((r) => (
                      <tr key={r.manager} className="border-t border-white/8">
                        <td className="font-display px-3 py-2 text-lg text-[var(--muted)]">
                          {r.seed}
                        </td>
                        <th scope="row" className="px-3">
                          <span className="flex items-center gap-3 font-semibold">
                            <Av id={r.manager} s={28} />
                            {r.manager}
                            {seasons.find((s) => s.code === season)!
                              .champion === r.manager ? (
                              <span className="text-[var(--gold)]">★</span>
                            ) : null}
                          </span>
                        </th>
                        <td className="font-display px-3 text-lg font-bold tabular-nums">
                          {rec(r.w, r.l, r.t)}
                        </td>
                        <td className="px-3 tabular-nums">
                          {r.pf.toLocaleString()}
                        </td>
                        <td className="px-3 tabular-nums text-[var(--muted)]">
                          {((r as { pa?: number }).pa ?? 0).toLocaleString()}
                        </td>
                        <td className="px-3 tabular-nums">
                          {(r as { adds?: number }).adds ?? 0}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
      <AlmanacNote tab={tab} />
    </div>
  );
}

/* ── Oddities: niche records nobody else tracks ─────────────────────── */
const OddCard = ({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-2xl bg-black/20 p-5">
    <h3 className="font-display text-3xl leading-none font-black">{title}</h3>
    <p className="mt-1 text-sm text-[var(--muted)]">{sub}</p>
    <div className="mt-4">{children}</div>
  </div>
);

function Oddities({ seasons }: { seasons: Season[] }) {
  const done = seasons.filter((s) => s.status === "complete");
  // Players who changed hands the most
  const moved = new Map<
    string,
    { n: number; pid: string | null; owners: string[] }
  >();
  for (const s of seasons)
    for (const t of s.trades)
      for (const [who, got] of Object.entries(t.sides))
        for (const p of got) {
          if (!p.pid) continue;
          const x = moved.get(p.name) ?? { n: 0, pid: p.pid, owners: [] };
          x.n += 1;
          x.owners.push(who);
          moved.set(p.name, x);
        }
  const mostMoved = [...moved.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 6);
  // Pick #1 curse
  const pick1 = seasons.map((s) => {
    const p = s.draft.find((d) => d.no === 1);
    const st = s.standings.find((r) => r.manager === p?.by);
    const finish =
      s.champion === p?.by
        ? "Won the title"
        : s.status !== "complete"
          ? "Season in progress"
          : st && st.seed <= 8
            ? `Made the playoffs (#${st.seed} seed)`
            : `Missed the playoffs (#${st?.seed})`;
    return { years: s.years, player: p?.player ?? "", by: p?.by ?? "", finish };
  });
  // Highest scorers who missed the playoffs; most points allowed
  const missed = done
    .flatMap((s) =>
      s.standings
        .filter((r) => r.seed > 8)
        .map((r) => ({ ...r, years: s.years })),
    )
    .sort((a, b) => b.pf - a.pf)
    .slice(0, 4);
  const allowed = done
    .flatMap((s) =>
      s.standings.map((r) => ({
        ...r,
        years: s.years,
        pa: (r as { pa?: number }).pa ?? 0,
      })),
    )
    .sort((a, b) => b.pa - a.pa)
    .slice(0, 4);
  // Busiest trade weeks
  const weeks = seasons
    .flatMap((s) => {
      const c = new Map<number, number>();
      s.trades.forEach((t) => c.set(t.week, (c.get(t.week) ?? 0) + 1));
      return [...c.entries()].map(([w, n]) => ({ years: s.years, week: w, n }));
    })
    .sort((a, b) => b.n - a.n)
    .slice(0, 4);
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <OddCard
        title="Most-traded players"
        sub="Times a player changed hands in a Trash trade."
      >
        <ol className="space-y-2.5">
          {mostMoved.map(([name, x]) => (
            <li key={name} className="flex items-center gap-3">
              <span className="relative h-9 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--bin-3)]">
                {x.pid ? (
                  <Image
                    src={`https://sleepercdn.com/content/nba/players/${x.pid}.jpg`}
                    alt=""
                    fill
                    sizes="48px"
                    className="object-contain object-bottom"
                    unoptimized
                  />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {name}
                </span>
                <span className="block truncate text-xs text-[var(--muted)]">
                  to {[...new Set(x.owners)].join(", ")}
                </span>
              </span>
              <span className="font-display text-2xl font-black tabular-nums">
                {x.n}×
              </span>
            </li>
          ))}
        </ol>
      </OddCard>
      <OddCard
        title="The pick #1 curse"
        sub="What happened to whoever drafted first overall."
      >
        <ol className="space-y-2.5">
          {pick1.map((p) => (
            <li key={p.years} className="flex items-center gap-3 text-sm">
              <Av id={p.by} s={30} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {p.years}: {p.player}
                </span>
                <span className="block truncate text-xs text-[var(--muted)]">
                  {p.by}
                </span>
              </span>
              <span
                className={`text-right text-xs ${p.finish === "Won the title" ? "text-[var(--gold)]" : ""}`}
              >
                {p.finish}
              </span>
            </li>
          ))}
        </ol>
      </OddCard>
      <OddCard
        title="Scored a lot, still missed"
        sub="Most points for in a season without making the playoffs."
      >
        <ol className="space-y-2.5">
          {missed.map((r) => (
            <li
              key={r.manager + r.years}
              className="flex items-center gap-3 text-sm"
            >
              <Av id={r.manager} s={30} />
              <span className="flex-1 truncate font-semibold">
                {r.manager}{" "}
                <span className="font-normal text-[var(--muted)]">
                  {r.years}, #{r.seed}
                </span>
              </span>
              <span className="tabular-nums">{r.pf.toLocaleString()} pts</span>
            </li>
          ))}
        </ol>
      </OddCard>
      <OddCard
        title="Most points allowed"
        sub="The seasons when opponents saved their best for you."
      >
        <ol className="space-y-2.5">
          {allowed.map((r) => (
            <li
              key={r.manager + r.years}
              className="flex items-center gap-3 text-sm"
            >
              <Av id={r.manager} s={30} />
              <span className="flex-1 truncate font-semibold">
                {r.manager}{" "}
                <span className="font-normal text-[var(--muted)]">
                  {r.years}, went {rec(r.w, r.l, r.t)}
                </span>
              </span>
              <span className="tabular-nums">
                {r.pa.toLocaleString()} against
              </span>
            </li>
          ))}
        </ol>
      </OddCard>
      <OddCard
        title="Busiest trade weeks"
        sub="The weeks the league couldn't stop dealing."
      >
        <ol className="space-y-2">
          {weeks.map((w) => (
            <li key={w.years + w.week} className="flex justify-between text-sm">
              <span>
                {w.years}, week {w.week}
              </span>
              <span className="font-display text-xl font-bold tabular-nums">
                {w.n} trades
              </span>
            </li>
          ))}
        </ol>
      </OddCard>
    </div>
  );
}

const ALMANAC_NOTES: Record<string, React.ReactNode> = {
  luck: (
    <p>
      Luck compares actual wins with the wins a team&apos;s season points for
      and against would normally produce (a Pythagorean expectation, the formula
      baseball analysts use). +2.0 means two more wins than the points earned: a
      soft schedule or close wins. Negative means the schedule was cruel.
    </p>
  ),
  oddities: (
    <p>
      Everything here comes from the Sleeper trade log, drafts and official
      season standings. Playoff spots are the top 8 seeds.
    </p>
  ),
  playoffs: (
    <p>
      Championship-bracket games only. Consolation games don&apos;t count. A
      trip is any season seeded in the top 8.
    </p>
  ),
  partners: (
    <p>
      Every completed two-team trade, grouped by the pair of managers involved,
      across all four seasons.
    </p>
  ),
  waivers: (
    <p>
      Every player added through waivers or free agency, from Sleeper&apos;s
      transaction log for all four seasons.
    </p>
  ),
  drafts: <p>The first twelve picks of each season&apos;s snake draft.</p>,
  seasons: (
    <p>
      Official final regular-season tables. Ties are broken by points for. The
      star marks the eventual champion.
    </p>
  ),
};
export function AlmanacNote({ tab }: { tab: string }) {
  return <Explain>{ALMANAC_NOTES[tab]}</Explain>;
}
