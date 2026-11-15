import data from "@/data/extras.json";
import { league } from "@/lib/league";
import * as core from "@/lib/core/extras";
import type { Dataset, ExtrasData } from "@/lib/core/types";

/** Built by scripts/build-extras.py from Sleeper. See that file for the scoring model.
 * The features live in core/extras.ts and work for any league; these wrappers feed them Trash's
 * data so the Trash site's calls stay exactly as they were. */
export type { RawSeason, Players } from "@/lib/core/types";
export type { LockSeason, LockRow, BenchCrime, RedoPick, Redraft, MachineSeason, Trait, QuizManager, Guy, GuysRow, GradedSide, GradedTrade, RecapWeek } from "@/lib/core/extras";
export { EVEN, TRAITS } from "@/lib/core/extras";

const raw = data as unknown as ExtrasData;
export const players = raw.players;
export const asOf = raw.asOf;
/** Trash's whole dataset, for the shared features. */
export const TRASH: Dataset = { name: "Trash", league, extras: raw };

export const years: Record<string, string> = core.yearsOf(TRASH);
export const lockIn = () => core.lockIn(TRASH);
export const redrafts = () => core.redrafts(TRASH);
export const machine = () => core.machine(TRASH);
export const quizManagers = () => core.quizManagers(TRASH);
export const myGuys = () => core.myGuys(TRASH);
export const tradeCourt = () => core.tradeCourt(TRASH);
export const draftEye = (id: string) => core.draftEye(TRASH, id);
export const weeklyRecap = (code = "s4") => core.weeklyRecap(TRASH, code);
