import type { Metadata } from "next";
import { ManagerCards } from "@/components/trash/interactive";
import { LockInIndex } from "@/components/trash/lockin";
import { MyGuys } from "@/components/trash/my-guys";
import { PageIntro } from "@/components/trash/page-intro";
import { ManagerQuiz } from "@/components/trash/quiz";
import { SectionHead } from "@/components/trash/sections";
import { lockIn, myGuys, players, quizManagers } from "@/lib/extras";
import { league } from "@/lib/league";

export const metadata: Metadata = { title: "Managers — Trash" };

export default function ManagersPage() {
  const lock = lockIn();
  return (
    <main className="overflow-x-clip">
      <PageIntro title="Managers">
        Thirteen people have played in Trash. Who they are, who they ride with, and who can actually set a
        lineup.
      </PageIntro>

      <section aria-labelledby="managers" className="py-16 md:py-24">
        <SectionHead id="managers" title="The roster">
          Ranked by all-time win rate. Open a card for the full file.
        </SectionHead>
        <ManagerCards managers={league.managers} />
      </section>

      <section aria-labelledby="guys" className="py-24 md:py-32">
        <SectionHead id="guys" title="My guys">
          Every manager has players they keep coming back to. These are the ones they held the longest and the
          ones who did the most for them.
        </SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <MyGuys rows={myGuys()} players={players} managers={league.managers} />
        </div>
      </section>

      <section aria-labelledby="lockin" className="py-24 md:py-32">
        <SectionHead id="lockin" title="The Lock-In Index">
          Who sets a lineup like a front office and who leaves 70-point nights on the bench. Every
          manager&apos;s real score against the best lineup they could have played. Estimates: built from
          Sleeper&apos;s weekly lineup data, which doesn&apos;t always match the scores in the app.
        </SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <LockInIndex {...lock} managers={league.managers} />
        </div>
      </section>

      <section aria-labelledby="quiz" className="py-24 md:py-32">
        <SectionHead id="quiz" title="Which Trash manager are you?">
          Six questions. One match, picked from real Sleeper numbers.
        </SectionHead>
        <div className="mx-auto max-w-4xl px-5 md:px-10">
          <ManagerQuiz managers={quizManagers()} />
        </div>
      </section>
    </main>
  );
}
