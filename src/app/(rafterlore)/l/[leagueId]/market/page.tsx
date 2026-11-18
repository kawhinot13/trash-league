import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LeagueGate, LeagueLoading } from "@/components/app/gate";
import { Intro } from "@/components/app/site";
import type { LeaguePage } from "@/lib/app/league-page";
import { MarketBoard } from "@/packs/trash/market/board";

export const metadata: Metadata = { title: "The Trash Exchange" };

/** The Trash Exchange: Trash's own play-money stock market. Every other league gets a 404. */
export default function MarketPage({ params }: PageProps<"/l/[leagueId]/market">) {
  return (
    <Suspense fallback={<LeagueLoading />}>
      {params.then(({ leagueId }) => (
        <LeagueGate leagueId={leagueId}>{(p) => <Page p={p} leagueId={leagueId} />}</LeagueGate>
      ))}
    </Suspense>
  );
}

function Page({ p, leagueId }: { p: LeaguePage; leagueId: string }) {
  if (p.pack?.id !== "trash") notFound();
  return (
    <main className="overflow-x-clip">
      <Intro title="The Trash Exchange">
        Buy and sell shares in every team in Trash with Bushy Bucks, collect Perren Coin when your teams win, and spend it on Xan Purple Hoodies.
      </Intro>
      <div className="pt-10 pb-14 md:pb-32">
        <MarketBoard leagueId={leagueId} />
      </div>
    </main>
  );
}
