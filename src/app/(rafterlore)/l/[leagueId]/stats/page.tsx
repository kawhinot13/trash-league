import type { Metadata } from "next";
import { Suspense } from "react";
import { LeagueGate, LeagueLoading } from "@/components/app/gate";
import { Pickups } from "@/components/app/league";
import { Intro, Pending } from "@/components/app/site";
import { GmRatings } from "@/components/trash/gm-rating";
import { PlayoffReport } from "@/components/trash/playoff-report";
import { RedraftBoard } from "@/components/trash/redraft";
import { SectionHead } from "@/components/trash/section-head";
import { TradeCourt } from "@/components/trash/trade-court";
import { Trapezoid } from "@/components/trash/trapezoid";
import type { LeaguePage } from "@/lib/app/league-page";
import { redrafts, tradeCourt, tradeScaleOf } from "@/lib/core/extras";
import { gmRatings } from "@/lib/core/gm-rating";
import { backtest, playoffReport, trapezoidViews } from "@/lib/core/trapezoid";

export const metadata: Metadata = { title: "Stats" };

export default function StatsPage({ params }: PageProps<"/l/[leagueId]/stats">) {
  return (
    <Suspense fallback={<LeagueLoading />}>
      {params.then(({ leagueId }) => (
        <LeagueGate leagueId={leagueId} dataset>
          {(p) => <Stats p={p} />}
        </LeagueGate>
      ))}
    </Suspense>
  );
}

function Stats({ p }: { p: LeaguePage }) {
  const d = p.dataset;
  if (!d)
    return (
      <main className="overflow-x-clip">
        <Intro title="Stats" />
        <Pending p={p} what="The Trapezoid of Excellence, playoff report, trade court and re-draft" />
      </main>
    );
  return (
    <main className="overflow-x-clip">
      <Intro title="Stats">
        Who the best GM is, who scores and wins like a champion, who shows up in the playoffs, who wins trades and who drafts
        well. Built from the Sleeper record.
      </Intro>

      <section aria-labelledby="trapezoid" className="py-14 md:py-32">
        <SectionHead id="trapezoid" title="Trapezoid of Excellence">
          Who scores and wins like a champion? Every manager plotted by regular-season win rate and scoring, against the window
          this league&apos;s own champions set.
        </SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <Trapezoid views={trapezoidViews(d)} bt={backtest(d)} people={d.league.managers} />
        </div>
      </section>

      <section aria-labelledby="gm" className="py-14 md:py-32">
        <SectionHead id="gm" title="GM rating">
          Who&apos;s the best manager in the league? One all-time grade from drafting, the waiver wire, trades, lineups and
          results.
        </SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <GmRatings rows={gmRatings(d)} people={d.league.managers} />
        </div>
      </section>

      <section aria-labelledby="playoff-report" className="py-14 md:py-32">
        <SectionHead id="playoff-report" title="Playoff report">
          The postseason, kept separate: who gets in, who wins when it counts and who scores up or down in the playoffs.
        </SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <PlayoffReport rows={playoffReport(d)} people={d.league.managers} years={Object.fromEntries(d.league.seasons.map((s) => [s.code, s.years]))} />
        </div>
      </section>

      <section aria-labelledby="court" className="py-14 md:py-32">
        <SectionHead id="court" title="Trade court">
          Every trade in league history, judged by what each side actually got out of it. Built from Sleeper&apos;s weekly
          lineups, per Sleeper.
        </SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <TradeCourt {...tradeCourt(d, p.analysis?.even ?? 60)} even={p.analysis?.even ?? 60} scale={tradeScaleOf(d)} players={d.extras.players} managers={d.league.managers} />
        </div>
      </section>

      <section aria-labelledby="redraft" className="py-14 md:py-32">
        <SectionHead id="redraft" title="The re-draft">Every first-round pick, done again knowing how the season actually went.</SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <RedraftBoard drafts={redrafts(d)} players={d.extras.players} managers={d.league.managers} />
        </div>
      </section>

      {p.analysis?.pickups.length ? (
        <section aria-labelledby="pickups" className="py-14 md:py-32">
          <SectionHead id="pickups" title="Best pickups">Waiver and free-agent adds, by what they scored as starters for the manager who found them.</SectionHead>
          <div className="mx-auto max-w-6xl px-5 md:px-10">
            <Pickups p={p} />
          </div>
        </section>
      ) : null}
    </main>
  );
}
