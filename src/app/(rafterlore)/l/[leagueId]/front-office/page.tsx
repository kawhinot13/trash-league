import type { Metadata } from "next";
import { Suspense } from "react";
import { LeagueGate, LeagueLoading } from "@/components/app/gate";
import { Intro, Pending } from "@/components/app/site";
import { FrontOfficeTools } from "@/components/trash/front-office";
import type { LeaguePage } from "@/lib/app/league-page";
import { frontOffice } from "@/lib/app/live-features";
import { logError } from "@/lib/app/safe";

export const metadata: Metadata = { title: "Front office" };

export default function FrontOfficePage({ params }: PageProps<"/l/[leagueId]/front-office">) {
  return (
    <Suspense fallback={<LeagueLoading />}>
      {params.then(({ leagueId }) => (
        <LeagueGate leagueId={leagueId} dataset>
          {(p) => <Office p={p} />}
        </LeagueGate>
      ))}
    </Suspense>
  );
}

async function Tools({ p }: { p: LeaguePage }) {
  const data = await frontOffice(p.view.current.leagueId).catch((e) => (logError("front office", e), null));
  if (!data || !data.teams.length)
    return <p className="text-[var(--muted)]">Live rosters are unavailable right now. Sleeper didn&apos;t answer, or the season hasn&apos;t started.</p>;
  return <FrontOfficeTools data={data} managers={p.dataset!.league.managers} local={[]} />;
}

function Office({ p }: { p: LeaguePage }) {
  return (
    <main className="overflow-x-clip">
      <Intro title="Front office">
        Pick your team. See where it&apos;s strong, where it&apos;s thin, who to target and whether a trade helps, from live
        rosters.
      </Intro>
      {p.dataset ? (
        <div className="mx-auto max-w-6xl px-5 pb-24 md:px-10">
          <Suspense fallback={<p className="text-[var(--muted)]">Loading live rosters from Sleeper…</p>}>
            <Tools p={p} />
          </Suspense>
        </div>
      ) : (
        <Pending p={p} what="The front office" />
      )}
    </main>
  );
}
