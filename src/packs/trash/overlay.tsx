"use client";

import dynamic from "next/dynamic";

/** Trash's mascots and music, loaded only when the Trash pack is on. */
const PigRide = dynamic(() => import("@/components/pig/pig-ride").then((m) => m.PigRide), { ssr: false });
const RicoPeek = dynamic(() => import("@/components/trash/rico-peek").then((m) => m.RicoPeek), { ssr: false });
const MusicToggle = dynamic(() => import("@/components/holiday/music").then((m) => m.MusicToggle), { ssr: false });

export function TrashOverlay({ rico, music }: { rico: { trades: number; record: string } | null; music: boolean }) {
  return (
    <>
      <PigRide />
      {rico ? <RicoPeek trades={rico.trades} record={rico.record} /> : null}
      {music ? (
        <div className="fixed right-4 bottom-4 z-50">
          <MusicToggle />
        </div>
      ) : null}
    </>
  );
}
