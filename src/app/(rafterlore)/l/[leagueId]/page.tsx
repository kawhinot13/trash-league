import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { cacheLife } from "next/cache";
import { ImportStatus } from "@/components/app/import-status";
import { StandingsNudge } from "@/components/app/standings-nudge";
import { LeagueGate, LeagueLoading } from "@/components/app/gate";
import { PackSection, Section } from "@/components/app/league";
import { Hero } from "@/components/trash/hero";
import { Doors, Pending } from "@/components/app/site";
import { DumpsterDive } from "@/components/trash/dive";
import { Lineup } from "@/components/trash/lineup";
import { StatStrip, Ticker } from "@/components/trash/polish";
import { SectionHead } from "@/components/trash/section-head";
import { Trashle } from "@/components/trash/trashle";
import type { LeaguePage } from "@/lib/app/league-page";
import { liveTable, waivers } from "@/lib/app/live-features";
import { sleeper, type SLeague } from "@/lib/app/sleeper";
import { isSleeperId } from "@/lib/app/validate";
import { divePool } from "@/lib/core/dive";
import { lockIn, tradeCourt } from "@/lib/core/extras";
import { lineup } from "@/lib/core/lineup";
import { trashle } from "@/lib/core/trashle";
import type { Dataset } from "@/lib/core/types";
import { SPORT } from "@/lib/core/sport";
import { HOLIDAY } from "@/lib/holiday";
import { lineupTerms } from "@/lib/core/lineup-terms";

