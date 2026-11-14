import Image from "next/image";
import Link from "next/link";
import { RevealTitle, Spotlight } from "./polish";
import {
  avatar,
  headshot,
  league,
  manager,
  record,
  type Standing,
  type Trade,
} from "@/lib/league";

const Avatar = ({
  id,
  size = 40,
  ring,
}: {
  id: string;
  size?: number;
  ring?: string;
}) => (
  <Image
    src={avatar(id)}
    alt=""
    width={size}
    height={size}
    className="shrink-0 rounded-full object-cover"
    style={{
      width: size,
      height: size,
      boxShadow: ring ? `0 0 0 3px ${ring}` : undefined,
    }}
  />
);

export function SectionHead({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto mb-10 max-w-6xl px-5 md:mb-14 md:px-10">
      <RevealTitle id={id}>{title}</RevealTitle>
      {children ? (
        <div className="mt-5 max-w-[60ch] text-lg leading-relaxed text-[var(--muted)]">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/* ── Live standings, set on the court ───────────────── */
export function Standings({
  rows,
  live,
  week,
}: {
  rows: Standing[];
  live: boolean;
  week: number | null;
}) {
  const games = Math.max(1, ...rows.map((r) => r.w + r.l + r.t));
  const pfLeader = [...rows].sort((a, b) => b.pf - a.pf)[0];
  return (
    <section
      aria-labelledby="standings"
      className="relative overflow-hidden py-24 text-[#1d140b] md:py-32"
      style={{
        background:
          "repeating-linear-gradient(90deg, var(--wood) 0 84px, var(--wood-2) 84px 86px)",
      }}
    >
      <svg
        aria-hidden
        className="absolute inset-0 h-full w-full opacity-40"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <circle
          cx="50"
          cy="50"
          r="18"
          fill="none"
          stroke="#fff"
          strokeWidth="0.35"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1="50"
          y1="0"
          x2="50"
          y2="100"
          stroke="#fff"
          strokeWidth="0.35"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="relative mx-auto max-w-6xl px-5 md:px-10">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <RevealTitle id="standings">Season 4 table</RevealTitle>
          <p className="text-sm font-medium">
            {live
              ? `Live from Sleeper${week ? `, week ${week}` : ""}. Refreshes every few minutes.`
              : "Snapshot. Sleeper is unreachable right now."}
          </p>
        </div>
        <ol className="overflow-hidden rounded-2xl bg-[#1d140b] text-[var(--paper)] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]">
          {rows.map((r) => {
            const m = manager(r.manager);
            return (
              <li
                key={r.manager}
                className="border-b border-[var(--line)] last:border-0"
              >
                <Link
                  href={`/managers/${r.manager}`}
                  className="grid grid-cols-[2.2rem_auto_1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5 md:grid-cols-[3rem_auto_1fr_8rem_6rem] md:gap-5 md:px-6"
                >
                  <span className="font-display text-2xl font-bold text-[var(--muted)] tabular-nums">
                    {r.seed}
                  </span>
                  <Avatar id={r.manager} size={40} ring={m?.color} />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {r.manager}
                    </span>
                    <span className="block truncate text-xs text-[var(--muted)]">
                      {r.team}
                    </span>
                  </span>
                  <span className="hidden md:block">
                    <span className="block h-1.5 rounded-full bg-white/10">
                      <span
                        className="block h-1.5 rounded-full bg-[var(--wood)]"
                        style={{ width: `${((r.w + r.t / 2) / games) * 100}%` }}
                      />
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="font-display block text-2xl font-bold tabular-nums">
                      {record(r)}
                    </span>
                    <span
                      className={`block text-xs tabular-nums ${r.manager === pfLeader.manager ? "text-[var(--gold)]" : "text-[var(--muted)]"}`}
                    >
                      {r.pf.toLocaleString()} pts
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/* ── Champions as arena banners ─────────────────────── */
const Banner = ({
  children,
  gold,
  sway,
}: {
  children: React.ReactNode;
  gold?: boolean;
  sway: number;
}) => (
  <div
    className="group flex flex-col items-center"
    style={{
      animation: `sway ${5 + sway}s ease-in-out ${sway}s infinite alternate`,
    }}
  >
    <div className="h-16 w-px bg-white/30" />
    <div
      className="relative flex w-full flex-col items-center px-5 pt-8 pb-16 text-center transition-transform duration-500 group-hover:-translate-y-1"
      style={{
        background: gold
          ? "linear-gradient(180deg, #1f4a39, #163a2c)"
          : "transparent",
        border: gold ? "none" : "2px dashed var(--line)",
        clipPath: "polygon(0 0, 100% 0, 100% 88%, 50% 100%, 0 88%)",
        boxShadow: gold ? "inset 0 0 0 3px var(--gold)" : undefined,
      }}
    >
      {children}
    </div>
  </div>
);

export function Banners() {
  const done = league.seasons.filter((s) => s.champion);
  return (
    <section aria-labelledby="champions" className="relative py-24 md:py-32">
      <style>{`@keyframes sway{from{transform:rotate(-1.2deg)}to{transform:rotate(1.2deg)}}@media (prefers-reduced-motion:reduce){[style*="sway"]{animation:none!important}}`}</style>
      <SectionHead id="champions" title="From the rafters">
        Three seasons, three different champions. The fourth banner is still
        blank.
      </SectionHead>
      <div
        aria-hidden
        className="mx-auto h-3 max-w-6xl rounded-full bg-[#08190f]"
      />
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 md:grid-cols-4 md:px-10">
        {done.map((s, i) => {
          const m = manager(s.champion!)!;
          const st = s.standings.find((r) => r.manager === s.champion)!;
          return (
            <Banner key={s.code} gold sway={i * 0.7}>
              <span className="font-display text-xl font-bold text-[var(--gold)]">
                {s.years}
              </span>
              <Avatar id={m.id} size={96} ring="var(--gold)" />
              <span className="font-display mt-5 block text-[clamp(1.8rem,3.4vw,2.8rem)] leading-[0.9] font-black">
                <span className="shimmer-gold">{m.nick}</span>
              </span>
              <span className="mt-2 block text-sm text-[var(--muted)]">
                {m.id}, “{st.team}”
              </span>
              <span className="mt-4 block text-sm">
                #{st.seed} seed, {record(st)}
              </span>
            </Banner>
          );
        })}
        <Banner sway={2.1}>
          <span className="font-display text-xl font-bold text-[var(--muted)]">
            2026–27
          </span>
          <span className="font-display mt-6 block text-8xl font-black text-[var(--muted)]">
            ?
          </span>
          <span className="mt-4 block text-sm text-[var(--muted)]">
            Being decided now
          </span>
        </Banner>
      </div>
    </section>
  );
}

/* ── Trade crimes: the evidence locker ──────────────── */
const findTrade = (season: string, week: number, a: string, b: string) =>
  league.seasons
    .find((s) => s.code === season)!
    .trades.find((t) => t.week === week && t.sides[a] && t.sides[b])!;
const EXHIBITS: {
  letter: string;
  title: string;
  when: string;
  story: string;
  verdict: string;
  trade: Trade;
}[] = [
  {
    letter: "A",
    title: "The Jokić heist",
    when: "Season 1, week 6",
    story:
      "Week 3, jgood432 sent Jokić to MilesBridgessgf for four players. Three weeks later, Jokić came home, with Clint Capela, for five role players.",
    verdict: "Scam",
    trade: findTrade("s1", 6, "jgood432", "MilesBridgessgf"),
  },
  {
    letter: "B",
    title: "Bug's lot",
    when: "Season 1, week 6",
    story:
      "Oscar31 walked onto LeBugger's lot with James Harden and Kristaps Porziņģis. Legend says Oscar never traded again.",
    verdict: "Fleeced",
    trade: findTrade("s1", 6, "LeBugger", "Oscar31"),
  },
  {
    letter: "C",
    title: "The alley",
    when: "Season 1, week 8",
    story:
      "junkyarddoggg and charlesjames05 met in the dark. A rookie named Victor Wembanyama changed hands. Nothing was ever proven.",
    verdict: "Collusion?",
    trade: findTrade("s1", 8, "charlesjames05", "junkyarddoggg"),
  },
  {
    letter: "D",
    title: "The Luka flip",
    when: "Season 2, week 4",
    story:
      "Two weeks after getting Luka from KawhiNot13, jgood432 flipped him to junkyarddoggg with Amen Thompson. junkyarddoggg beat jgood432 in the final.",
    verdict: "Regret",
    trade: findTrade("s2", 4, "junkyarddoggg", "jgood432"),
  },
  {
    letter: "E",
    title: "Rico's Wembanyama",
    when: "Season 2, week 8",
    story:
      "RI3O traded for Victor Wembanyama in week 8, then traded him away in week 9 for Kevin Durant and Darius Garland.",
    verdict: "One week",
    trade: findTrade("s2", 8, "RI3O", "junkyarddoggg"),
  },
];

export function Crimes() {
  return (
    <section aria-labelledby="crimes" className="py-24 md:py-32">
      <SectionHead id="crimes" title="Trade crimes">
        Five trades the league still argues about. Every piece below is pulled
        from the Sleeper transaction log.
      </SectionHead>
      <div className="mx-auto grid max-w-6xl gap-6 px-5 md:px-10">
        {EXHIBITS.map((x) => (
          <Spotlight key={x.letter} className="rounded-3xl">
            <article className="relative overflow-hidden rounded-3xl border border-white/10 bg-[rgba(22,58,44,0.55)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md md:p-10">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-[var(--muted)]">
                    Exhibit {x.letter}, {x.when}
                  </p>
                  <h3 className="font-display mt-1 text-5xl leading-none font-black md:text-6xl">
                    {x.title}
                  </h3>
                </div>
                <span
                  className="font-display rotate-[-6deg] rounded-lg border-4 border-[var(--ticket)] px-4 py-1 text-3xl font-black text-[var(--ticket)] md:text-4xl"
                  aria-label={`Verdict: ${x.verdict}`}
                >
                  {x.verdict}
                </span>
              </div>
              <p className="mt-4 max-w-[62ch] leading-relaxed text-[var(--muted)]">
                {x.story}
              </p>
              <div className="mt-8 grid gap-6 md:grid-cols-2">
                {Object.entries(x.trade.sides).map(([who, got]) => (
                  <div
                    key={who}
                    className="rounded-2xl border border-[var(--line)] p-4"
                  >
                    <p className="flex items-center gap-3 text-sm">
                      <Avatar id={who} size={32} ring={manager(who)?.color} />
                      <span>
                        <strong className="font-semibold">{who}</strong>{" "}
                        received
                      </span>
                    </p>
                    <ul className="mt-4 flex flex-wrap gap-3">
                      {got.map((p) => (
                        <li key={p.name} className="w-[104px] text-center">
                          <div className="relative h-[70px] overflow-hidden rounded-xl bg-[var(--bin-3)]">
                            {p.pid ? (
                              <Image
                                src={headshot(p.pid)}
                                alt=""
                                fill
                                sizes="104px"
                                className="object-contain object-bottom"
                              />
                            ) : null}
                          </div>
                          <span className="mt-1 block text-xs leading-tight">
                            {p.name}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </article>
          </Spotlight>
        ))}
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-[var(--line)] px-5 py-12 text-sm text-[var(--muted)] md:px-10">
      <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-6">
        <p className="font-display text-4xl font-black text-[var(--paper)]">
          Trash
        </p>
        <div className="flex flex-col gap-4">
          <p className="max-w-[56ch]">
            Records, champions, drafts and trades come from Sleeper.
            Head-to-head records come from Sleeper&apos;s weekly scores, which
            don&apos;t always match the official standings, so treat them as
            league lore.
          </p>
          <p className="flex flex-wrap items-center gap-x-5 gap-y-3 text-xs">
            <span>Data from Sleeper. Built with</span>
            <a
              href="https://nextjs.org"
              className="opacity-70 transition-opacity hover:opacity-100"
              aria-label="Next.js"
            >
              <Image
                src="/logos/nextjs_logo_dark.svg"
                alt=""
                width={64}
                height={13}
                className="h-3.5 w-auto"
              />
            </a>
            <span>hosted on</span>
            <a
              href="https://vercel.com"
              className="opacity-70 transition-opacity hover:opacity-100"
              aria-label="Vercel"
            >
              <Image
                src="/logos/vercel_wordmark_dark.svg"
                alt=""
                width={64}
                height={14}
                className="h-3.5 w-auto"
              />
            </a>
            <span>code on</span>
            <a
              href="https://github.com/kawhinot13/trash-league"
              className="opacity-70 transition-opacity hover:opacity-100"
              aria-label="GitHub"
            >
              <Image
                src="/logos/github_wordmark_dark.svg"
                alt=""
                width={64}
                height={18}
                className="h-4 w-auto"
              />
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
