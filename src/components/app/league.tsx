import Link from "next/link";
import { Avatar } from "@/components/app/avatar";
import type { LeaguePage } from "@/lib/app/league-page";
import { recordStr, type SeasonView, type Team } from "@/lib/app/model";
import { seasonYears } from "@/lib/app/sleeper";

const fmt = (x: number, d = 1) => x.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/** A page section. `level={1}` when it's the page's main heading (pages without their own header). */
export function Section({
  id,
  title,
  lede,
  children,
  level = 2,
}: {
  id: string;
  title: string;
  lede?: React.ReactNode;
  children: React.ReactNode;
  level?: 1 | 2;
}) {
  const H = level === 1 ? "h1" : "h2";
  return (
    <section aria-labelledby={id} className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 md:px-10 md:py-20">
      <H id={id} className="font-display text-4xl leading-none font-black md:text-6xl">
        {title}
      </H>
      {lede ? <div className="mt-4 max-w-[62ch] text-[var(--muted)] md:text-lg">{lede}</div> : null}
      <div className="mt-8 md:mt-10">{children}</div>
    </section>
  );
}

/* ── The rafters: one banner per season ─────────────────────────────── */
export function Banners({ p }: { p: LeaguePage }) {
  const seasons = [...p.view.seasons].reverse();
  return (
    <div className="relative">
      {/* The rigging bar the banners hang from. */}
      <div aria-hidden className="absolute inset-x-0 top-3 h-[3px] bg-gradient-to-r from-transparent via-[#3a4a6b] to-transparent" />
      <ol className="flex gap-3 overflow-x-auto px-4 pt-3 pb-6 [scrollbar-width:none] md:justify-center md:gap-5 md:px-10" aria-label="Seasons">
        {seasons.map((s, i) => {
          const champ = s.champion;
          return (
            <li key={s.leagueId} className="banner-drop shrink-0" style={{ "--i": i } as React.CSSProperties}>
              <div aria-hidden className="mx-auto h-4 w-[2px] bg-[#3a4a6b]" />
              <div
                className={`banner flex h-52 w-32 flex-col items-center px-3 pt-4 pb-10 text-center md:h-60 md:w-36 ${
                  champ ? "bg-gradient-to-b from-[#1f2f52] to-[#17233d]" : "bg-[var(--bin-2)]"
                }`}
                style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)" }}
              >
                <p className="text-xs font-semibold text-[var(--muted)]">{s.years}</p>
                {champ ? (
                  <>
                    <p className="font-display mt-3 text-[13px] font-bold text-[var(--gold)]">Champions</p>
                    <p className="font-display mt-1 line-clamp-3 text-xl leading-[0.95] font-black [overflow-wrap:anywhere] md:text-2xl text-[var(--gold)]">
                      {champ.team}
                    </p>
                    <p className="mt-auto line-clamp-1 text-xs text-[var(--paper)]/80">{p.nameOf(champ.ownerId)}</p>
                  </>
                ) : (
                  <>
                    <p className="font-display mt-3 text-2xl leading-[0.95] font-black text-[var(--paper)]/70">
                      {s.complete ? "No champion recorded" : s.status === "in_season" ? "In progress" : "Not started"}
                    </p>
                    {s.top && !s.complete ? (
                      <p className="mt-auto line-clamp-2 text-xs text-[var(--muted)]">Leading: {p.nameOf(s.top.ownerId)}</p>
                    ) : null}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ── This season's table, on hardwood ───────────────────────────────── */
export function CurrentTable({ p }: { p: LeaguePage }) {
  const s = p.view.current;
  const weeks = s.weeksDone;
  const hasExact = [...p.weekly.values()].some((m) => m.size > 0);
  return (
    <div>
      <div className="hardwood rounded-t-2xl px-4 py-3 text-[#2a1606] md:px-6">
        <p className="font-display text-2xl font-black">
          {s.name}, {s.years}
        </p>
        <p className="text-sm font-semibold opacity-80">
          {weeks ? `After ${weeks} week${weeks === 1 ? "" : "s"}. Ranked by record, then official points for.` : "No games played yet."}
        </p>
      </div>
      <div className="overflow-x-auto rounded-b-2xl border border-t-0 border-[var(--line)] bg-[var(--bin-2)]">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-xs text-[var(--muted)]">
            <tr className="border-b border-[var(--line)]">
              <th className="w-9 py-3 pl-4 font-medium md:w-12 md:pl-6">#</th>
              <th className="py-3 font-medium">Team</th>
              <th className="py-3 text-right font-medium">Record</th>
              <th className="py-3 pr-4 text-right font-medium whitespace-nowrap sm:pr-0">Points for</th>
              <th className="hidden py-3 text-right font-medium sm:table-cell">Against</th>
              <th className="hidden py-3 pr-4 text-right font-medium sm:table-cell md:pr-6">Streak</th>
            </tr>
          </thead>
          <tbody>
            {s.teams.map((t) => (
              <tr key={t.rosterId} className="border-b border-[var(--line)] last:border-0">
                <td className="py-3 pl-4 text-[var(--muted)] md:pl-6">{t.seed}</td>
                <td className="w-full max-w-0 py-3 pr-2">
                  <TeamCell t={t} name={p.nameOf(t.ownerId)} />
                </td>
                <td className="py-3 pr-3 text-right font-semibold whitespace-nowrap">{recordStr(t)}</td>
                <td className="py-3 pr-4 text-right sm:pr-0">{fmt(t.pf)}</td>
                <td className="hidden py-3 text-right text-[var(--muted)] sm:table-cell">{fmt(t.pa)}</td>
                <td className="hidden py-3 pr-4 text-right text-[var(--muted)] sm:table-cell md:pr-6">{t.streak || "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PointsLog p={p} hasExact={hasExact} />
    </div>
  );
}

function TeamCell({ t, name }: { t: Team; name: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar src={t.avatar} name={name} />
      <div className="min-w-0">
        <p className="truncate font-semibold">{t.team}</p>
        {t.team !== name ? <p className="truncate text-xs text-[var(--muted)]">{name}</p> : null}
      </div>
    </div>
  );
}

/** The nightly official points-for log, and the exact weekly scores it yields. */
function PointsLog({ p, hasExact }: { p: LeaguePage; hasExact: boolean }) {
  if (!p.db) return null;
  const s = p.view.current;
  if (!p.nights)
    return <p className="mt-4 text-sm text-[var(--muted)]">Official points for will be saved here every night once the season starts.</p>;
  const weeks = [...new Set([...p.weekly.values()].flatMap((m) => [...m.keys()]))].sort((a, b) => a - b);
  return (
    <div className="mt-6">
      <p className="text-sm text-[var(--muted)]">
        Official points for saved every night since {p.firstNight} ({p.nights} night{p.nights === 1 ? "" : "s"} so far).
        {hasExact
          ? " Weekly scores below are exact: the difference between the official totals on either side of each week."
          : " Exact weekly scores appear once a full week falls between two saved nights."}
      </p>
      {hasExact ? (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--line)]">
          <table className="w-full text-sm tabular-nums">
            <thead className="text-xs text-[var(--muted)]">
              <tr className="border-b border-[var(--line)]">
                <th className="py-2 pl-4 text-left font-medium">Team</th>
                {weeks.map((w) => (
                  <th key={w} className="px-3 py-2 text-right font-medium">
                    Week {w}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.teams.map((t) => (
                <tr key={t.rosterId} className="border-b border-[var(--line)] last:border-0">
                  <td className="max-w-[12rem] truncate py-2 pl-4">{t.team}</td>
                  {weeks.map((w) => {
                    const v = p.weekly.get(t.rosterId)?.get(w);
                    return (
                      <td key={w} className="px-3 py-2 text-right">
                        {v === undefined ? <span className="text-[var(--muted)]">–</span> : fmt(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

/* ── All-time records ───────────────────────────────────────────────── */
export function Careers({ p, limit }: { p: LeaguePage; limit?: number }) {
  const rows = limit ? p.view.careers.slice(0, limit) : p.view.careers;
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--line)]">
      <table className="w-full text-sm tabular-nums">
        <thead className="text-left text-xs text-[var(--muted)]">
          <tr className="border-b border-[var(--line)]">
            <th className="py-3 pl-4 font-medium md:pl-6">Manager</th>
            <th className="hidden py-3 text-right font-medium sm:table-cell">Seasons</th>
            <th className="py-3 text-right font-medium">Record</th>
            <th className="py-3 pr-3 text-right font-medium whitespace-nowrap">Win %</th>
            <th className="hidden py-3 text-right font-medium sm:table-cell">Playoffs</th>
            <th className="hidden py-3 text-right font-medium sm:table-cell">Finals</th>
            <th className="py-3 pr-4 text-right font-medium md:pr-6">Titles</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.ownerId} className="border-b border-[var(--line)] last:border-0">
              <td className="w-full max-w-0 py-3 pr-2 pl-4 md:pl-6">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar src={c.avatar} name={p.nameOf(c.ownerId)} />
                  <div className="min-w-0">
                    <Link href={`/l/${p.leagueId}/managers/${c.ownerId}`} className="block truncate font-semibold underline-offset-4 hover:underline">
                      {p.nameOf(c.ownerId)}
                    </Link>
                    <p className="truncate text-xs text-[var(--muted)]">{c.team}</p>
                  </div>
                </div>
              </td>
              <td className="hidden py-3 text-right sm:table-cell">{c.seasons}</td>
              <td className="py-3 pr-3 text-right font-semibold whitespace-nowrap">{recordStr(c)}</td>
              <td className="py-3 pr-3 text-right">{pct(c.pct)}</td>
              <td className="hidden py-3 text-right sm:table-cell">{c.playoffs}</td>
              <td className="hidden py-3 text-right sm:table-cell">{c.finals}</td>
              <td className="py-3 pr-4 text-right md:pr-6">
                {c.titles.length ? (
                  <span className="font-semibold text-[var(--gold)]" title={c.titles.join(", ")}>
                    {c.titles.length}
                  </span>
                ) : (
                  <span className="text-[var(--muted)]">0</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Season by season ───────────────────────────────────────────────── */
export function Archive({ p }: { p: LeaguePage }) {
  const seasons = [...p.view.seasons].reverse();
  return (
    <ol className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
      {seasons.map((s) => (
        <li key={s.leagueId} className="grid gap-4 py-6 md:grid-cols-[10rem_1fr_1fr] md:gap-8">
          <div>
            <p className="font-display text-3xl font-black">{s.years}</p>
            <p className="text-sm text-[var(--muted)]">{s.name}</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Fact label="Champion" team={s.champion} p={p} gold />
            <Fact label="Runner-up" team={s.runnerUp} p={p} />
            <Fact label="Best record" team={s.top} p={p} extra={s.top ? recordStr(s.top) : undefined} />
            <Fact label="Most points" team={mostPoints(s)} p={p} extra={mostPoints(s) ? fmt(mostPoints(s)!.pf) : undefined} />
          </dl>
          {s.firstRound.length ? (
            <div className="text-sm">
              <p className="text-[var(--muted)]">First picks</p>
              <ol className="mt-1 space-y-0.5">
                {s.firstRound.slice(0, 4).map((pk) => (
                  <li key={pk.no} className="truncate">
                    <span className="text-[var(--muted)] tabular-nums">{pk.no}.</span> {pk.player}{" "}
                    <span className="text-[var(--muted)]">to {pk.team ? p.nameOf(pk.team.ownerId) : "?"}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
const mostPoints = (s: SeasonView) => (s.teams.some((t) => t.pf > 0) ? [...s.teams].sort((a, b) => b.pf - a.pf)[0] : null);

function Fact({ label, team, p, gold, extra }: { label: string; team: Team | null; p: LeaguePage; gold?: boolean; extra?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className={`truncate font-semibold ${gold && team ? "text-[var(--gold)]" : ""}`}>
        {team ? p.nameOf(team.ownerId) : "–"}
        {extra ? <span className="font-normal text-[var(--muted)]"> {extra}</span> : null}
      </dd>
    </div>
  );
}

/* ── Trade court ────────────────────────────────────────────────────── */
/** Every trade with its grade. With `only`, just that manager's trades and no dealer table. */
export function TradeCourt({ p, only }: { p: LeaguePage; only?: string }) {
  const a0 = p.analysis!;
  const a = only ? { ...a0, trades: a0.trades.filter((t) => t.sides.some((s) => s.who === only)) } : a0;
  if (!a.trades.length)
    return <p className="text-[var(--muted)]">{only ? "No trades yet." : "No trades yet. Somebody has to go first."}</p>;
  const name = (pid: string) => (pid.startsWith("pick:") ? pid.slice(5).replace(" R", " round ") + " pick" : (a.players[pid]?.[0] ?? "Unknown player"));
  const card = (t: (typeof a.trades)[number], i: number) => (
    <li key={`${t.ts}-${i}`} className="py-5">
      <p className="text-sm text-[var(--muted)]">
        {t.years}, week {t.week}.{" "}
        {t.weeksAfter === 0 ? (
          "Too soon to call: no games since."
        ) : t.winner ? (
          <span className="text-[var(--paper)]">
            {p.nameOf(t.winner)} won it by {fmt(t.margin)}.
          </span>
        ) : (
          "Called even."
        )}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {t.sides.map((sd) => (
          <div key={sd.who} className={`rounded-xl border p-4 ${t.winner === sd.who ? "border-[var(--wood)]/70" : "border-[var(--line)]"}`}>
            <p className="flex items-baseline justify-between gap-3">
              <span className="truncate font-semibold">{p.nameOf(sd.who)} got</span>
              <span className="shrink-0 text-sm tabular-nums">{fmt(sd.pts)} pts</span>
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">{sd.got.map(name).join(", ") || "Nothing"}</p>
          </div>
        ))}
      </div>
    </li>
  );
  return (
    <div className={only ? "" : "grid gap-10 lg:grid-cols-[18rem_1fr]"}>
      <div className={only ? "hidden" : ""}>
        <p className="font-display text-2xl font-black">Best dealers</p>
        <ol className="mt-3 divide-y divide-[var(--line)] text-sm">
          {a.dealers.slice(0, 8).map((d) => (
            <li key={d.who} className="flex items-center justify-between gap-3 py-2 tabular-nums">
              <span className="truncate">{p.nameOf(d.who)}</span>
              <span className="shrink-0 text-[var(--muted)]">
                {d.w}–{d.l}–{d.e}{" "}
                <span className={d.net >= 0 ? "text-[var(--paper)]" : ""}>
                  {d.net >= 0 ? "+" : "−"}
                  {Math.abs(d.net).toLocaleString()}
                </span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-[var(--muted)]">Won, lost, even. Net points gained across every trade.</p>
      </div>
      <div>
        <ol className="divide-y divide-[var(--line)] border-y border-[var(--line)]">{a.trades.slice(0, 6).map(card)}</ol>
        {a.trades.length > 6 ? (
          <details className="group">
            <summary className="mt-4 inline-flex cursor-pointer list-none rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:border-[var(--muted)]">
              <span className="group-open:hidden">Show all {a.trades.length} trades</span>
              <span className="hidden group-open:inline">Show fewer</span>
            </summary>
            <ol className="divide-y divide-[var(--line)] border-b border-[var(--line)]">{a.trades.slice(6).map((t, i) => card(t, i + 6))}</ol>
          </details>
        ) : null}
      </div>
    </div>
  );
}

/* ── Lineups ────────────────────────────────────────────────────────── */
export function Lineups({ p }: { p: LeaguePage }) {
  const a = p.analysis!;
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
      <div className="overflow-x-auto rounded-2xl border border-[var(--line)]">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-xs text-[var(--muted)]">
            <tr className="border-b border-[var(--line)]">
              <th className="py-3 pl-4 font-medium md:pl-6">Manager</th>
              <th className="py-3 pr-3 text-right font-medium">Efficiency</th>
              <th className="py-3 pr-4 text-right font-medium sm:pr-0">Benched a week</th>
              <th className="hidden py-3 pr-4 text-right font-medium sm:table-cell md:pr-6">Near-perfect weeks</th>
            </tr>
          </thead>
          <tbody>
            {a.lineups.map((r) => (
              <tr key={r.who} className="border-b border-[var(--line)] last:border-0">
                <td className="w-full max-w-0 truncate py-3 pr-2 pl-4 font-semibold md:pl-6">{p.nameOf(r.who)}</td>
                <td className="py-3 text-right">
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-[var(--bin-3)] sm:block">
                      <span className="block h-full bg-[var(--wood)]" style={{ width: `${(r.act / r.opt) * 100}%` }} />
                    </span>
                    {pct(r.act / r.opt)}
                  </span>
                </td>
                <td className="py-3 pr-4 text-right sm:pr-0">{fmt((r.opt - r.act) / r.weeks)}</td>
                <td className="hidden py-3 pr-4 text-right sm:table-cell md:pr-6">{r.perfect}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <p className="font-display text-2xl font-black">Worst benchings</p>
        <p className="mt-1 text-xs text-[var(--muted)]">Single weeks, per Sleeper.</p>
        <ol className="mt-3 divide-y divide-[var(--line)] text-sm">
          {a.crimes.slice(0, 6).map((c, i) => (
            <li key={i} className="flex items-center justify-between gap-3 py-2 tabular-nums">
              <span className="min-w-0">
                <span className="block truncate">{p.nameOf(c.who)}</span>
                <span className="text-xs text-[var(--muted)]">
                  {c.years}, week {c.week}
                </span>
              </span>
              <span className="shrink-0 text-right">
                {fmt(c.act)} <span className="text-[var(--muted)]">of {fmt(c.opt)}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export function Pickups({ p }: { p: LeaguePage }) {
  const a = p.analysis!;
  if (!a.pickups.length) return null;
  return (
    <ol className="grid gap-x-8 sm:grid-cols-2">
      {a.pickups.slice(0, 8).map((x, i) => (
        <li key={`${x.pid}-${i}`} className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-3 text-sm tabular-nums">
          <span className="min-w-0">
            <span className="block truncate font-semibold">{a.players[x.pid]?.[0] ?? "Unknown player"}</span>
            <span className="text-xs text-[var(--muted)]">
              {p.nameOf(x.who)}, {seasonYears(x.season, p.view.sport)} week {x.week}
            </span>
          </span>
          <span className="shrink-0 text-right">
            {fmt(x.pts)} <span className="text-[var(--muted)]">in {x.starts} starts</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/* ── Custom pack ────────────────────────────────────────────────────── */
export function PackSection({ p }: { p: LeaguePage }) {
  const pack = p.pack!;
  return (
    <ul className="grid gap-x-10 sm:grid-cols-2">
      {pack.features.map((f) => (
        <li key={f.key} className="border-b border-[var(--line)] py-4">
          {f.href ? (
            <a href={f.href} className="font-semibold underline decoration-[var(--wood)] underline-offset-4 hover:decoration-2">
              {f.title}
            </a>
          ) : (
            <p className="font-semibold">{f.title}</p>
          )}
          <p className="mt-1 text-sm text-[var(--muted)]">{f.line}</p>
        </li>
      ))}
    </ul>
  );
}
