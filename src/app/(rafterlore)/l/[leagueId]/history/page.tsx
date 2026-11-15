import type { Metadata } from "next";
import { Suspense } from "react";
import { LeagueGate, LeagueLoading } from "@/components/app/gate";
import { Archive, Pickups } from "@/components/app/league";
import { Intro, Pending, TradeCrimes } from "@/components/app/site";
import { Almanac } from "@/components/trash/intel";
import { RedraftBoard } from "@/components/trash/redraft";
import { SectionHead } from "@/components/trash/section-head";
import { TimeMachine } from "@/components/trash/time-machine";
import { TradeCourt } from "@/components/trash/trade-court";
import type { LeaguePage } from "@/lib/app/league-page";
import { machine, redrafts, tradeCourt } from "@/lib/core/extras";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage({ params }: PageProps<"/l/[leagueId]/history">) {
  return (
    <Suspense fallback={<LeagueLoading />}>
      {params.then(({ leagueId }) => (
        <LeagueGate leagueId={leagueId} dataset>
          {(p) => <History p={p} />}
        </LeagueGate>
      ))}
    </Suspense>
  );
}

function History({ p }: { p: LeaguePage }) {
  const d = p.dataset;
  const n = p.view.seasons.length;
  if (!d)
    return (
      <main className="overflow-x-clip">
        <Intro title="History" />
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <Archive p={p} />
        </div>
        <Pending p={p} what="The trade court, re-draft, time machine and almanac" />
      </main>
    );
  return (
    <main className="overflow-x-clip">
      <Intro title="History">
        {n} season{n === 1 ? "" : "s"} of rings, heists, re-drafts and arguments. Everything here is pulled from the
        Sleeper record.
      </Intro>

      <section aria-labelledby="seasons" className="py-16 md:py-24">
        <SectionHead id="seasons" title="Season by season" />
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <Archive p={p} />
        </div>
      </section>

      <section aria-labelledby="court" className="py-24 md:py-32">
        <SectionHead id="court" title="Trade court">
          Every trade in league history, judged by what each side actually got out of it. Built from Sleeper&apos;s weekly
          lineups, per Sleeper.
        </SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <TradeCourt {...tradeCourt(d, p.analysis?.even ?? 60)} players={d.extras.players} managers={d.league.managers} />
        </div>
      </section>

      {tradeCourt(d).trades.some((t) => t.winner) ? (
        <section aria-labelledby="crimes" className="py-24 md:py-32">
          <SectionHead id="crimes" title="Trade crimes">The most lopsided deals in league history, with the evidence.</SectionHead>
          <TradeCrimes d={d} />
        </section>
      ) : null}

      <section aria-labelledby="almanac" className="py-24 md:py-32">
        <SectionHead id="almanac" title="The almanac">Every season, sorted by the questions the league actually argues about.</SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <Almanac managers={d.league.managers} seasons={d.league.seasons} partners={d.league.partners ?? []} />
        </div>
      </section>

      <section aria-labelledby="redraft" className="py-24 md:py-32">
        <SectionHead id="redraft" title="The re-draft">Every first-round pick, done again knowing how the season actually went.</SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <RedraftBoard drafts={redrafts(d)} players={d.extras.players} managers={d.league.managers} />
        </div>
      </section>

      <section aria-labelledby="machine" className="py-24 md:py-32">
        <SectionHead id="machine" title="Trade time machine">
          Drag through every season and watch every roster get built, traded apart and rebuilt, week by week.
        </SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <TimeMachine seasons={machine(d)} players={d.extras.players} managers={d.league.managers} />
        </div>
      </section>

      {p.analysis?.pickups.length ? (
        <section aria-labelledby="pickups" className="py-24 md:py-32">
          <SectionHead id="pickups" title="Best pickups">Waiver and free-agent adds, by what they scored as starters for the manager who found them.</SectionHead>
          <div className="mx-auto max-w-6xl px-5 md:px-10">
            <Pickups p={p} />
          </div>
        </section>
      ) : null}
    </main>
  );
}
