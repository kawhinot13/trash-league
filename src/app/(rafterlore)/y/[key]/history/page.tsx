import type { Metadata } from "next";
import { Suspense } from "react";
import { ChampionBanners, Intro, TradeCrimes } from "@/components/app/site";
import { YahooGate, YahooLoading } from "@/components/app/yahoo-gate";
import { Almanac } from "@/components/trash/intel";
import { SectionHead } from "@/components/trash/section-head";
import { TimeMachine } from "@/components/trash/time-machine";
import { machine, tradeCourt } from "@/lib/core/extras";
import type { Dataset } from "@/lib/core/types";

export const metadata: Metadata = { title: "History", robots: { index: false } };

export default function YahooHistory({ params }: PageProps<"/y/[key]/history">) {
  return (
    <Suspense fallback={<YahooLoading />}>
      {params.then(({ key }) => (
        <YahooGate id={decodeURIComponent(key)} path="/history">
          {(d) => <History d={d} />}
        </YahooGate>
      ))}
    </Suspense>
  );
}

function History({ d }: { d: Dataset }) {
  const n = d.league.seasons.length;
  return (
    <main className="overflow-x-clip">
      <Intro title="History">
        {n} season{n === 1 ? "" : "s"} of rings, heists and arguments, from the league&apos;s Yahoo record.
      </Intro>
      <ChampionBanners d={d} />
      {tradeCourt(d).trades.some((t) => t.winner) ? (
        <section aria-labelledby="crimes" className="py-14 md:py-32">
          <SectionHead id="crimes" title="Trade crimes">The most lopsided deals in league history, with the evidence.</SectionHead>
          <TradeCrimes d={d} />
        </section>
      ) : null}
      <section aria-labelledby="almanac" className="py-14 md:py-32">
        <SectionHead id="almanac" title="The almanac">Every season, sorted by the questions the league actually argues about.</SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <Almanac managers={d.league.managers} seasons={d.league.seasons} partners={d.league.partners ?? []} />
        </div>
      </section>
      <section aria-labelledby="machine" className="py-14 md:py-32">
        <SectionHead id="machine" title="Trade time machine">Drag through every season and watch every roster get built, traded apart and rebuilt.</SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <TimeMachine seasons={machine(d)} players={d.extras.players} managers={d.league.managers} />
        </div>
      </section>
    </main>
  );
}
