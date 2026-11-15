import { bannersOf, ogCard, ogLeague, ogSize } from "@/lib/app/og";

export const alt = "League history on Rafterlore";
export const size = ogSize;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  const x = await ogLeague(leagueId);
  if (!x) return ogCard("League history", "Find your Sleeper league on Rafterlore.");
  if (!x.d) return ogCard(x.name, "Champions, records, every trade graded and daily games for the league.");
  const { league } = x.d;
  const champs = league.seasons.filter((s) => s.champion).map((s) => league.managers.find((m) => m.id === s.champion)?.nick ?? "?");
  const n = league.seasons.length;
  const line = champs.length
    ? `${n} season${n === 1 ? "" : "s"}, ${league.totals.trades} trades. Champions: ${champs.join(", ")}.`
    : `${n} season${n === 1 ? "" : "s"} and counting. The first banner is still blank.`;
  return ogCard(x.name, line, bannersOf(x.d));
}
