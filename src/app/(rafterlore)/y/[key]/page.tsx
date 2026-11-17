import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PlayGate } from "@/components/app/play-gate";
import { ChampionBanners, Intro } from "@/components/app/site";
import { YahooGate, YahooLoading } from "@/components/app/yahoo-gate";
import { DumpsterDive } from "@/components/trash/dive";
import { Lineup } from "@/components/trash/lineup";
import { SectionHead } from "@/components/trash/section-head";
import { Trashle } from "@/components/trash/trashle";
import { withPool } from "@/lib/core/daily-pool";
import { divePool } from "@/lib/core/dive";
import { lineup } from "@/lib/core/lineup";
import { trashle } from "@/lib/core/trashle";
import type { Dataset } from "@/lib/core/types";

export const metadata: Metadata = { title: "Yahoo league", robots: { index: false } };

export default function YahooHome({ params }: PageProps<"/y/[key]">) {
  return (
    <Suspense fallback={<YahooLoading />}>
      {params.then(({ key }) => (
        <YahooGate id={decodeURIComponent(key)}>{(d) => <Home d={d} id={decodeURIComponent(key)} />}</YahooGate>
      ))}
    </Suspense>
  );
}

function Home({ d, id }: { d: Dataset; id: string }) {
  const cur = d.league.seasons[d.league.seasons.length - 1];
  const nick = (m: string) => d.league.managers.find((x) => x.id === m)?.nick ?? m;
  const people = cur.standings.filter((r) => !/^r\d+$/.test(r.manager)).map((r) => ({ id: r.manager, nick: nick(r.manager) }));
  const players = withPool(d.extras.players, "nfl");
  const doors: [string, string, string][] = [
    ["stats", "Stats", "The Trapezoid of Excellence, the playoff report, the trade court and the re-draft."],
    ["history", "History", "Every champion, trade crimes, the almanac and the trade time machine."],
    ["managers", "Managers", "Profiles, their guys and the Lineup Index."],
    ["rivals", "Rivals", "Head to head for any two managers, and who owns who."],
  ];
  return (
    <main className="overflow-x-clip">
      <Intro title={cur.name}>
        {d.league.seasons.length} season{d.league.seasons.length === 1 ? "" : "s"} of this Yahoo league, for its managers only.
      </Intro>

      <section aria-labelledby="table" className="py-10 md:py-16">
        <SectionHead id="table" title={`${cur.years} table`} />
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <ol className="divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)]">
            {cur.standings.map((r) => (
              <li key={r.manager} className="flex items-center gap-3 px-4 py-3 tabular-nums">
                <span className="font-display w-6 text-xl font-black text-[var(--muted)]">{r.seed}</span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-semibold">{nick(r.manager)}</span>
                  <span className="block break-words text-xs text-[var(--muted)]">{r.team}</span>
                </span>
                <span className="text-right">
                  <span className="block font-semibold">
                    {r.w}–{r.l}
                    {r.t ? `–${r.t}` : ""}
                  </span>
                  <span className="block text-xs text-[var(--muted)]">{r.pf.toLocaleString()} pts</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-[var(--muted)]">Official Yahoo standings through the last finished week.</p>
        </div>
      </section>

      <ChampionBanners d={d} />

      <section id="dive" aria-labelledby="dive-title" className="scroll-mt-24 py-14 md:py-32">
        <SectionHead id="dive-title" title="Today's dive">
          Five prompts a day from the league&apos;s history. Any right answer counts, but the more niche your pick, the more it scores.
        </SectionHead>
        <div className="mx-auto max-w-5xl px-5 md:px-10">
          <PlayGate game="Dumpster Dive" anchor="dive" primary>
            <DumpsterDive pool={divePool(d)} players={players} people={people} />
          </PlayGate>
        </div>
      </section>
      <section id="trashle" aria-labelledby="trashle-title" className="scroll-mt-24 pb-14 md:pb-32">
        <SectionHead id="trashle-title" title="Rosterdle">A new mystery player every day. Guess the last name in six tries.</SectionHead>
        <div className="mx-auto max-w-5xl px-5 md:px-10">
          <PlayGate game="Rosterdle" anchor="trashle">
            <Trashle {...trashle(d)} players={players} people={people} />
          </PlayGate>
        </div>
      </section>
      <section id="lineup" aria-labelledby="lineup-title" className="scroll-mt-24 pb-14 md:pb-32">
        <SectionHead id="lineup-title" title="The Lineup">Somebody from the league&apos;s history is in the lineup. Pick them out in eight tries.</SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <PlayGate game="The Lineup" anchor="lineup">
            <Lineup {...lineup(d)} players={players} people={people} />
          </PlayGate>
        </div>
      </section>

      <section aria-labelledby="explore" className="pb-16 md:pb-36">
        <SectionHead id="explore" title="Around the league" />
        <ul className="mx-auto grid max-w-6xl gap-4 px-5 sm:grid-cols-2 md:px-10">
          {doors.map(([href, title, line]) => (
            <li key={href}>
              <Link href={`/y/${id}/${href}`} className="block h-full rounded-[24px] border border-white/10 bg-[rgba(16,40,30,0.55)] p-6 hover:border-white/25 md:p-8">
                <p className="font-display text-4xl font-black md:text-5xl">{title}</p>
                <p className="mt-2 text-[var(--muted)]">{line}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
