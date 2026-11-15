/** The example league is built ahead of time; every other league is built on its first visit and then served from the cache. */
export function generateStaticParams() {
  return [{ leagueId: "1400952185902120960" }];
}

export default function LeagueLayout({ children }: { children: React.ReactNode }) {
  return children;
}
