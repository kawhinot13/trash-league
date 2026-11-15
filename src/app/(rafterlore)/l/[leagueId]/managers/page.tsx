import { lineupTerms } from "@/lib/core/lineup-terms";
import type { Metadata } from "next";
import { Suspense } from "react";
import { LeagueGate, LeagueLoading } from "@/components/app/gate";
import { Careers } from "@/components/app/league";
import { Intro, Pending } from "@/components/app/site";
import { ManagerCards } from "@/components/trash/interactive";
import { LockInIndex } from "@/components/trash/lockin";
import { MyGuys } from "@/components/trash/my-guys";
import { ManagerQuiz } from "@/components/trash/quiz";
import { SectionHead } from "@/components/trash/section-head";
import type { LeaguePage } from "@/lib/app/league-page";
import { lockIn, myGuys, quizManagers } from "@/lib/core/extras";

export const metadata: Metadata = { title: "Managers" };

export default function ManagersPage({ params }: PageProps<"/l/[leagueId]/managers">) {
  return (
    <Suspense fallback={<LeagueLoading />}>
      {params.then(({ leagueId }) => (
        <LeagueGate leagueId={leagueId} dataset>
          {(p) => <Managers p={p} />}
        </LeagueGate>
      ))}
    </Suspense>
  );
}

function Managers({ p }: { p: LeaguePage }) {
  const d = p.dataset;
  if (!d)
    return (
      <main className="overflow-x-clip">
        <Intro title="Managers" />
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <Careers p={p} />
        </div>
        <Pending p={p} what={`Profiles, my guys, the ${lineupTerms(p.brand.lineup).index} and the quiz`} />
      </main>
    );
  const lock = lockIn(d);
  return (
    <main className="overflow-x-clip">
      <Intro title="Managers">Everyone who has run a team in {d.name}: their records, their guys and how well they set a lineup.</Intro>

      <section aria-labelledby="managers" className="py-10 md:py-24">
        <SectionHead id="managers" title="The roster">Tap a card for the full profile.</SectionHead>
        <ManagerCards managers={d.league.managers} />
      </section>

      <section aria-labelledby="alltime" className="py-10 md:py-24">
        <SectionHead id="alltime" title="All-time">Every season, every manager, ranked.</SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <Careers p={p} />
        </div>
      </section>

      <section aria-labelledby="guys" className="py-10 md:py-24">
        <SectionHead id="guys" title="My guys">
          Every manager&apos;s most-rostered and most productive players, all seasons. Points are what they scored in that
          manager&apos;s starting lineup.
        </SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <MyGuys rows={myGuys(d)} players={d.extras.players} managers={d.league.managers} />
        </div>
      </section>

      <section aria-labelledby="lockin" className="py-10 md:py-24">
        <SectionHead id="lockin" title={`The ${lineupTerms(p.brand.lineup).index}`}>
          {p.view.sport === "nfl"
            ? "Every week replayed from Sleeper's player scores: what each team scored against the best lineup it could have set."
            : "Every week replayed from the box scores: what each team scored against the best lineup it could have set."}
        </SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <LockInIndex {...lock} managers={d.league.managers} />
        </div>
      </section>

      <section aria-labelledby="quiz" className="py-10 md:py-24">
        <SectionHead id="quiz" title={`Which ${d.name} manager are you?`}>Six questions. Your match is decided by how they actually play.</SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <ManagerQuiz managers={quizManagers(d)} />
        </div>
      </section>
    </main>
  );
}
