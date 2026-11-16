import type { Metadata } from "next";
import { Suspense } from "react";
import { Intro } from "@/components/app/site";
import { YahooGate, YahooLoading } from "@/components/app/yahoo-gate";
import { OwnsGrid } from "@/components/trash/interactive";
import { RivalryMachine } from "@/components/trash/rivalry";
import { SectionHead } from "@/components/trash/section-head";
import type { Dataset } from "@/lib/core/types";

export const metadata: Metadata = { title: "Rivals", robots: { index: false } };

export default function YahooRivals({ params }: PageProps<"/y/[key]/rivals">) {
  return (
    <Suspense fallback={<YahooLoading />}>
      {params.then(({ key }) => (
        <YahooGate id={decodeURIComponent(key)} path="/rivals">
          {(d) => <Rivals d={d} />}
        </YahooGate>
      ))}
    </Suspense>
  );
}

function Rivals({ d }: { d: Dataset }) {
  const current = new Set(d.league.seasons[d.league.seasons.length - 1].standings.map((r) => r.manager));
  const names = d.league.managers.filter((m) => current.has(m.id) || m.seasons.length >= 2).map((m) => m.id);
  const colors = Object.fromEntries(d.league.managers.map((m) => [m.id, m.color]));
  const games = (x: string, y: string) => (d.league.h2h[x]?.[y] ?? 0) + (d.league.h2h[y]?.[x] ?? 0);
  const cur = [...current];
  let initial: [string, string] = [cur[0], cur[1] ?? cur[0]];
  for (const x of cur) for (const y of cur) if (x < y && games(x, y) > games(...initial)) initial = [x, y];
  return (
    <main className="overflow-x-clip">
      <Intro title="Rivals">Some rivalries are rivalries. Some are ownership. Pick any two managers and settle it.</Intro>
      <section aria-labelledby="rivalry" className="py-10 md:py-24">
        <SectionHead id="rivalry" title="Rivalry machine">Every meeting, every trade between them and a verdict on who has the upper hand.</SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          {cur.length >= 2 ? <RivalryMachine managers={d.league.managers} seasons={d.league.seasons} h2h={d.league.h2h} initial={initial} /> : null}
        </div>
      </section>
      <section aria-labelledby="owns" className="py-14 md:py-32">
        <SectionHead id="owns" title="Who owns who">Every meeting, from Yahoo&apos;s weekly scores.</SectionHead>
        <OwnsGrid names={names} h2h={d.league.h2h} colors={colors} />
      </section>
    </main>
  );
}
