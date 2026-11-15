import "server-only";
import type { PackId } from "@/packs/ids";
import type { LoadedPack } from "@/packs/types";

/** Load a pack's content on demand, so leagues without one never pull it in. */
export async function loadPack(id: PackId | null): Promise<LoadedPack | null> {
  if (id === "trash") return (await import("@/packs/trash")).trashPack();
  return null;
}
