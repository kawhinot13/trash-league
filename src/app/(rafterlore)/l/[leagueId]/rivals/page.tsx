import type { Metadata } from "next";
import { Suspense } from "react";
import { LeagueGate, LeagueLoading } from "@/components/app/gate";
import { Section } from "@/components/app/league";
import { Rivals } from "@/components/app/rivals";
import type { Game } from "@/lib/app/analysis";
import type { LeaguePage } from "@/lib/app/league-page";

export const metadata: Metadata = { title: "Rivals" };

export default function RivalsPage({ params, searchParams }: PageProps<"/l/[leagueId]/rivals">) {
  return (
    <Suspense fallback={<LeagueLoading />}>
      {Promise.all([params, searchParams]).then(([{ leagueId }, sp]) => (
        <LeagueGate leagueId={leagueId}>{(p) => <RivalsView p={p} a={String(sp.a ?? "")} b={String(sp.b ?? "")} />}</LeagueGate>
      ))}
    </Suspense>
  );
}

function pairs(games: Game[]) {
  const by = new Map<string, { a: string; b: string; aw: number; bw: number; n: number }>();
  for (const g of games) {
    const [a, b] = [g.a, g.b].sort();
    const k = `${a}|${b}`;
    const r = by.get(k) ?? { a, b, aw: 0, bw: 0, n: 0 };
    r.n += 1;
    const aPts = g.a === a ? g.pa : g.pb;
    const bPts = g.a === a ? g.pb : g.pa;
    if (aPts > bPts) r.aw += 1;
    else if (bPts > aPts) r.bw += 1;
    by.set(k, r);
  }
  return [...by.values()].map((r) => (r.bw > r.aw ? { a: r.b, b: r.a, aw: r.bw, bw: r.aw, n: r.n } : r));
}

function RivalsView({ p, a, b }: { p: LeaguePage; a: string; b: string }) {
  const managers = p.view.careers.map((c) => ({ id: c.ownerId, name: p.nameOf(c.ownerId), avatar: c.avatar }));
  const ids = new Set(managers.map((m) => m.id));
  const games = p.analysis?.games ?? [];
  const all = pairs(games.filter((g) => ids.has(g.a) && ids.has(g.b)));
  // Default: the most-played rivalry.
  const top = [...all].sort((x, y) => y.n - x.n)[0];
  const a0 = ids.has(a) ? a : (top?.a ?? managers[0]?.id ?? "");
  const b0 = ids.has(b) && b !== a0 ? b : (top && top.a === a0 ? top.b : managers.find((m) => m.id !== a0)?.id ?? "");
  const owned = [...all].filter((r) => r.n >= 4).sort((x, y) => y.aw - y.bw - (x.aw - x.bw) || y.n - x.n).slice(0, 8);
  const href = (r: { a: string; b: string }) => `/l/${p.leagueId}/rivals?a=${r.a}&b=${r.b}`;
  return (
    <main>
      <Section level={1}
        id="rivals"
        title="Rivals"
        lede="Any two managers, every time they've met. Built from Sleeper's weekly matchup scores, so it's per Sleeper: those don't always match the official totals."
      >
        {!p.analysis ? (
          <p className="text-[var(--muted)]">Rivalries appear once the league&apos;s import finishes. Check the overview for progress.</p>
        ) : managers.length < 2 ? (
          <p className="text-[var(--muted)]">Not enough managers yet.</p>
        ) : (
          <Rivals leagueId={p.leagueId} managers={managers} games={games} a0={a0} b0={b0} />
        )}
      </Section>
      {owned.length ? (
        <Section id="owned" title="Who owns who" lede="The most one-sided rivalries with at least four meetings, per Sleeper.">
          <ol className="grid gap-x-8 sm:grid-cols-2">
            {owned.map((r) => (
              <li key={`${r.a}-${r.b}`} className="border-b border-[var(--line)]">
                <a href={href(r)} className="flex items-center justify-between gap-3 py-3 text-sm tabular-nums">
                  <span className="min-w-0 truncate">
                    <span className="font-semibold">{p.nameOf(r.a)}</span> <span className="text-[var(--muted)]">over</span> {p.nameOf(r.b)}
                  </span>
                  <span className="shrink-0 font-semibold">
                    {r.aw}–{r.bw}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}
    </main>
  );
}
