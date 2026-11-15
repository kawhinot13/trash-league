import { TRASH } from "@/lib/extras";
import * as core from "@/lib/core/dive";

/** Dumpster Dive for the Trash site. The game itself is in core/dive.ts and works for any league. */
export type { Prompt } from "@/lib/core/dive";
export const divePool = () => core.divePool(TRASH);
