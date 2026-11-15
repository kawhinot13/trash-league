import Link from "next/link";
import { Avatar } from "@/components/app/avatar";
import { Section, TradeCourt } from "@/components/app/league";
import type { Game } from "@/lib/app/analysis";
import type { LeaguePage } from "@/lib/app/league-page";
import { recordStr, type Finish } from "@/lib/app/model";

const fmt = (x: number, d = 1) => x.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const RANK: Record<string, number> = { Champion: 5, "Runner-up": 4, Third: 3, Semifinal: 2, Playoffs: 1 };

/** A manager's record against each opponent, from the per-Sleeper game list. */
export function recordsVs(games: Game[], who: string) {
  const by = new Map<string, { opp: string; w: number; l: number; t: number; pf: number; pa: number; po: number }>();
  for (const g of games) {
    if (g.a !== who && g.b !== who) continue;
    const me = g.a === who ? g.pa : g.pb;
    const them = g.a === who ? g.pb : g.pa;
    const opp = g.a === who ? g.b : g.a;
    const r = by.get(opp) ?? { opp, w: 0, l: 0, t: 0, pf: 0, pa: 0, po: 0 };
    if (me > them) r.w += 1;
    else if (me < them) r.l += 1;
    else r.t += 1;
    r.pf += me;
    r.pa += them;
    if (g.playoff) r.po += 1;
    by.set(opp, r);
  }
  return [...by.values()].sort((a, b) => b.w + b.l + b.t - (a.w + a.l + a.t) || b.w - b.l - (a.w - a.l));
}

