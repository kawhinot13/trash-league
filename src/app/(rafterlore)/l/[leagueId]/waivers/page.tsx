import type { Metadata } from "next";
import { Suspense } from "react";
import { LeagueGate, LeagueLoading } from "@/components/app/gate";
import { Intro } from "@/components/app/site";
import { WaiverWire } from "@/components/trash/intel";
import type { LeaguePage } from "@/lib/app/league-page";
import { waivers } from "@/lib/app/live-features";
import { logError } from "@/lib/app/safe";

export const metadata: Metadata = { title: "Waivers" };

export default function WaiversPage({ params }: PageProps<"/l/[leagueId]/waivers">) {
  return (
    <Suspense fallback={<LeagueLoading />}>
      {params.then(({ leagueId }) => (
        <LeagueGate leagueId={leagueId}>{(p) => <Page p={p} />}</LeagueGate>
      ))}
    </Suspense>
  );
}

const Note = ({ children }: { children: React.ReactNode }) => <p className="mx-auto max-w-6xl px-5 text-[var(--muted)] md:px-10">{children}</p>;

async function Wire({ p }: { p: LeaguePage }) {
  const w = await waivers(p.view.current.leagueId, p.view.sport).catch((e) => (logError("waivers", e), null));
  if (!w) return <Note>Waiver intel is unavailable right now because Sleeper did not respond. Try again in a few minutes.</Note>;
  return (
    <div className="mx-auto max-w-6xl px-5 md:px-10">
      <WaiverWire players={w.players} week={w.week} />
    </div>
  );
}

function Page({ p }: { p: LeaguePage }) {
  const inSeason = p.view.current.status === "in_season";
  return (
    <main className="overflow-x-clip">
      <Intro title="Waivers">
        The best players nobody in the league has, scored with this league&apos;s settings. Refreshed every few minutes.
      </Intro>
      <section aria-label="Waiver intel" className="pt-10 pb-14 md:pb-32">
        {inSeason ? (
          <Suspense fallback={<Note>Reading the wire…</Note>}>
            <Wire p={p} />
          </Suspense>
        ) : (
          <Note>The wire opens once the season is underway. Check back after the draft.</Note>
        )}
      </section>
    </main>
  );
}
