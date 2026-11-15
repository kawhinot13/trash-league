/**
 * Plain-language notes on how the numbers are worked out, shared by Trash and Rafterlore so the
 * same stat is always explained the same way. `avg` comes from `lineupTerms(...).avg`.
 */
export const tradeRule = (avg: string, even = 60, lead = true) =>
  `${lead ? "How trades are scored: e" : "E"}very week a player you got is on your roster and plays, you get his average ${avg} that season. ` +
  `Started or benched counts the same; weeks he's hurt or gone count zero. More value wins; within ${even} points is even.`;
