import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { cacheLife } from "next/cache";
import { ImportStatus } from "@/components/app/import-status";
import { LeagueGate, LeagueLoading } from "@/components/app/gate";
import { Archive, Banners, Careers, CurrentTable, Lineups, PackSection, Pickups, Section, TradeCourt } from "@/components/app/league";
import { sleeper, type SLeague } from "@/lib/app/sleeper";
import { isSleeperId } from "@/lib/app/validate";

/** Tab title from Sleeper's public league name (cached; no database or rate limit involved). */
export async function leagueName(id: string) {
  "use cache";
  cacheLife("hours");
  if (!isSleeperId(id)) return null;
  return (await sleeper<SLeague | null>(`/v1/league/${id}`).catch(() => null))?.name ?? null;
}

export async function generateMetadata({ params }: PageProps<"/l/[leagueId]">): Promise<Metadata> {
  const { leagueId } = await params;
  return { title: (await leagueName(leagueId)) ?? "League" };
}

export default function LeaguePage({ params }: PageProps<"/l/[leagueId]">) {
  return (
    <Suspense fallback={<LeagueLoading />}>
      {params.then(({ leagueId }) => (
        <LeagueGate leagueId={leagueId} snapshots>
          {(p) => <Overview p={p} />}
        </LeagueGate>
      ))}
    </Suspense>
  );
}

function Overview({ p }: { p: Parameters<typeof CurrentTable>[0]["p"] }) {
  const { view, analysis, leagueId } = p;
  const n = view.seasons.length;
  return (
    <main>
      <header className="pt-6 md:pt-10">
        <Banners p={p} />
        <div className="mx-auto max-w-6xl px-4 pt-6 md:px-10">
          <h1 className="font-display text-[clamp(3rem,10vw,7.5rem)] leading-[0.86] font-black break-words">{view.name}</h1>
          <p className="mt-4 max-w-[60ch] text-lg text-[var(--muted)]">
            {n} season{n === 1 ? "" : "s"} since {view.seasons[0].years}, {view.careers.length} managers. {p.format.label}.
          </p>
          {!p.format.supported ? (
            <p className="mt-3 text-[var(--paper)]">{p.format.reason} Records below still come straight from Sleeper.</p>
          ) : null}
          {p.db && p.format.supported ? (
            <div className="mt-6">
              <ImportStatus leagueId={leagueId} initial={p.progress} hasResults={!!analysis} />
            </div>
          ) : null}
        </div>
      </header>

      <Section id="table" title="This season">
        <CurrentTable p={p} />
      </Section>

      <Section id="records" title="All-time" lede="Every manager who has played in the league, across every season. Tap a name for their profile.">
        <Careers p={p} />
      </Section>

      <Section id="seasons" title="Season by season">
        <Archive p={p} />
      </Section>

      {analysis ? (
        <>
          <Section
            id="trades"
            title="Trade court"
            lede={`Every trade, judged by what each side's new players scored in that manager's starting lineup afterwards. Within ${analysis.even} points it's called even. Built from Sleeper's weekly lineups, per Sleeper.`}
          >
            <TradeCourt p={p} />
          </Section>
          <Section
            id="lineups"
            title="Lineups"
            lede="Each week replayed from the box scores: what every team scored against the best lineup it could have set from the players it had at tip-off. Season totals use Sleeper's official points."
          >
            <Lineups p={p} />
          </Section>
          {analysis.pickups.length ? (
            <Section id="pickups" title="Best pickups" lede="Waiver and free-agent adds, by what they scored as starters for the manager who found them.">
              <Pickups p={p} />
            </Section>
          ) : null}
        </>
      ) : !p.db ? (
        <Section id="more" title="Trades and lineups">
          <p className="max-w-[60ch] text-[var(--muted)]">
            Trade grades and the lineup replay run as a background import, which needs the app&apos;s database.
          </p>
        </Section>
      ) : null}

      {p.pack ? (
        <Section id="pack" title={p.pack.name} lede={p.pack.intro}>
          <PackSection p={p} />
        </Section>
      ) : null}

      {p.db ? (
        <p className="mx-auto max-w-6xl px-4 pb-14 text-sm text-[var(--muted)] md:px-10">
          Manage this league?{" "}
          <Link href={`/l/${leagueId}/remove`} className="font-semibold text-[var(--paper)] underline underline-offset-4">
            Remove it from Rafterlore
          </Link>
          .
        </p>
      ) : null}
    </main>
  );
}
