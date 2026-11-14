import type { Metadata } from "next";
import { Suspense } from "react";
import { LiveTable, Waivers } from "@/components/trash/live-blocks";
import { PageIntro } from "@/components/trash/page-intro";
import { SectionHead, Standings } from "@/components/trash/sections";
import { league } from "@/lib/league";

export const metadata: Metadata = { title: "Live — Trash" };

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
      <section aria-labelledby="waivers" className="py-24 md:py-32">
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
