import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppNav } from "@/components/app/chrome";
import { RemoveForm } from "@/components/app/remove-form";
import { hasDb } from "@/lib/app/db";
import { isSleeperId } from "@/lib/app/validate";

export const metadata: Metadata = { title: "Remove a league", robots: { index: false } };

export default function RemovePage({ params }: PageProps<"/l/[leagueId]/remove">) {
  return (
    <Suspense>
      {params.then(async ({ leagueId }) => {
        if (!isSleeperId(leagueId)) notFound();
        await connection();
        return (
          <>
            <AppNav />
            <main className="mx-auto max-w-3xl px-4 py-16 md:px-10 md:py-24">
              <h1 className="font-display text-5xl leading-[0.9] font-black md:text-7xl">Remove this league from Rafterlore</h1>
              <p className="mt-6 text-lg text-[var(--muted)]">
                Any manager in the league can do this. Its pages disappear and Rafterlore stops saving anything for it right
                away. The stored data is deleted for good after seven days, and until then any manager can restore it. The
                league won&apos;t be imported again.
              </p>
              {hasDb() ? (
                <div className="mt-10">
                  <RemoveForm leagueId={leagueId} />
                </div>
              ) : (
                <p className="mt-10">Rafterlore isn&apos;t storing anything for this league.</p>
              )}
            </main>
          </>
        );
      })}
    </Suspense>
  );
}
