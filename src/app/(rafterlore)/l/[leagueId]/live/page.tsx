import type { Metadata } from "next";
import { Suspense } from "react";
import { LeagueGate, LeagueLoading } from "@/components/app/gate";
import { CurrentTable } from "@/components/app/league";
import { LiveGames } from "@/components/app/live";
import { Intro, Pending } from "@/components/app/site";
import { MatchupOfWeek, OfficialTable, WaiverWire } from "@/components/trash/intel";
import { PowerRankings } from "@/components/trash/power";
import { WeeklyRecap } from "@/components/trash/recap";
import { Court, SectionHead } from "@/components/trash/section-head";
import type { LeaguePage } from "@/lib/app/league-page";
import { liveTable, pairings, power, waivers } from "@/lib/app/live-features";
import { logError } from "@/lib/app/safe";
import { weeklyRecap } from "@/lib/core/extras";
import type { Dataset } from "@/lib/core/types";

export const metadata: Metadata = { title: "Live" };

export default function LivePage({ params }: PageProps<"/l/[leagueId]/live">) {
  return (
    <Suspense fallback={<LeagueLoading />}>
      {params.then(({ leagueId }) => (
        <LeagueGate leagueId={leagueId} dataset snapshots>
          {(p) => <Live p={p} />}
        </LeagueGate>
      ))}
    </Suspense>
  );
}

const Loading = ({ what }: { what: string }) => <p className="mx-auto max-w-6xl px-5 text-[var(--muted)] md:px-10">{what}</p>;

/** The live table: official records and points for, this week's opponents, matchup of the week. */
async function Table({ p, d }: { p: LeaguePage; d: Dataset }) {
  const cur = d.league.seasons[d.league.seasons.length - 1];
  const lid = p.view.current.leagueId;
  const [{ rows: official, live: ok, week }, pairs] = await Promise.all([
    liveTable(lid, cur.standings, p.view.sport),
    pairings(lid, p.view.sport).catch((e) => (logError(`pairings ${lid}`, e), null)),
  ]);
  if (!ok || !week || p.view.current.status !== "in_season") return <div className="mx-auto max-w-6xl px-5 md:px-10"><CurrentTable p={p} /></div>;
  const opp = pairs?.week === week ? pairs.opp : {};
  const seed = new Map(official.map((r) => [r.manager, r]));
  const motw = Object.entries(opp)
    .filter(([x, y]) => x < y && seed.has(x) && seed.has(y))
    .sort(([a1, b1], [a2, b2]) => seed.get(a1)!.seed + seed.get(b1)!.seed - (seed.get(a2)!.seed + seed.get(b2)!.seed))[0];
  const side = (id: string) => {
    const o = seed.get(id)!;
    return { manager: id, rec: `${o.w}–${o.l}${o.t ? `–${o.t}` : ""}`, streak: o.streak, pf: o.pf, seed: o.seed };
  };
  const [a, b] = motw ? [...motw].sort((x, y) => seed.get(x)!.seed - seed.get(y)!.seed) : [];
  return (
    <Court id="standings" title={`${cur.years} table`}>
      {a && b ? (
        <div className="mb-10">
          <MatchupOfWeek week={week} a={side(a)} b={side(b)} h2hA={d.league.h2h[a]?.[b] ?? 0} h2hB={d.league.h2h[b]?.[a] ?? 0} />
        </div>
      ) : null}
      <OfficialTable week={week} official={official} opp={opp} />
    </Court>
  );
}

async function Power({ p, d }: { p: LeaguePage; d: Dataset }) {
  const r = await power(p.view.current.leagueId, d, p.view.sport).catch((e) => (logError("power", e), null));
  if (!r) return <Loading what="Power rankings are unavailable right now. Sleeper didn't answer." />;
  return <PowerRankings rows={r.rows} week={r.week} weights={r.weights} />;
}

async function Waivers({ p }: { p: LeaguePage }) {
  const w = await waivers(p.view.current.leagueId, p.view.sport).catch((e) => (logError("waivers", e), null));
  if (!w) return <Loading what="Waiver intel is unavailable right now because Sleeper did not respond. Try again in a few minutes." />;
  return (
    <div className="mx-auto max-w-6xl px-5 md:px-10">
      <WaiverWire players={w.players} week={w.week} />
    </div>
  );
}

function Live({ p }: { p: LeaguePage }) {
  const d = p.dataset;
  const inSeason = p.view.current.status === "in_season";
  if (!d)
    return (
      <main className="overflow-x-clip">
        <Intro title="Live" />
        <Pending p={p} what="The live table, power rankings and recaps" />
      </main>
    );
  const recap = weeklyRecap(d);
  return (
    <main className="overflow-x-clip">
      <Intro title="Live">The table, this week&apos;s matchups, power rankings and the waiver wire, refreshed every few minutes.</Intro>

      <Suspense fallback={<Loading what="Loading the table…" />}>
        <Table p={p} d={d} />
      </Suspense>

      {inSeason ? (
        <section aria-labelledby="week" className="py-10 md:py-24">
          <SectionHead id="week" title="This week">
            {p.view.sport === "nfl"
              ? "Live matchup scores, per Sleeper, refreshed every few minutes."
              : "Who plays who this week and their starters. Sleeper's live basketball scores aren't reliable, so scores show up in the table once the week is final."}
          </SectionHead>
          <div className="mx-auto max-w-6xl px-5 md:px-10">
            <Suspense fallback={<p className="text-[var(--muted)]">Getting this week&apos;s matchups…</p>}>
              <LiveGames p={p} />
            </Suspense>
          </div>
        </section>
      ) : null}

      {inSeason ? (
        <section aria-labelledby="power" className="py-10 md:py-24">
          <SectionHead id="power" title="Power rankings">
            Record, scoring, roster strength and recent form, blended into one number.
          </SectionHead>
          <div className="mx-auto max-w-6xl px-5 md:px-10">
            <Suspense fallback={<p className="text-[var(--muted)]">Ranking the league…</p>}>
              <Power p={p} d={d} />
            </Suspense>
          </div>
        </section>
      ) : null}

      {recap.weeks.length ? (
        <section aria-labelledby="recap" className="py-10 md:py-24">
          <SectionHead id="recap" title="Weekly recap">
            Every finished week: the blowout, the nail-biter, the worst benching and the best pickup. Scores per Sleeper.
          </SectionHead>
          <div className="mx-auto max-w-6xl px-5 md:px-10">
            <WeeklyRecap years={recap.years} weeks={recap.weeks} players={d.extras.players} managers={d.league.managers} />
          </div>
        </section>
      ) : null}

      {inSeason ? (
        <section aria-labelledby="waivers" className="py-10 md:py-24">
          <SectionHead id="waivers" title="Waiver intel">
            The best players nobody in the league has, scored with this league&apos;s settings.
          </SectionHead>
          <Suspense fallback={<Loading what="Reading the wire…" />}>
            <Waivers p={p} />
          </Suspense>
        </section>
      ) : null}
    </main>
  );
}
