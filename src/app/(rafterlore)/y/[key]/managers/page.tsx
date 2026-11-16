import type { Metadata } from "next";
import { Suspense } from "react";
import { Intro } from "@/components/app/site";
import { YahooGate, YahooLoading } from "@/components/app/yahoo-gate";
import { ManagerCards } from "@/components/trash/interactive";
import { LockInIndex } from "@/components/trash/lockin";
import { MyGuys } from "@/components/trash/my-guys";
import { SectionHead } from "@/components/trash/section-head";
import { lockIn, myGuys } from "@/lib/core/extras";
import type { Dataset } from "@/lib/core/types";

export const metadata: Metadata = { title: "Managers", robots: { index: false } };

export default function YahooManagers({ params }: PageProps<"/y/[key]/managers">) {
  return (
    <Suspense fallback={<YahooLoading />}>
      {params.then(({ key }) => (
        <YahooGate id={decodeURIComponent(key)} path="/managers">
          {(d) => <Managers d={d} />}
        </YahooGate>
      ))}
    </Suspense>
  );
}

function Managers({ d }: { d: Dataset }) {
  return (
    <main className="overflow-x-clip">
      <Intro title="Managers">Everyone who has run a team in this league: their records, their guys and how well they set a lineup.</Intro>
      <section aria-labelledby="managers" className="py-10 md:py-24">
        <SectionHead id="managers" title="The roster">Tap a card for the full profile.</SectionHead>
        <ManagerCards managers={d.league.managers} />
      </section>
      <section aria-labelledby="guys" className="py-10 md:py-24">
        <SectionHead id="guys" title="My guys">The players each manager kept coming back to, and the ones who did the most for them.</SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <MyGuys rows={myGuys(d)} players={d.extras.players} managers={d.league.managers} />
        </div>
      </section>
      <section aria-labelledby="lockin" className="py-10 md:py-24">
        <SectionHead id="lockin" title="The Lineup Index">What each team scored against the best lineup it could have set, every week, from Yahoo&apos;s player scores.</SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <LockInIndex {...lockIn(d)} managers={d.league.managers} />
        </div>
      </section>
    </main>
  );
}
