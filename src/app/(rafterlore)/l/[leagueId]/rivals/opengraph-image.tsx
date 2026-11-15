import { bannersOf, ogCard, ogLeague, ogSize } from "@/lib/app/og";

export const alt = "Rivalries on Rafterlore";
export const size = ogSize;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  const x = await ogLeague(leagueId);
  if (!x?.d) return ogCard("Rivals", `Who owns who in ${x?.name ?? "the league"}.`);
  const { league } = x.d;
  const nick = (id: string) => league.managers.find((m) => m.id === id)?.nick ?? "?";
  // The most one-sided rivalry with at least four meetings (per Sleeper).
  let best: { a: string; b: string; w: number; l: number } | null = null;
  for (const [a, row] of Object.entries(league.h2h))
    for (const [b, w] of Object.entries(row)) {
      const l = league.h2h[b]?.[a] ?? 0;
      if (w + l >= 4 && w > l && (!best || w - l > best.w - best.l)) best = { a, b, w, l };
    }
  return ogCard(
    best ? `${nick(best.a)} owns ${nick(best.b)}` : "Rivals",
    best ? `${best.w}–${best.l} all-time in ${x.name}, per Sleeper. Pick any two managers and settle it.` : `Pick any two managers in ${x.name} and settle it.`,
    bannersOf(x.d),
  );
}
