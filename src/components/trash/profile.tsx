import Link from "next/link";
import { notFound } from "next/navigation";
import { Handle, MgrLink, MgrPhoto, Src } from "@/components/trash/brand";
import { Face, pname } from "@/components/trash/player";
import { draftEye, lockIn, myGuys, tradeCourt, yearsOf } from "@/lib/core/extras";
import { h2h as coreH2h, record } from "@/lib/core/league";
import type { Dataset } from "@/lib/core/types";
import { lineupTerms } from "@/lib/core/lineup-terms";
import { tradeRule } from "@/lib/core/stat-notes";
import { Explain } from "@/components/trash/intel";

/**
 * A manager's profile: record, scouting report (lineups, their guys, draft eye, trade record),
 * season by season, who they own and every trade. Shared by Trash and Rafterlore; links, photos
 * and handles come from the brand.
 */
export function ManagerProfileView({
  d,
  id,
  label,
  base = "",
  lineup,
  even = 60,
}: {
  d: Dataset;
  id: string;
  label: Record<string, string>;
  base?: string;
  /** The league's lineup type, for wording (Trash: lock-in). */
  lineup?: "lock-in" | "daily" | "weekly" | null;
  /** Margin under which a trade is called even (Rafterlore scales it to the league). */
  even?: number;
}) {
  const terms = lineupTerms(lineup);
  const { league } = d;
  const players = d.extras.players;
  const seasonYears = yearsOf(d);
  const seasonLabel = label;
  const m = league.managers.find((x) => x.id === id);
  if (!m) notFound();
  const h2h = (a: string, b: string) => coreH2h(league, a, b);
  const rivals = league.managers
    .filter((o) => o.id !== m.id)
    .map((o) => {
      const [w, l] = h2h(m.id, o.id);
      return { id: o.id, w, l };
    })
    .filter((r) => r.w + r.l > 0)
    .sort((a, b) => b.w - b.l - (a.w - a.l));
  const owns = rivals.filter((r) => r.w > r.l).slice(0, 3);
  const ownedBy = [...rivals].reverse().filter((r) => r.l > r.w).slice(0, 3);
  const trades = league.seasons.flatMap((s) => s.trades.filter((t) => t.sides[m.id]).map((t) => ({ ...t, years: s.years })));
  const lock = lockIn(d);
  const lr = lock.rows.find((r) => r.id === m.id);
  const lockRank = lock.rows.findIndex((r) => r.id === m.id) + 1;
  const guys = myGuys(d).find((g) => g.id === m.id);
  const eye = draftEye(d, m.id);
  const court = tradeCourt(d, even);
  const rec = court.records.find((r) => r.id === m.id);
  const myTrades = court.trades.filter((t) => t.sides.some((x) => x.who === m.id));
  const net = (t: (typeof myTrades)[number]) => {
    const me = t.sides.find((x) => x.who === m.id)!.pts;
    return me - t.sides.filter((x) => x.who !== m.id).reduce((a, x) => a + x.pts, 0);
  };
  const bestTrade = [...myTrades].sort((a, b) => net(b) - net(a))[0];
  const worstTrade = [...myTrades].sort((a, b) => net(a) - net(b))[0];
  const nickOf = (id: string) => league.managers.find((x) => x.id === id)?.nick ?? id;
  const n0 = (x: number) => Math.round(x).toLocaleString();
  const finishTone = (f: string) => (f === "Champion" ? "text-[var(--gold)]" : f === "Missed playoffs" ? "text-[var(--muted)]" : "");

  return (
    <main className="min-h-screen pb-24">
      <section className="relative overflow-hidden px-5 pt-28 pb-16 md:px-10 md:pt-32" style={{ background: `linear-gradient(180deg, ${m.color}, var(--bin) 92%)` }}>
        <Link href={`${base}/managers`} className="text-sm text-[var(--paper)]/80 hover:text-[var(--paper)]">
          Back to all managers
        </Link>
        <div className="mx-auto mt-10 flex max-w-6xl flex-wrap items-end gap-8">
          <MgrPhoto id={m.id} alt="" width={180} height={180} priority className="rounded-full ring-8 ring-[var(--paper)]/90" />
          <div>
            <h1 className="font-display pb-[0.16em] text-[clamp(4rem,12vw,9rem)] leading-[0.8] font-black">{m.nick}</h1>
            <p className="mt-3 text-lg text-[var(--paper)]/85">
              <Handle id={m.id} />, managing “{m.team}”
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 md:px-10">
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ["All-time record", record(m)],
            ["Win rate", `${(m.pct * 100).toFixed(1)}%`],
            ["Titles", m.titles.length ? m.titles.map((t) => seasonLabel[t]).join(", ") : "None yet"],
            ["Playoff trips", String(m.playoffs)],
            ["Trades made", String(m.trades)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-[var(--bin-2)] p-4">
              <dt className="text-sm text-[var(--muted)]">{k}</dt>
              <dd className="font-display mt-1 text-3xl leading-none font-black">{v}</dd>
            </div>
          ))}
        </dl>

        <h2 className="font-display mt-16 text-5xl font-black">Scouting report</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <section className="rounded-3xl bg-[var(--bin-2)] p-6">
            <h3 className="font-display text-3xl font-black">Lineups</h3>
            {lr ? (
              <>
                <p className="font-display mt-3 text-6xl leading-none font-black tabular-nums">{(lr.eff * 100).toFixed(1)}%</p>
                <p className="mt-2 text-[var(--muted)]">
                  Lineup efficiency, #{lockRank} of {lock.rows.length} on the {terms.index}. Leaves {n0(lr.left)} points on
                  the bench a week. Worst week: {n0(lr.worst.opt - lr.worst.act)} left sitting in {seasonYears[lr.worst.code]} week{" "}
                  {lr.worst.week}.
                </p>
              </>
            ) : (
              <p className="mt-3 text-[var(--muted)]">No lineup history yet.</p>
            )}
          </section>
          <section className="rounded-3xl bg-[var(--bin-2)] p-6">
            <h3 className="font-display text-3xl font-black">Their guys</h3>
            <ul className="mt-4 space-y-3">
              {(guys?.best ?? []).slice(0, 3).map((g) => (
                <li key={g.pid} className="flex items-center gap-3">
                  <Face pid={g.pid} players={players} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-semibold">{pname(players, g.pid)}</span>
                    <span className="text-sm text-[var(--muted)]">
                      {n0(g.pts)} points over {g.weeks} weeks
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-3xl bg-[var(--bin-2)] p-6">
            <h3 className="font-display text-3xl font-black">Draft eye</h3>
            {eye.steal ? (
              <ul className="mt-4 space-y-3">
                {[
                  ["Best pick", eye.steal, "#7fd49a"],
                  ["Worst pick", eye.bust, "#ff8a7a"],
                ].map(([label, p, c]) => {
                  const x = p as NonNullable<typeof eye.steal>;
                  return (
                    <li key={label as string} className="flex items-center gap-3">
                      <Face pid={x.pid} players={players} size={44} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold" style={{ color: c as string }}>
                          {label as string}
                        </span>
                        <span className="block break-words font-semibold">{pname(players, x.pid)}</span>
                        <span className="text-sm text-[var(--muted)]">
                          Taken #{x.no} in {seasonYears[x.code]}, re-drafted #{x.redo}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-[var(--muted)]">No completed drafts yet.</p>
            )}
          </section>
          <section className="rounded-3xl bg-[var(--bin-2)] p-6">
            <h3 className="font-display text-3xl font-black">Trade record</h3>
            {rec ? (
              <>
                <p className="font-display mt-3 text-6xl leading-none font-black tabular-nums">
                  {rec.w}–{rec.l}
                  {rec.e ? <span className="text-[var(--muted)]">–{rec.e}</span> : null}
                </p>
                <p className={`mt-2 font-semibold ${rec.net >= 0 ? "text-[#7fd49a]" : "text-[#ff8a7a]"}`}>
                  {rec.net >= 0 ? "+" : ""}
                  {n0(rec.net)} net value across all trades
                </p>
                {bestTrade ? (
                  <p className="mt-3 text-sm text-[var(--muted)]">
                    Best: {seasonYears[bestTrade.code]} week {bestTrade.week},{" "}
                    {(bestTrade.sides.find((x) => x.who === m.id)?.got ?? []).map((p) => pname(players, p)).join(", ")} ({net(bestTrade) >= 0 ? "+" : ""}
                    {n0(net(bestTrade))}).
                    <br />
                    Worst: {seasonYears[worstTrade.code]} week {worstTrade.week},{" "}
                    {(worstTrade.sides.find((x) => x.who === m.id)?.got ?? []).map((p) => pname(players, p)).join(", ")} ({n0(net(worstTrade))}).
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-3 text-[var(--muted)]">Has never made a trade.</p>
            )}
          </section>
        </div>

        <Explain title="How these numbers work">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Lineups:</strong> the points this manager&apos;s starters scored, divided by the most the roster could have
              scored with the best lineup each week. 100% means a perfect lineup every week (per <Src />).
            </li>
            <li>
              <strong>Their guys:</strong> the players who scored the most for this manager while in the starting lineup.
            </li>
            <li>
              <strong>Draft eye:</strong> &ldquo;re-drafted&rdquo; is where the player would go if that draft were redone by
              the fantasy points everyone actually scored that season. A pick much earlier than that is a bust; much later is a
              steal.
            </li>
            <li>
              <strong>Trade record:</strong> {tradeRule(terms.avg, even, false)} Net is the value received minus the value given away.
            </li>
          </ul>
        </Explain>

        <h2 className="font-display mt-16 text-5xl font-black">Season by season</h2>
        <div className="mt-6 overflow-x-auto rounded-2xl bg-[var(--bin-2)]">
          <table className="w-full text-left">
            <thead className="text-sm text-[var(--muted)]">
              <tr>
                {["Season", "Team", "Seed", "Record", "Points", "Finish"].map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {m.seasons.map((s) => (
                <tr key={s.code} className="border-t border-[var(--line)]">
                  <th scope="row" className="px-4 py-3 font-semibold whitespace-nowrap">
                    {seasonLabel[s.code]}
                  </th>
                  <td className="px-4 py-3 text-[var(--muted)]">{s.team}</td>
                  <td className="font-display px-4 py-3 text-xl font-bold">#{s.seed}</td>
                  <td className="font-display px-4 py-3 text-xl font-bold tabular-nums">{record(s)}</td>
                  <td className="px-4 py-3 tabular-nums">{s.pf.toLocaleString()}</td>
                  <td className={`px-4 py-3 font-semibold ${finishTone(s.finish)}`}>{s.finish}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2">
          {[
            { title: "Owns", list: owns, empty: "Doesn't own anyone yet." },
            { title: "Owned by", list: ownedBy, empty: "Nobody owns this manager." },
          ].map((b) => (
            <section key={b.title} className="rounded-3xl bg-[var(--bin-2)] p-6">
              <h2 className="font-display text-4xl font-black">{b.title}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Head to head, per <Src /></p>
              {b.list.length ? (
                <ul className="mt-5 space-y-3">
                  {b.list.map((r) => (
                    <li key={r.id}>
                      <MgrLink id={r.id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-white/5">
                        <MgrPhoto id={r.id} alt="" width={40} height={40} className="rounded-full" />
                        <span className="flex-1 font-semibold">
                          <Handle id={r.id} />
                        </span>
                        <span className="font-display text-2xl font-black tabular-nums">
                          {r.w}–{r.l}
                        </span>
                      </MgrLink>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-5 text-[var(--muted)]">{b.empty}</p>
              )}
            </section>
          ))}
        </div>

        <h2 className="font-display mt-16 text-5xl font-black">Every trade</h2>
        <p className="mt-2 text-[var(--muted)]">
          {trades.length ? `${trades.length} trades, oldest first, with the trade court's verdict.` : "Has never made a trade."}
        </p>
        <ol className="mt-6 space-y-3">
          {trades.map((t, i) => {
            const got = t.sides[m.id] ?? [];
            const gave = Object.entries(t.sides).filter(([k]) => k !== m.id);
            return (
              <li key={i} className="rounded-2xl bg-[var(--bin-2)] p-4 md:grid md:grid-cols-[10rem_1fr_1fr] md:gap-6">
                <div>
                  <p className="text-sm text-[var(--muted)]">
                    {seasonLabel[t.season]}, week {t.week}
                  </p>
                  {(() => {
                    const g = myTrades.find((x) => x.code === t.season && x.week === t.week && Object.keys(t.sides).every((k) => x.sides.some((y) => y.who === k)));
                    if (!g) return null;
                    const d = net(g);
                    const tone = !g.winner ? "text-[var(--muted)]" : g.winner === m.id ? "text-[#7fd49a]" : "text-[#ff8a7a]";
                    return (
                      <p className={`mt-1 text-sm font-bold ${tone}`}>
                        {!g.winner ? "Even" : g.winner === m.id ? "Won" : "Lost"} {d >= 0 ? "+" : ""}
                        {n0(d)}
                      </p>
                    );
                  })()}
                </div>
                <p className="mt-2 md:mt-0">
                  <span className="text-sm text-[var(--gold)]">Received </span>
                  {got.map((p) => p.name).join(", ") || "nothing"}
                </p>
                <p className="mt-2 md:mt-0">
                  {gave.map(([who, ps]) => (
                    <span key={who} className="block">
                      <span className="text-sm text-[var(--muted)]">{nickOf(who)} got </span>
                      {ps.map((p) => p.name).join(", ")}
                    </span>
                  ))}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </main>
  );
}
