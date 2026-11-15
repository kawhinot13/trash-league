import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LeagueGate, LeagueLoading } from "@/components/app/gate";
import { ManagerProfile } from "@/components/app/manager";
import { ManagerProfileView } from "@/components/trash/profile";
import { yearsOf } from "@/lib/core/extras";
import { familyView } from "@/lib/app/model";
import { storedLeague } from "@/lib/app/store";
import { isSleeperId } from "@/lib/app/validate";

export const metadata: Metadata = { title: "Manager" };

/** One profile is built ahead of time (the rest on first visit, then cached). */
export async function generateStaticParams({ params }: { params: { leagueId: string } }) {
  const s = await storedLeague(params.leagueId).catch(() => null);
  const first = s ? familyView(s.family).careers[0]?.ownerId : null;
  return [{ userId: first && isSleeperId(first) ? first : "1" }];
}

export default function ManagerPage({ params }: PageProps<"/l/[leagueId]/managers/[userId]">) {
  return (
    <Suspense fallback={<LeagueLoading />}>
      {params.then(({ leagueId, userId }) => {
        if (!isSleeperId(userId)) notFound();
        return (
          <LeagueGate leagueId={leagueId} dataset>
            {(p) => {
              if (!p.view.careers.some((c) => c.ownerId === userId)) notFound();
              if (p.dataset?.league.managers.some((m) => m.id === userId))
                return <ManagerProfileView d={p.dataset} id={userId} label={yearsOf(p.dataset)} base={`/l/${leagueId}`} lineup={p.brand.lineup} even={p.analysis?.even ?? 60} />;
              return <ManagerProfile p={p} ownerId={userId} />;
            }}
          </LeagueGate>
        );
      })}
    </Suspense>
  );
}
