"use client";

import dynamic from "next/dynamic";

const TrashOverlay = dynamic(() => import("@/packs/trash/overlay").then((m) => m.TrashOverlay), { ssr: false });

/** Client-side extras for a pack (mascots, music). Each pack's code loads only when it's on. */
export function PackOverlay({ id, props }: { id: string; props: Record<string, unknown> | null }) {
  if (id === "trash" && props) return <TrashOverlay {...(props as { rico: { trades: number; record: string } | null; music: boolean })} />;
  return null;
}
