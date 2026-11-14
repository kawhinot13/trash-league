import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { avatar, h2h, league, manager, record, seasonLabel } from "@/lib/league";

export function generateStaticParams() {
  return league.managers.map((m) => ({ id: m.id }));
}

export default function ManagerPage({ params }: PageProps<"/managers/[id]">) {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <Profile params={params} />
    </Suspense>
  );
}

async function Profile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = manager(decodeURIComponent(id));
  if (!m) notFound();
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
  const finishTone = (f: string) => (f === "Champion" ? "text-[var(--gold)]" : f === "Missed playoffs" ? "text-[var(--muted)]" : "");

  return (
    <main className="min-h-screen pb-24">
      <section className="relative overflow-hidden px-5 pt-8 pb-16 md:px-10" style={{ background: `linear-gradient(180deg, ${m.color}, var(--bin) 92%)` }}>
        <Link href="/#managers" className="text-sm text-[var(--paper)]/80 hover:text-[var(--paper)]">
          Back to all managers
        </Link>
        <div className="mx-auto mt-10 flex max-w-6xl flex-wrap items-end gap-8">
          <Image src={avatar(m.id)} alt="" width={180} height={180} priority className="rounded-full ring-8 ring-[var(--paper)]/90" />
          <div>
            <h1 className="font-display text-[clamp(4rem,12vw,9rem)] leading-[0.8] font-black">{m.nick}</h1>
            <p className="mt-3 text-lg text-[var(--paper)]/85">
              {m.id}, managing “{m.team}”
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
              <p className="mt-1 text-sm text-[var(--muted)]">Head to head, per Sleeper</p>
              {b.list.length ? (
                <ul className="mt-5 space-y-3">
                  {b.list.map((r) => (
                    <li key={r.id}>
                      <Link href={`/managers/${r.id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-white/5">
                        <Image src={avatar(r.id)} alt="" width={40} height={40} className="rounded-full" />
                        <span className="flex-1 font-semibold">{r.id}</span>
                        <span className="font-display text-2xl font-black tabular-nums">
                          {r.w}–{r.l}
                        </span>
                      </Link>
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
        <p className="mt-2 text-[var(--muted)]">{trades.length ? `${trades.length} trades, oldest first.` : "Has never made a trade."}</p>
        <ol className="mt-6 space-y-3">
          {trades.map((t, i) => {
            const got = t.sides[m.id] ?? [];
            const gave = Object.entries(t.sides).filter(([k]) => k !== m.id);
            return (
              <li key={i} className="rounded-2xl bg-[var(--bin-2)] p-4 md:grid md:grid-cols-[10rem_1fr_1fr] md:gap-6">
                <p className="text-sm text-[var(--muted)]">
                  {seasonLabel[t.season]}, week {t.week}
                </p>
                <p className="mt-2 md:mt-0">
                  <span className="text-sm text-[var(--gold)]">Received </span>
                  {got.map((p) => p.name).join(", ") || "nothing"}
                </p>
                <p className="mt-2 md:mt-0">
                  {gave.map(([who, ps]) => (
                    <span key={who} className="block">
                      <span className="text-sm text-[var(--muted)]">{who} got </span>
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
