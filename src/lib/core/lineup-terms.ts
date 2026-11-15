/**
 * Words that depend on how the league's lineups score. A "start" is a week a player was in the
 * starting lineup: a lock-in in lock-in leagues, a game started in football, a week in the lineup
 * with daily lineups.
 */
export function lineupTerms(lineup: "lock-in" | "daily" | "weekly" | null | undefined) {
  const plural = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
  // avg: what a player's average week as a starter is called ("his average lock-in score").
  if (lineup === "weekly") return { starts: (n: number) => plural(n, "start", "starts"), index: "Lineup Index", avg: "score as a starter" };
  if (lineup === "daily")
    return { starts: (n: number) => plural(n, "week in the lineup", "weeks in the lineup"), index: "Lineup Index", avg: "weekly score in the lineup" };
  return { starts: (n: number) => plural(n, "lock-in", "lock-ins"), index: "Lock-In Index", avg: "lock-in score" };
}
