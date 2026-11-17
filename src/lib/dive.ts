import { TRASH } from "@/lib/extras";
import * as core from "@/lib/core/dive";
import calendar from "@/data/dive-calendar.json";

/** Dumpster Dive for the Trash site. The game itself is in core/dive.ts and works for any league. */
export type { Prompt } from "@/lib/core/dive";
export const divePool = () => core.divePool(TRASH);
/** Trash's written calendar (scripts/dive-calendar.ts, extended by the daily data refresh). */
export const diveCalendar = calendar as core.Calendar;
