import type { Metadata } from "next";
import { Suspense } from "react";
import { Intro } from "@/components/app/site";
import { YahooGate, YahooLoading } from "@/components/app/yahoo-gate";
import { PlayoffReport } from "@/components/trash/playoff-report";
import { RedraftBoard } from "@/components/trash/redraft";
import { SectionHead } from "@/components/trash/section-head";
import { TradeCourt } from "@/components/trash/trade-court";
import { Trapezoid } from "@/components/trash/trapezoid";
import { redrafts, tradeCourt } from "@/lib/core/extras";
import { backtest, playoffReport, trapezoidViews } from "@/lib/core/trapezoid";
import type { Dataset } from "@/lib/core/types";

export const metadata: Metadata = { title: "Stats", robots: { index: false } };

export default function YahooStats({ params }: PageProps<"/y/[key]/stats">) {
  return (
    <Suspense fallback={<YahooLoading />}>
      {params.then(({ key }) => (
        <YahooGate id={decodeURIComponent(key)} path="/stats">
          {(d) => <Stats d={d} />}
        </YahooGate>
      ))}
    </Suspense>
  );
}

function Stats({ d }: { d: Dataset }) {
  const years = Object.fromEntries(d.league.seasons.map((s) => [s.code, s.years]));
  return (
    <main className="overflow-x-clip">
      <Intro title="Stats">Who scores and wins like a champion, who shows up in the playoffs, who wins trades and who drafts well.</Intro>
      <section aria-labelledby="trapezoid" className="py-14 md:py-32">
        <SectionHead id="trapezoid" title="Trapezoid of Excellence">
          Every manager plotted by regular-season win rate and scoring, against the window this league&apos;s own champions set.
        </SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <Trapezoid views={trapezoidViews(d)} bt={backtest(d)} people={d.league.managers} />
        </div>
      </section>
      <section aria-labelledby="playoff-report" className="py-14 md:py-32">
        <SectionHead id="playoff-report" title="Playoff report">Who gets in, who wins when it counts and who scores up or down in the playoffs.</SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <PlayoffReport rows={playoffReport(d)} people={d.league.managers} years={years} />
        </div>
      </section>
      <section aria-labelledby="court" className="py-14 md:py-32">
        <SectionHead id="court" title="Trade court">Every trade in league history, judged by what each side actually got out of it.</SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <TradeCourt {...tradeCourt(d)} players={d.extras.players} managers={d.league.managers} />
        </div>
      </section>
      <section aria-labelledby="redraft" className="py-14 md:py-32">
        <SectionHead id="redraft" title="The re-draft">Every first-round pick, done again knowing how the season actually went.</SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <RedraftBoard drafts={redrafts(d)} players={d.extras.players} managers={d.league.managers} />
        </div>
      </section>
    </main>
  );
}
