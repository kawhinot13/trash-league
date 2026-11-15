import { TRASH } from "@/lib/extras";
import * as core from "@/lib/core/lineup";

/** The Lineup for the Trash site. The game itself is in core/lineup.ts and works for any league. */
export type { Suspect } from "@/lib/core/lineup";
export const lineup = () => core.lineup(TRASH);
