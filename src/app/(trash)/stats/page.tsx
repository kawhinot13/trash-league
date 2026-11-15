import type { Metadata } from "next";
import { PageIntro } from "@/components/trash/page-intro";
import { PlayoffReport } from "@/components/trash/playoff-report";
import { RedraftBoard } from "@/components/trash/redraft";
import { SectionHead } from "@/components/trash/sections";
import { TradeCourt } from "@/components/trash/trade-court";
import { Trapezoid } from "@/components/trash/trapezoid";
import { backtest, playoffReport, trapezoidViews } from "@/lib/core/trapezoid";
import { TRASH, players, redrafts, tradeCourt } from "@/lib/extras";
import { league } from "@/lib/league";

export const metadata: Metadata = { title: "Stats — Trash" };

export default function StatsPage() {
  return (
    <main className="overflow-x-clip">
      <PageIntro title="Stats">
        Who scores and wins like a champion, who shows up in the playoffs, who wins trades and who drafts well. Built from
        the Sleeper record.
      </PageIntro>

      <section aria-labelledby="trapezoid" className="py-14 md:py-32">
        <SectionHead id="trapezoid" title="Trapezoid of Excellence">
          Who scores and wins like a champion? Every manager plotted by regular-season win rate and scoring, against the window
          this league&apos;s own champions set.
        </SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <Trapezoid views={trapezoidViews(TRASH)} bt={backtest(TRASH)} people={league.managers} />
        </div>
      </section>

      <section aria-labelledby="playoff-report" className="py-14 md:py-32">
        <SectionHead id="playoff-report" title="Playoff report">
          The postseason, kept separate: who gets in, who wins when it counts and who scores up or down in the playoffs.
        </SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <PlayoffReport rows={playoffReport(TRASH)} people={league.managers} years={Object.fromEntries(TRASH.league.seasons.map((s) => [s.code, s.years]))} />
        </div>
      </section>

      <section aria-labelledby="court" className="py-14 md:py-32">
        <SectionHead id="court" title="Trade court">
          Every trade in league history, judged by what each side actually got out of it. Who won, who got fleeced,
          and who&apos;s the best dealer in Trash. Estimates: built from Sleeper&apos;s weekly lineup data, which
          doesn&apos;t always match the scores in the app.
        </SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <TradeCourt {...tradeCourt()} players={players} managers={league.managers} />
        </div>
      </section>

      <section aria-labelledby="redraft" className="py-14 md:py-32">
        <SectionHead id="redraft" title="The re-draft">
          Every first-round pick, done again knowing how the season actually went.
        </SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <RedraftBoard drafts={redrafts()} players={players} managers={league.managers} />
        </div>
      </section>

    </main>
  );
}
