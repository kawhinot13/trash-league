import { bannersOf, ogCard, ogLeague, ogSize } from "@/lib/app/og";

export const alt = "Manager profile on Rafterlore";
export const size = ogSize;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ leagueId: string; userId: string }> }) {
  const { leagueId, userId } = await params;
  const x = await ogLeague(leagueId);
  const m = x?.d?.league.managers.find((y) => y.id === userId);
  if (!x || !m) return ogCard(x?.name ?? "Manager", "A manager's career on Rafterlore.");
  const titles = m.titles.length ? `${m.titles.length} title${m.titles.length > 1 ? "s" : ""}` : "no titles yet";
  return ogCard(
    m.nick,
    `${m.w}–${m.l}${m.t ? `–${m.t}` : ""} in ${m.seasons.length} season${m.seasons.length === 1 ? "" : "s"} of ${x.name}, ${titles}, ${m.trades} trades.`,
    bannersOf(x.d!).map((b, i) => ({ ...b, gold: m.titles.includes(x.d!.league.seasons[i].code) })),
  );
}
