import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LeagueGate, LeagueLoading } from "@/components/app/gate";
import { ManagerProfile } from "@/components/app/manager";
import { isSleeperId } from "@/lib/app/validate";

export const metadata: Metadata = { title: "Manager" };

export default function ManagerPage({ params }: PageProps<"/l/[leagueId]/managers/[userId]">) {
  return (
    <Suspense fallback={<LeagueLoading />}>
      {params.then(({ leagueId, userId }) => {
        if (!isSleeperId(userId)) notFound();
        return (
          <LeagueGate leagueId={leagueId}>
            {(p) => {
              if (!p.view.careers.some((c) => c.ownerId === userId)) notFound();
              return <ManagerProfile p={p} ownerId={userId} />;
            }}
          </LeagueGate>
        );
      })}
    </Suspense>
  );
}
