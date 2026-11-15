import Link from "next/link";
import { ImportStatus } from "@/components/app/import-status";
import { Handle, MgrPhoto, PlayerPhoto } from "@/components/trash/brand";
import { Spotlight } from "@/components/trash/polish";
import type { LeaguePage } from "@/lib/app/league-page";
import { tradeCourt } from "@/lib/core/extras";
import type { Dataset } from "@/lib/core/types";

/** The calm top of every inner league page (the Trash site's page intro, minus its holiday decor). */
export function Intro({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="mx-auto max-w-6xl px-5 pt-14 pb-6 md:px-10 md:pt-20">
      <h1 className="font-display text-[clamp(3.6rem,11vw,8rem)] leading-[0.82] font-black">{title}</h1>
      {children ? <p className="mt-5 max-w-[56ch] text-lg leading-relaxed text-[var(--muted)]">{children}</p> : null}
    </header>
  );
}

/** Shown while a league's first import is still building its history. */
export function Pending({ p, what }: { p: LeaguePage; what: string }) {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10 md:px-10">
      <p className="max-w-[60ch] text-[var(--muted)]">
        {what} appear{what.endsWith("s") ? "" : "s"} once this league&apos;s history is imported. That takes a minute or
        two, once.
      </p>
      {p.db ? (
        <div className="mt-6">
          <ImportStatus leagueId={p.leagueId} initial={p.progress} hasResults={!!p.dataset} />
        </div>
      ) : null}
    </div>
  );
}

/** Links into the rest of the league site, each with one real number. */
export function Doors({ leagueId, items }: { leagueId: string; items: { href: string; title: string; line: string; stat: string; tone: string }[] }) {
  return (
    <ul className="mx-auto grid max-w-6xl gap-4 px-5 sm:grid-cols-2 md:px-10">
      {items.map((d) => (
        <li key={d.href}>
          <Link
            href={`/l/${leagueId}${d.href}`}
            className="group flex h-full flex-col justify-between rounded-[24px] border border-white/10 bg-[rgba(16,40,30,0.55)] p-6 transition-[border-color,background-color] duration-200 hover:border-white/25 hover:bg-[rgba(16,40,30,0.8)] md:p-8"
          >
            <div>
              <p className="font-display text-5xl font-black md:text-6xl">{d.title}</p>
              <p className="mt-3 max-w-[40ch] text-[var(--paper)]/80">{d.line}</p>
            </div>
            <p className="mt-8 text-sm font-semibold" style={{ color: d.tone }}>
              {d.stat}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Trade crimes, written by the data: the league's most lopsided trades, each with the evidence.
 * (The Trash site's version is hand-written lore; this one works for any league.)
 */
export function TradeCrimes({ d }: { d: Dataset }) {
  const court = tradeCourt(d);
  const worst = court.trades.filter((t) => t.winner).sort((a, b) => b.margin - a.margin).slice(0, 4);
  if (!worst.length) return null;
  const even = Math.max(1, ...court.trades.map((t) => (t.winner ? 0 : t.margin)));
  const name = (pid: string) =>
    pid.startsWith("pick:") ? `${pid.slice(5).replace(" R", " round ")} pick` : (d.extras.players[pid]?.[0] ?? "Unknown player");
  const verdict = (m: number) => (m > even * 6 ? "Robbery" : m > even * 3 ? "Fleeced" : "Lopsided");
  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-5 md:px-10">
      {worst.map((t, i) => {
        const loser = t.sides.find((s) => s.who !== t.winner);
        return (
          <Spotlight key={t.id} className="rounded-3xl">
            <article className="relative overflow-hidden rounded-3xl border border-white/10 bg-[rgba(22,58,44,0.55)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] md:p-10">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-[var(--muted)]">
                    Exhibit {String.fromCharCode(65 + i)}, {t.years} week {t.week}
                  </p>
                  <h3 className="font-display mt-1 text-4xl leading-none font-black md:text-6xl">
                    <Handle id={t.winner!} /> won by {Math.round(t.margin).toLocaleString()}
                  </h3>
                </div>
                <span
                  className="font-display rotate-[-6deg] rounded-lg border-4 border-[var(--ticket)] px-4 py-1 text-3xl font-black text-[var(--ticket)] md:text-4xl"
                  aria-label={`Verdict: ${verdict(t.margin)}`}
                >
                  {verdict(t.margin)}
                </span>
              </div>
              <p className="mt-4 max-w-[62ch] leading-relaxed text-[var(--muted)]">
                What each side&apos;s new players scored in their new team&apos;s starting lineup for the rest of that
                season{loser ? <>, and <Handle id={loser.who} /> has been living with it since</> : null}.
              </p>
              <div className="mt-8 grid gap-6 md:grid-cols-2">
                {t.sides.map((s) => (
                  <div key={s.who} className="rounded-2xl border border-[var(--line)] p-4">
                    <p className="flex items-center gap-3 text-sm">
                      <MgrPhoto id={s.who} alt="" width={32} height={32} className="size-8 rounded-full object-cover" />
                      <span>
                        <strong className="font-semibold">
                          <Handle id={s.who} />
                        </strong>{" "}
                        received, then scored {Math.round(s.pts).toLocaleString()}
                      </span>
                    </p>
                    <ul className="mt-4 flex flex-wrap gap-3">
                      {s.got.map((p) => (
                        <li key={p} className="w-[104px] text-center">
                          <div className="relative h-[70px] overflow-hidden rounded-xl bg-[var(--bin-3)]">
                            {p.startsWith("pick:") ? null : (
                              <PlayerPhoto pid={p} fill sizes="104px" className="object-contain object-bottom" />
                            )}
                          </div>
                          <span className="mt-1 block text-xs leading-tight">{name(p)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </article>
          </Spotlight>
        );
      })}
    </div>
  );
}
