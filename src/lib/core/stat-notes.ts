import { EARLY_WEEKS } from "@/lib/core/trade-value";
/**
 * Plain-language notes on how the numbers are worked out, shared by Trash and Rafterlore so the
 * same stat is always explained the same way. `avg` comes from `lineupTerms(...).avg`.
 */
/** Value over replacement (Rafterlore): `repl` = this season's waiver-level average. */
export const tradeRuleVor = (avg: string, even: number, repl: number, lead = true) =>
  `${lead ? "How trades are scored: a" : "A"} player only counts for what he scores above a waiver-level player (about ${Math.round(repl)} a ${avg} here), ` +
  `for every week he's on your roster and plays. Two depth pieces just above that line add a little; a star adds a lot. ` +
  `Within ${even} is even, and trades from the last ${EARLY_WEEKS} weeks are too early to call.`;

export const tradeRule = (avg: string, even = 60, lead = true) =>
  `${lead ? "How trades are scored: e" : "E"}very week a player you got is on your roster and plays, you get his average ${avg} that season. ` +
  `Started or benched counts the same; weeks he's hurt or gone count zero. More value wins; within ${even} points is even.`;
