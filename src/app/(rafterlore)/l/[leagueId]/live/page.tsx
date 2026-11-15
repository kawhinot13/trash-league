import type { Metadata } from "next";
import { Suspense } from "react";
import { LeagueGate, LeagueLoading } from "@/components/app/gate";
import { Section } from "@/components/app/league";
import { LiveGames } from "@/components/app/live";

export const metadata: Metadata = { title: "This week" };

export default function LivePage({ params }: PageProps<"/l/[leagueId]/live">) {
  return (
    <Suspense fallback={<LeagueLoading />}>
      {params.then(({ leagueId }) => (
        <LeagueGate leagueId={leagueId}>
          {(p) => (
            <main>
              <Section
                id="live"
                title="This week"
                lede="Live matchup scores, per Sleeper. They update through the week and don't always match the official totals, which are saved every night."
              >
                <Suspense fallback={<p className="text-[var(--muted)]">Getting this week&apos;s scores…</p>}>
                  <LiveGames p={p} />
                </Suspense>
              </Section>
            </main>
          )}
        </LeagueGate>
      ))}
    </Suspense>
  );
}
