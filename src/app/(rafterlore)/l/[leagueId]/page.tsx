import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { cacheLife } from "next/cache";
import { ImportStatus } from "@/components/app/import-status";
import { LeagueGate, LeagueLoading } from "@/components/app/gate";
import { Banners, PackSection, Section } from "@/components/app/league";
import { Doors, Pending } from "@/components/app/site";
import { DumpsterDive } from "@/components/trash/dive";
import { Lineup } from "@/components/trash/lineup";
import { StatStrip, Ticker } from "@/components/trash/polish";
import { SectionHead } from "@/components/trash/section-head";
import { Trashle } from "@/components/trash/trashle";
import type { LeaguePage } from "@/lib/app/league-page";
import { sleeper, type SLeague } from "@/lib/app/sleeper";
import { isSleeperId } from "@/lib/app/validate";
import { divePool } from "@/lib/core/dive";
import { lockIn, tradeCourt } from "@/lib/core/extras";
import { lineup } from "@/lib/core/lineup";
import { trashle } from "@/lib/core/trashle";
import type { Dataset } from "@/lib/core/types";

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

export default function LeagueHome({ params }: PageProps<"/l/[leagueId]">) {
  return (
    <Suspense fallback={<LeagueLoading />}>
      {params.then(({ leagueId }) => (
        <LeagueGate leagueId={leagueId} dataset>
          {(p) => <Home p={p} />}
        </LeagueGate>
      ))}
    </Suspense>
  );
}

/** Ticker lines written from the league's own history. */
function tickerItems(d: Dataset): { tag: string; text: string }[] {
  const m = d.league.managers;
  const champs = d.league.seasons.filter((s) => s.champion).map((s) => s.champion!);
  const items: { tag: string; text: string }[] = [];
  const dealer = [...m].sort((a, b) => b.trades - a.trades)[0];
  if (d.league.totals.trades && dealer)
    items.push({ tag: "Record", text: `${d.league.totals.trades} trades since ${d.league.seasons[0].years.slice(0, 4)}. ${dealer.nick} has been in ${dealer.trades} of them` });
  const repeat = champs.find((c, i) => champs.indexOf(c) !== i);
  if (champs.length)
    items.push({
      tag: "History",
      text: repeat
        ? `${m.find((x) => x.id === repeat)?.nick ?? "Someone"} has won it more than once`
        : `${champs.length} season${champs.length > 1 ? "s" : ""}, ${champs.length} different champion${champs.length > 1 ? "s" : ""}. Nobody has won it twice`,
    });
  const ringless = [...m].filter((x) => !x.titles.length && x.seasons.length > 1).sort((a, b) => b.pct - a.pct)[0];
  if (ringless) items.push({ tag: "Ringless", text: `${ringless.nick}: ${(ringless.pct * 100).toFixed(1)}% career win rate, zero titles` });
  const lock = lockIn(d).rows[0];
  if (lock) items.push({ tag: "Lineups", text: `${m.find((x) => x.id === lock.id)?.nick ?? "Someone"} sets the best lineups in the league: ${(lock.eff * 100).toFixed(1)}%` });
  return items;
}

