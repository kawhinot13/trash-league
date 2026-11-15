import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { cacheLife } from "next/cache";
import { AppNav } from "@/components/app/chrome";
import { ImportStatus } from "@/components/app/import-status";
import { Archive, Careers, CurrentTable, Lineups, PackSection, Pickups, Rafters, Section, TradeCourt } from "@/components/app/league";
import { leaguePage } from "@/lib/app/league-page";
import { sleeper, type SLeague } from "@/lib/app/sleeper";
import { PackOverlay } from "@/packs/overlay";

async function leagueName(id: string) {
  "use cache";
  cacheLife("hours");
  return (await sleeper<SLeague | null>(`/v1/league/${id}`).catch(() => null))?.name ?? null;
}

export async function generateMetadata({ params }: PageProps<"/l/[leagueId]">): Promise<Metadata> {
  const { leagueId } = await params;
  const name = /^\d{6,25}$/.test(leagueId) ? await leagueName(leagueId) : null;
  return { title: name ?? "League" };
}

export default function LeaguePage({ params }: PageProps<"/l/[leagueId]">) {
  return (
    <Suspense fallback={<Loading />}>
      <League params={params} />
    </Suspense>
  );
}

function Loading() {
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-6xl px-4 pt-24 md:px-10" aria-busy>
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="banner h-52 w-32 shrink-0 animate-pulse bg-[var(--bin-2)] md:h-60 md:w-36" />
          ))}
        </div>
        <p className="mt-10 text-[var(--muted)]">Finding every season of this league…</p>
      </main>
    </>
  );
}

async function League({ params }: { params: PageProps<"/l/[leagueId]">["params"] }) {
  const { leagueId } = await params;
  await connection(); // per-request: reads the database and in-season data
  const p = await leaguePage(leagueId).catch((e) => {
    console.error(e);
    return null;
  });
  if (!p) notFound();
  const { view, analysis } = p;
  const n = view.seasons.length;
  const href = `/l/${leagueId}`;
  return (
    <>
      <AppNav league={{ name: view.name, href }} />
      <main>
        <header className="pt-6 md:pt-10">
          <Rafters p={p} />
          <div className="mx-auto max-w-6xl px-4 pt-6 md:px-10">
            <h1 className="font-display text-[clamp(3rem,10vw,7.5rem)] leading-[0.86] font-black break-words">{view.name}</h1>
            <p className="mt-4 max-w-[60ch] text-lg text-[var(--muted)]">
              {n} season{n === 1 ? "" : "s"} since {view.seasons[0].years}, {view.careers.length} managers.{" "}
              {p.format.label}.
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

        <Section id="records" title="All-time" lede="Every manager who has played in the league, across every season.">
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
              Trade grades and the lineup replay run as a background import, which needs the app&apos;s database. Once
              it&apos;s connected, they appear here on the first visit.
            </p>
          </Section>
        ) : null}

        {p.pack ? (
          <Section id="pack" title={p.pack.name} lede={p.pack.intro}>
            <PackSection p={p} />
          </Section>
        ) : null}
      </main>
      {p.pack ? <PackOverlay id={p.pack.id} props={p.pack.overlay} /> : null}
    </>
  );
}
