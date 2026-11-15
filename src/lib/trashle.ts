import { TRASH } from "@/lib/extras";
import * as core from "@/lib/core/trashle";

/** Trashle for the Trash site. The game itself is in core/trashle.ts and works for any league. */
export type { TrashleWord } from "@/lib/core/trashle";
export { lastWord } from "@/lib/core/trashle";
export const trashle = () => core.trashle(TRASH);