/** Tab title from Sleeper's public league name (cached; no database or rate limit involved). */
export async function leagueName(id: string) {
  "use cache: remote";
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

/** In-season ticker: this week's climber, faller, hottest streak and top pickup, then the history lines. */
async function LiveTicker({ p, d }: { p: LeaguePage; d: Dataset }) {
  const lid = p.view.current.leagueId;
  const cur = d.league.seasons[d.league.seasons.length - 1];
  const [table, wire] = await Promise.all([
    liveTable(lid, cur.standings, p.view.sport).catch(() => null),
    waivers(lid, p.view.sport).catch(() => null),
  ]);
  const items: { tag: string; text: string }[] = [];
  const rows = table?.live ? table.rows : [];
  const week = table?.week ?? null;
  const up = [...rows].sort((a, b) => (b.move ?? 0) - (a.move ?? 0))[0];
  const down = [...rows].sort((a, b) => (a.move ?? 0) - (b.move ?? 0))[0];
  const hot = [...rows].filter((r) => r.streak?.endsWith("W")).sort((a, b) => parseInt(b.streak!) - parseInt(a.streak!))[0];
  if (up?.move && up.move > 0)
    items.push({ tag: "Climber", text: `${p.nameOf(up.manager)} rose ${up.move} spot${up.move > 1 ? "s" : ""} to #${up.seed} after week ${(week ?? 1) - 1}` });
  if (down?.move && down.move < 0) items.push({ tag: "Faller", text: `${p.nameOf(down.manager)} slid ${-down.move} spot${down.move < -1 ? "s" : ""} to #${down.seed}` });
  if (hot && parseInt(hot.streak!) > 1) items.push({ tag: "Streak", text: `${p.nameOf(hot.manager)} has won ${parseInt(hot.streak!)} straight` });
  if (wire?.players[0])
    items.push({ tag: "Waivers", text: `Top pickup: ${wire.players[0].name}, ${wire.players[0].recentAvg.toFixed(1)} fantasy points a game lately` });
  return <Ticker items={[...items, ...tickerItems(d)]} />;
}

/** The line under the giant name: the league's story in one sentence. */
function blurb(p: LeaguePage) {
  const { view } = p;
  const n = view.seasons.length;
  const champs = view.seasons.filter((s) => s.champion);
  const distinct = new Set(champs.map((s) => s.champion?.ownerId)).size;
  const trades = p.dataset?.league.totals.trades;
  return `A fantasy ${SPORT[view.sport].word} league since ${view.seasons[0].years.slice(0, 4)}. ${n} season${n === 1 ? "" : "s"}${
    champs.length ? `, ${distinct} champion${distinct === 1 ? "" : "s"}` : ""
  }${trades ? `, ${trades} trades` : ""}${champs.length && distinct === champs.length && champs.length > 1 ? ", and nobody has won it twice" : ""}.${
    p.scoring === "lock-in" ? " Lock-in scoring: one game counts per lineup spot each week." : p.scoring === "daily" ? " Daily lineups: every game a starter plays counts." : ""
  }`;
}

/** The pill under the hero: the season in progress and who leads, or last season's champion. */
function livePill(p: LeaguePage) {
  const { view, leagueId } = p;
  const cur = view.current;
  if (cur.status === "in_season") {
    const top = cur.teams.filter((t) => t.w === cur.teams[0]?.w && t.l === cur.teams[0]?.l).slice(0, 2);
    return {
      href: `/l/${leagueId}/live`,
      text: (
        <>
          {cur.years}
          {cur.weeksDone ? `, week ${cur.weeksDone + 1}` : ""} is live.{" "}
          <span className="text-[var(--muted)]">{top.map((t) => p.nameOf(t.ownerId)).join(" and ")} lead the table.</span>
        </>
      ),
    };
  }
  const last = [...view.seasons].reverse().find((s) => s.champion);
  return last
    ? {
        href: `/l/${leagueId}/history`,
        text: (
          <>
            {last.years} champion: <span className="text-[var(--muted)]">{p.nameOf(last.champion!.ownerId)}.</span>
          </>
        ),
      }
    : null;
}

function Home({ p }: { p: LeaguePage }) {
  const { view, leagueId, dataset: d } = p;
  const n = view.seasons.length;
  const people = d
    ? d.league.seasons[d.league.seasons.length - 1].standings
        // Open roster slots ("r5") have nobody to play as.
        .filter((r) => /^\d+$/.test(r.manager))
        .map((r) => ({ id: r.manager, nick: d.league.managers.find((m) => m.id === r.manager)?.nick ?? r.manager }))
    : [];
  const lock = d ? lockIn(d) : null;
  const court = d ? tradeCourt(d) : null;
  return (
    <main id="top" className="overflow-x-clip">
      <Hero
        title={view.name}
        week={null}
        leaders={[]}
        holiday={HOLIDAY}
        greeting="Merry Christmas"
        blurb={blurb(p)}
        live={livePill(p)}
      />
      {p.db && p.format.supported && !(d && p.analysis) ? (
        <div className="mx-auto max-w-6xl px-5 pb-10 md:px-10">
          <ImportStatus leagueId={leagueId} initial={p.progress} hasResults={!!d && !!p.analysis} />
        </div>
      ) : null}
      {!p.format.supported ? (
        <p className="mx-auto max-w-6xl px-5 pb-10 text-[var(--paper)] md:px-10">{p.format.reason} Records still come straight from Sleeper.</p>
      ) : null}

      {d ? (
        <>
          <StatStrip
            stats={[
              { value: d.league.totals.seasons, label: "Seasons played" },
              { value: d.league.totals.managers, label: "Managers, all time" },
              { value: d.league.totals.trades, label: "Trades made" },
              { value: new Set(d.league.seasons.filter((s) => s.champion).map((s) => s.champion)).size, label: "Different champions" },
            ]}
          />
          <div className="mt-14 md:mt-20">
            {view.current.status === "in_season" ? (
              <Suspense fallback={<Ticker items={tickerItems(d)} />}>
                <LiveTicker p={p} d={d} />
              </Suspense>
            ) : (
              <Ticker items={tickerItems(d)} />
            )}
          </div>

          <section id="dive" aria-labelledby="dive-title" className="scroll-mt-24 py-24 md:py-32">
            <SectionHead id="dive-title" title="Today's dive">
              Five prompts a day from the league&apos;s history. Any right answer counts, but the more niche your pick,
              the more it scores. Same prompts for everyone, so the group chat can compare.
            </SectionHead>
            <StandingsNudge league={p.brand.name} />
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
                  line: `Profiles, my guys, the ${lineupTerms(p.brand.lineup).index} and the personality quiz.`,
                  stat: lock ? `${Math.round(lock.rows.reduce((t, r) => t + (r.opt - r.act), 0)).toLocaleString()} points left on benches` : "",
                  tone: "#7fd49a",
                },
                { href: "/rivals", title: "Rivals", line: "Who owns who, and the rivalry machine for any two managers.", stat: `${court?.trades.length ?? 0} trades and counting`, tone: "var(--paper)" },
                { href: "/history", title: "History", line: "Every champion, season by season, trade crimes, the time machine and the almanac.", stat: `${n} season${n === 1 ? "" : "s"} on record`, tone: "var(--gold)" },
                { href: "/stats", title: "Stats", line: "The Trapezoid of Excellence, the playoff report, the trade court and the re-draft.", stat: `${court?.trades.length ?? 0} trades judged`, tone: "#c9b6ff" },
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
