import type { Metadata } from "next";
import { Suspense } from "react";
import { LeagueGate, LeagueLoading } from "@/components/app/gate";
import { Intro, Pending } from "@/components/app/site";
import { Explain } from "@/components/trash/intel";
import { OwnsGrid } from "@/components/trash/interactive";
import { RivalryMachine } from "@/components/trash/rivalry";
import { SectionHead } from "@/components/trash/section-head";
import type { LeaguePage } from "@/lib/app/league-page";

export const metadata: Metadata = { title: "Rivals" };

export default function RivalsPage({ params }: PageProps<"/l/[leagueId]/rivals">) {
  return (
    <Suspense fallback={<LeagueLoading />}>
      {params.then(({ leagueId }) => (
        <LeagueGate leagueId={leagueId} dataset>
          {(p) => <Rivals p={p} />}
        </LeagueGate>
      ))}
    </Suspense>
  );
}

function Rivals({ p }: { p: LeaguePage }) {
  const d = p.dataset;
  if (!d)
    return (
      <main className="overflow-x-clip">
        <Intro title="Rivals" />
        <Pending p={p} what="Rivalries" />
      </main>
    );
  const current = new Set(d.league.seasons[d.league.seasons.length - 1].standings.map((r) => r.manager));
  // Everyone still in the league, plus anyone who played at least two seasons.
  const names = d.league.managers.filter((m) => current.has(m.id) || m.seasons.length >= 2).map((m) => m.id);
  const colors = Object.fromEntries(d.league.managers.map((m) => [m.id, m.color]));
  // Open on the most-played rivalry among current managers.
  const games = (x: string, y: string) => (d.league.h2h[x]?.[y] ?? 0) + (d.league.h2h[y]?.[x] ?? 0);
  const cur = [...current];
  let initial: [string, string] = [cur[0], cur[1] ?? cur[0]];
  for (const x of cur) for (const y of cur) if (x < y && games(x, y) > games(...initial)) initial = [x, y];
  return (
    <main className="overflow-x-clip">
      <Intro title="Rivals">Some rivalries are rivalries. Some are ownership. Pick any two managers and settle it.</Intro>

      <section aria-labelledby="rivalry" className="py-16 md:py-24">
        <SectionHead id="rivalry" title="Rivalry machine">
          Every meeting, every trade between them and a verdict on who really has the upper hand.
        </SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <RivalryMachine managers={d.league.managers} seasons={d.league.seasons} h2h={d.league.h2h} initial={initial} />
        </div>
      </section>

      <section aria-labelledby="owns" className="py-24 md:py-32">
        <SectionHead id="owns" title="Who owns who">
          Every meeting, per Sleeper&apos;s weekly scores.
        </SectionHead>
        <OwnsGrid names={names} h2h={d.league.h2h} colors={colors} />
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <Explain>
            <p>
              Each square is how many games the row manager won against the column manager, every season combined. Gold
              squares are winning matchups, red are losing ones. &ldquo;Owns&rdquo; means a winning record of at least 5
              games with no more than 1 loss.
            </p>
            <p>
              These come from Sleeper&apos;s week-by-week scores, which don&apos;t always match the official standings,
              so treat them as league lore rather than gospel.
            </p>
          </Explain>
        </div>
      </section>
    </main>
  );
}