export function ManagerProfile({ p, ownerId }: { p: LeaguePage; ownerId: string }) {
  const c = p.view.careers.find((x) => x.ownerId === ownerId)!;
  const name = p.nameOf(ownerId);
  const seasons = p.view.seasons
    .map((s) => {
      const t = s.teams.find((x) => x.ownerId === ownerId);
      return t ? { s, t, finish: (s.finish.get(t.rosterId) ?? null) as Finish } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .reverse();
  // Best season: deepest playoff run, then best record, then most points (finished seasons first).
  const best = [...seasons].sort(
    (a, b) =>
      Number(b.s.complete) - Number(a.s.complete) ||
      (RANK[b.finish ?? ""] ?? 0) - (RANK[a.finish ?? ""] ?? 0) ||
      b.t.w + b.t.t / 2 - (a.t.w + a.t.t / 2) ||
      b.t.pf - a.t.pf,
  )[0];
  const a = p.analysis;
  const lineup = a?.lineups.find((r) => r.who === ownerId);
  const dealer = a?.dealers.find((d) => d.who === ownerId);
  const pickups = a?.pickups.filter((x) => x.who === ownerId) ?? [];
  const vs = a ? recordsVs(a.games, ownerId) : [];

  return (
    <main>
      <header className="mx-auto max-w-6xl px-5 pt-32 md:px-10 md:pt-40">
        <div className="flex items-center gap-4">
          <Avatar src={c.avatar} name={name} size={64} />
          <div className="min-w-0">
            <h1 className="font-display text-[clamp(2.8rem,9vw,6.5rem)] leading-[0.86] font-black break-words">{name}</h1>
            {name !== c.name ? <p className="text-[var(--muted)]">{c.name} on Sleeper</p> : null}
          </div>
        </div>
        <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-6 border-y border-[var(--line)] py-6 sm:grid-cols-4">
          <Stat label="Career record" value={recordStr(c)} sub={`${pct(c.pct)} over ${c.seasons} season${c.seasons === 1 ? "" : "s"}`} />
          <Stat label="Titles" value={String(c.titles.length)} sub={c.titles.length ? c.titles.join(", ") : `${c.finals} final${c.finals === 1 ? "" : "s"}`} gold={c.titles.length > 0} />
          <Stat label="Playoffs" value={`${c.playoffs} of ${c.seasons}`} sub={c.best ?? "Not yet"} />
          <Stat label="Points for" value={fmt(c.pf, 0)} sub="Official, all seasons" />
        </dl>
      </header>

      {best ? (
        <Section id="best" title="Best season">
          <p className="max-w-[60ch] text-lg">
            <span className="font-display text-4xl font-black">{best.s.years}</span>
            <br />
            {best.t.team}: {recordStr(best.t)}, {fmt(best.t.pf)} points
            {best.finish ? `, ${best.finish === "Playoffs" ? "made the playoffs" : best.finish.toLowerCase()}` : ""}.
          </p>
        </Section>
      ) : null}

      <Section id="seasons" title="Season by season">
        <div className="overflow-x-auto rounded-2xl border border-[var(--line)]">
          <table className="w-full text-sm tabular-nums">
            <thead className="text-left text-xs text-[var(--muted)]">
              <tr className="border-b border-[var(--line)]">
                <th className="py-3 pl-4 font-medium md:pl-6">Season</th>
                <th className="py-3 pr-3 text-right font-medium">Record</th>
                <th className="hidden py-3 text-right font-medium sm:table-cell">Seed</th>
                <th className="hidden py-3 text-right font-medium sm:table-cell">Points for</th>
                <th className="py-3 pr-4 text-right font-medium md:pr-6">Finish</th>
              </tr>
            </thead>
            <tbody>
              {seasons.map(({ s, t, finish }) => (
                <tr key={s.leagueId} className="border-b border-[var(--line)] last:border-0">
                  <td className="w-full max-w-0 py-3 pr-2 pl-4 md:pl-6">
                    <p className="font-semibold">{s.years}</p>
                    <p className="truncate text-xs text-[var(--muted)]">{t.team}</p>
                  </td>
                  <td className="py-3 pr-3 text-right font-semibold whitespace-nowrap">{recordStr(t)}</td>
                  <td className="hidden py-3 text-right sm:table-cell">{t.seed}</td>
                  <td className="hidden py-3 text-right sm:table-cell">{fmt(t.pf)}</td>
                  <td className={`py-3 pr-4 text-right whitespace-nowrap md:pr-6 ${finish === "Champion" ? "font-semibold text-[var(--gold)]" : ""}`}>
                    {finish ?? (s.complete ? "Missed playoffs" : "In progress")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {a ? (
        <>
          {vs.length ? (
            <Section id="vs" title="Head to head" lede="Every meeting, per Sleeper's weekly matchup scores. Tap an opponent for the full rivalry.">
              <ol className="grid gap-x-8 sm:grid-cols-2">
                {vs.map((r) => (
                  <li key={r.opp} className="border-b border-[var(--line)]">
                    <Link
                      href={`/l/${p.leagueId}/rivals`}
                      className="flex items-center justify-between gap-3 py-3 text-sm tabular-nums hover:text-[var(--paper)]"
                    >
                      <span className="min-w-0 truncate font-semibold">vs {p.nameOf(r.opp)}</span>
                      <span className="shrink-0 text-right">
                        <span className="font-semibold">{recordStr(r)}</span>
                        {r.po ? <span className="text-[var(--muted)]"> incl. {r.po} playoff</span> : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </Section>
          ) : null}

          <Section
            id="trades"
            title="Trade history"
            lede={
              dealer
                ? `${dealer.w} won, ${dealer.l} lost, ${dealer.e} even. Net ${dealer.net >= 0 ? "+" : "−"}${Math.abs(dealer.net).toLocaleString()} points across every deal, per Sleeper's lineups.`
                : undefined
            }
          >
            <TradeCourt p={p} only={ownerId} />
          </Section>

          {lineup || pickups.length ? (
            <Section id="lineups" title="Lineups and pickups">
              {lineup ? (
                <p className="max-w-[60ch] text-lg">
                  Set {pct(lineup.act / lineup.opt)} of the best possible lineup over {lineup.weeks} weeks, leaving{" "}
                  {fmt((lineup.opt - lineup.act) / lineup.weeks)} points a week on the bench.
                </p>
              ) : null}
              {pickups.length ? (
                <ol className="mt-6 grid gap-x-8 sm:grid-cols-2">
                  {pickups.map((x, i) => (
                    <li key={`${x.pid}-${i}`} className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-3 text-sm tabular-nums">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{a.players[x.pid]?.[0] ?? "Unknown player"}</span>
                        <span className="text-xs text-[var(--muted)]">
                          Picked up {x.years}, week {x.week}
                        </span>
                      </span>
                      <span className="shrink-0">{fmt(x.pts)} pts</span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </Section>
          ) : null}
        </>
      ) : (
        <Section id="more" title="Trades and rivalries">
          <p className="text-[var(--muted)]">These appear once the league&apos;s import finishes. Check the overview for progress.</p>
        </Section>
      )}
    </main>
  );
}

function Stat({ label, value, sub, gold }: { label: string; value: string; sub?: string; gold?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-[var(--muted)]">{label}</dt>
      <dd className={`font-display mt-1 text-4xl leading-none font-black tabular-nums ${gold ? "text-[var(--gold)]" : ""}`}>{value}</dd>
      {sub ? <dd className="mt-1 truncate text-sm text-[var(--muted)]">{sub}</dd> : null}
    </div>
  );
}
