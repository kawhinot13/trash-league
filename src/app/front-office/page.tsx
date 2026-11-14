import type { Metadata } from "next";
import { Suspense } from "react";
import { FrontOfficeTools } from "@/components/trash/front-office";
import { PageIntro } from "@/components/trash/page-intro";
import { frontOffice } from "@/lib/front-office";
import { league } from "@/lib/league";
import { players } from "@/lib/extras";

export const metadata: Metadata = { title: "Front Office — Trash" };

async function Tools() {
  const data = await frontOffice();
  if (!data)
    return (
      <p className="rounded-2xl border border-white/10 p-6 text-[var(--muted)]">
        Sleeper didn&apos;t answer just now. Refresh in a minute to load the live rosters.
      </p>
    );
  const local = Object.entries(players).filter(([, p]) => p[3]).map(([pid]) => pid);
  return <FrontOfficeTools data={data} managers={league.managers} local={local} />;
}

export default function FrontOfficePage() {
  return (
    <main className="overflow-x-clip">
      <PageIntro title="Front office">
        A full scouting report on your team, what it&apos;s great at, what it&apos;s missing and who to go get. Then
        test any trade before you send it.
      </PageIntro>
      <div className="mx-auto max-w-6xl px-5 pt-10 pb-28 md:px-10">
        <Suspense fallback={<p className="text-[var(--muted)]">Loading live rosters from Sleeper…</p>}>
          <Tools />
        </Suspense>
      </div>
    </main>
  );
}
