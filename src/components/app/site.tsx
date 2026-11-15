import Link from "next/link";
import { ImportStatus } from "@/components/app/import-status";
import { Handle, MgrPhoto, PlayerPhoto } from "@/components/trash/brand";
import { Spotlight } from "@/components/trash/polish";
import { PageIntro } from "@/components/trash/page-intro";
import { SectionHead } from "@/components/trash/section-head";
import type { LeaguePage } from "@/lib/app/league-page";
import { tradeCourt } from "@/lib/core/extras";
import type { Dataset } from "@/lib/core/types";

/** The top of every inner league page: the Trash site's page intro, minus its holiday decor. */
export function Intro({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <PageIntro title={title} holiday={false}>
      {children}
    </PageIntro>
  );
}

/** "From the rafters": a gold banner for every champion and an open one for the season being played,
 * exactly as on the Trash site. */
export function ChampionBanners({ d }: { d: Dataset }) {
  const done = d.league.seasons.filter((s) => s.champion);
  const current = d.league.seasons[d.league.seasons.length - 1];
  const live = current.status !== "complete";
  const distinct = new Set(done.map((s) => s.champion)).size;
  const n = done.length;
  const intro = !n
    ? "The first banner is still blank."
    : distinct === n
      ? `${n} season${n === 1 ? "" : "s"}, ${n} different champion${n === 1 ? "" : "s"}.${live ? " The next banner is still blank." : ""}`
      : `${n} titles, ${distinct} champion${distinct === 1 ? "" : "s"}.${live ? " The next banner is still blank." : ""}`;
  const cols = Math.min(4, n + (live ? 1 : 0)) || 1;
  return (
    <section aria-labelledby="champions" className="relative py-24 md:py-32">
      <style>{`@keyframes sway{from{transform:rotate(-1.2deg)}to{transform:rotate(1.2deg)}}@media (prefers-reduced-motion:reduce){[style*="sway"]{animation:none!important}}`}</style>
      <SectionHead id="champions" title="From the rafters">
        {intro}
      </SectionHead>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[14rem] mx-auto flex h-[38rem] max-w-6xl justify-around opacity-70">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="block h-full w-40 origin-top"
            style={{
              background: "linear-gradient(180deg, rgba(255,241,194,0.22), rgba(233,196,106,0.06) 55%, transparent)",
              clipPath: "polygon(42% 0, 58% 0, 100% 100%, 0 100%)",
              transform: `rotate(${(i - 1.5) * 5}deg)`,
              filter: "blur(6px)",
            }}
          />
        ))}
      </div>
      <div aria-hidden className="mx-auto h-3 max-w-6xl rounded-full bg-[#08190f]" />
      <div className={`mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 md:px-10 ${["", "md:grid-cols-1", "md:grid-cols-2", "md:grid-cols-3", "md:grid-cols-4"][cols]}`}>
        {done.map((s, i) => {
          const m = d.league.managers.find((x) => x.id === s.champion);
          const st = s.standings.find((r) => r.manager === s.champion);
          return (
            <Banner key={s.code} gold sway={(i * 0.7) % 3}>
              <span className="font-display text-xl font-bold text-[var(--gold)]">{s.years}</span>
              <MgrPhoto
                id={s.champion!}
                alt=""
                width={96}
                height={96}
                className="mt-5 shrink-0 rounded-full object-cover"
                style={{ width: 96, height: 96, boxShadow: "0 0 0 3px var(--gold)" }}
              />
              <span className="font-display mt-5 block text-[clamp(1.8rem,3.4vw,2.8rem)] leading-[0.9] font-black [overflow-wrap:anywhere]">
                <span className="shimmer-gold">{m?.nick ?? "Champion"}</span>
              </span>
              {st ? (
                <>
                  <span className="mt-2 block text-sm text-[var(--muted)]">
                    <Handle id={s.champion!} />, “{st.team}”
                  </span>
                  <span className="mt-4 block text-sm">
                    #{st.seed} seed, {st.w}–{st.l}
                    {st.t ? `–${st.t}` : ""}
                  </span>
                </>
              ) : null}
            </Banner>
          );
        })}
        {live ? (
          <Banner sway={2.1}>
            <span className="font-display text-xl font-bold text-[var(--muted)]">{current.years}</span>
            <span className="font-display mt-6 block text-8xl font-black text-[var(--muted)]">?</span>
            <span className="mt-4 block text-sm text-[var(--muted)]">Being decided now</span>
          </Banner>
        ) : null}
      </div>
    </section>
  );
}

const Banner = ({ children, gold, sway }: { children: React.ReactNode; gold?: boolean; sway: number }) => (
  <div className="group flex flex-col items-center" style={{ animation: `sway ${5 + sway}s ease-in-out ${sway}s infinite alternate` }}>
    <div className="h-16 w-px bg-white/30" />
    <div
      className="relative flex w-full flex-col items-center px-5 pt-8 pb-16 text-center transition-transform duration-500 group-hover:-translate-y-1"
      style={{
        background: gold ? "linear-gradient(180deg, #1f4a39, #163a2c)" : "transparent",
        border: gold ? "none" : "2px dashed var(--line)",
        clipPath: "polygon(0 0, 100% 0, 100% 88%, 50% 100%, 0 88%)",
        boxShadow: gold ? "inset 0 0 0 3px var(--gold)" : undefined,
      }}
    >
      {children}
    </div>
  </div>
);

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
