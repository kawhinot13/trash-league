import type { Metadata } from "next";
import { Suspense } from "react";
import { LiveTable, Waivers } from "@/components/trash/live-blocks";
import { PageIntro } from "@/components/trash/page-intro";
import { SectionHead, Standings } from "@/components/trash/sections";
import { league } from "@/lib/league";
import { players } from "@/lib/extras";
import { liveRecap } from "@/lib/recap-live";
import { powerRankings } from "@/lib/power";
import { PowerRankings } from "@/components/trash/power";
import { WeeklyRecap } from "@/components/trash/recap";

export const metadata: Metadata = { title: "Live — Trash" };

async function Power() {
  const p = await powerRankings();
  if (!p) return <p className="text-[var(--muted)]">Power rankings load once Sleeper answers. Refresh in a minute.</p>;
  return <PowerRankings rows={p.rows} week={p.week} weights={p.weights} />;
}

async function LiveRecap() {
  const r = await liveRecap();
  return <WeeklyRecap years={r.years} weeks={r.weeks} players={players} managers={league.managers} />;
}

export default function LivePage() {
  return (
    <main className="overflow-x-clip">
      <PageIntro title="Live">
        Season 4 as it stands, this week&apos;s matchups and who to grab off the wire. Straight from Sleeper,
        refreshed every few minutes.
      </PageIntro>
      <div className="h-10" />
      <Suspense fallback={<Standings rows={league.seasons[3].standings} live={false} week={null} />}>
        <LiveTable />
      </Suspense>
      <section aria-labelledby="power" className="py-14 md:py-32">
        <SectionHead id="power" title="Power rankings">
          Not the standings: who&apos;s actually best right now, from record, scoring, roster strength and form.
        </SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <Suspense fallback={<p className="text-[var(--muted)]">Ranking the league…</p>}>
            <Power />
          </Suspense>
        </div>
      </section>

      <section aria-labelledby="recap" className="py-14 md:py-32">
        <SectionHead id="recap" title="Weekly recap">
          Every finished week of the season in one place: blowouts, nail-biters, bench crimes and who carried who.
        </SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <Suspense fallback={<p className="text-[var(--muted)]">Loading the recap…</p>}>
            <LiveRecap />
          </Suspense>
        </div>
      </section>

      <section aria-labelledby="waivers" className="py-14 md:py-32">
        <SectionHead id="waivers" title="Waiver intel">
          Everyone on the wire, ranked for this league&apos;s scoring. Recent form, minutes, games left this week
          and what the rest of Sleeper is grabbing.
        </SectionHead>
        <Suspense
          fallback={<p className="mx-auto max-w-6xl px-5 text-[var(--muted)] md:px-10">Loading the wire…</p>}
        >
          <Waivers />
        </Suspense>
      </section>
    </main>
  );
}
