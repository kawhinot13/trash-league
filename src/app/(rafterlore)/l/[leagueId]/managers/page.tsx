import type { Metadata } from "next";
import { Suspense } from "react";
import { LeagueGate, LeagueLoading } from "@/components/app/gate";
import { Careers, Section } from "@/components/app/league";

export const metadata: Metadata = { title: "Managers" };

export default function ManagersPage({ params }: PageProps<"/l/[leagueId]/managers">) {
  return (
    <Suspense fallback={<LeagueLoading />}>
      {params.then(({ leagueId }) => (
        <LeagueGate leagueId={leagueId}>
          {(p) => (
            <main>
              <Section id="managers" title="Managers" lede="Everyone who has run a team in the league. Tap a name for their profile.">
                <Careers p={p} />
              </Section>
            </main>
          )}
        </LeagueGate>
      ))}
    </Suspense>
  );
}