function Home({ p }: { p: LeaguePage }) {
  const { view, leagueId, dataset: d } = p;
  const n = view.seasons.length;
  const people = d
    ? d.league.seasons[d.league.seasons.length - 1].standings.map((r) => ({
        id: r.manager,
        nick: d.league.managers.find((m) => m.id === r.manager)?.nick ?? r.manager,
      }))
    : [];
  const lock = d ? lockIn(d) : null;
  const court = d ? tradeCourt(d) : null;
  return (
    <main id="top" className="overflow-x-clip">
      <header className="pt-6 md:pt-10">
        <Banners p={p} />
        <div className="mx-auto max-w-6xl px-5 pt-6 md:px-10">
          <h1 className="font-display text-[clamp(3rem,10vw,7.5rem)] leading-[0.86] font-black break-words">{view.name}</h1>
          <p className="mt-4 max-w-[60ch] text-lg text-[var(--muted)]">
            {n} season{n === 1 ? "" : "s"} since {view.seasons[0].years}, {view.careers.length} managers. {p.format.label}.
          </p>
          {!p.format.supported ? <p className="mt-3 text-[var(--paper)]">{p.format.reason} Records still come straight from Sleeper.</p> : null}
          {p.db && p.format.supported ? (
            <div className="mt-6">
              <ImportStatus leagueId={leagueId} initial={p.progress} hasResults={!!d && !!p.analysis} />
            </div>
          ) : null}
        </div>
      </header>

      {d ? (
        <>
          <div className="pt-16 md:pt-24" />
          <StatStrip
            stats={[
              { value: d.league.totals.seasons, label: "Seasons played" },
              { value: d.league.totals.managers, label: "Managers, all time" },
              { value: d.league.totals.trades, label: "Trades made" },
              { value: new Set(d.league.seasons.filter((s) => s.champion).map((s) => s.champion)).size, label: "Different champions" },
            ]}
          />
          <div className="mt-14 md:mt-20">
            <Ticker items={tickerItems(d)} />
          </div>

          <section id="dive" aria-labelledby="dive-title" className="scroll-mt-24 py-24 md:py-32">
            <SectionHead id="dive-title" title="Today's dive">
              Five prompts a day from the league&apos;s history. Any right answer counts, but the more niche your pick,
              the more it scores. Same prompts for everyone, so the group chat can compare.
            </SectionHead>
            <div className="mx-auto max-w-5xl px-5 md:px-10">
              <DumpsterDive pool={divePool(d)} players={d.extras.players} people={people} />
            </div>
          </section>

          <section id="trashle" aria-labelledby="trashle-title" className="scroll-mt-24 pb-24 md:pb-32">
            <SectionHead id="trashle-title" title={p.brand.games.wordle}>
              A new mystery player every day. Guess the last name in six tries.
            </SectionHead>
            <div className="mx-auto max-w-5xl px-5 md:px-10">
              <Trashle {...trashle(d)} players={d.extras.players} people={people} />
            </div>
          </section>

          <section id="lineup" aria-labelledby="lineup-title" className="scroll-mt-24 pb-24 md:pb-32">
            <SectionHead id="lineup-title" title="The Lineup">
              Somebody from the league&apos;s history is in the lineup. Name suspects, read the witness statements and
              pick them out in eight tries.
            </SectionHead>
            <div className="mx-auto max-w-6xl px-5 md:px-10">
              <Lineup {...lineup(d)} players={d.extras.players} people={people} />
            </div>
          </section>

          <section aria-labelledby="explore" className="pb-28 md:pb-36">
            <SectionHead id="explore" title="Around the league" />
            <Doors
              leagueId={leagueId}
              items={[
                { href: "/live", title: "Live", line: "This season's table, this week's matchups, power rankings and the waiver wire.", stat: "Updated every few minutes", tone: "var(--wood)" },
                {
                  href: "/managers",
                  title: "Managers",
                  line: "Profiles, my guys, the Lock-In Index and the personality quiz.",
                  stat: lock ? `${Math.round(lock.rows.reduce((t, r) => t + (r.opt - r.act), 0)).toLocaleString()} points left on benches` : "",
                  tone: "#7fd49a",
                },
                { href: "/rivals", title: "Rivals", line: "Who owns who, and the rivalry machine for any two managers.", stat: `${court?.trades.length ?? 0} trades and counting`, tone: "var(--paper)" },
                { href: "/history", title: "History", line: "Every champion, the trade court, the re-draft, the time machine and the almanac.", stat: `${n} season${n === 1 ? "" : "s"} on record`, tone: "var(--gold)" },
                { href: "/front-office", title: "Front office", line: "Your roster's strengths, trade ideas and a trade evaluator, from live rosters.", stat: "Live from Sleeper", tone: "#9fc3ff" },
              ]}
            />
          </section>
        </>
      ) : (
        <Pending p={p} what="Daily games, records and the rest of the league site" />
      )}

      {p.pack ? (
        <Section id="pack" title={p.pack.name} lede={p.pack.intro}>
          <PackSection p={p} />
        </Section>
      ) : null}

      {p.db ? (
        <p className="mx-auto max-w-6xl px-5 pb-14 text-sm text-[var(--muted)] md:px-10">
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
