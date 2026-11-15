import type { Metadata } from "next";
import { Almanac } from "@/components/trash/intel";
import { Ballot, Rain, Story } from "@/components/trash/interactive";
import { MickeyRing } from "@/components/trash/mickey";
import { PageIntro } from "@/components/trash/page-intro";
import { Banners, Crimes, SectionHead } from "@/components/trash/sections";
import { TimeMachine } from "@/components/trash/time-machine";
import { machine, players } from "@/lib/extras";
import { league } from "@/lib/league";
import { mickeyCase, ringRun } from "@/lib/rings";
import { STORY } from "@/lib/story";

export const metadata: Metadata = { title: "History — Trash" };

export default function HistoryPage() {
  const oscar = ringRun("s3");
  const verdict = mickeyCase(oscar, ringRun("s1"));
  return (
    <main className="overflow-x-clip">
      <PageIntro title="History">
        Four seasons of rings, heists and arguments. Everything here is pulled from the Sleeper record. The numbers
        (trade court, re-draft, the Trapezoid of Excellence) live on the Stats page.
      </PageIntro>

      <Banners />

      <section aria-labelledby="almanac" className="py-24 md:py-32">
        <SectionHead id="almanac" title="The almanac">
          Four seasons, sorted by the questions the league actually argues about.
        </SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <Almanac
            managers={league.managers}
            seasons={league.seasons}
            partners={(league as unknown as { partners: { a: string; b: string; n: number }[] }).partners}
          />
        </div>
      </section>

      <section aria-labelledby="machine" className="py-24 md:py-32">
        <SectionHead id="machine" title="Trade time machine">
          Drag through four seasons and watch every roster get built, traded apart and rebuilt, week by week.
        </SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <TimeMachine seasons={machine()} players={players} managers={league.managers} />
        </div>
      </section>

      <Crimes />

      <section aria-labelledby="story" className="py-24 md:pt-32 md:pb-0">
        <SectionHead id="story" title="The story so far">
          Fifteen moments that made the league, drawn from the animated movie.
        </SectionHead>
        <Story items={STORY} />
      </section>

      <section aria-labelledby="movie" className="py-24 md:py-32">
        <SectionHead id="movie" title="Trash: the movie">
          The whole history in four and a half minutes, animated and narrated.
        </SectionHead>
        <div className="mx-auto max-w-sm px-5">
          <video
            className="aspect-[9/16] w-full rounded-3xl bg-black shadow-[0_40px_120px_-40px_rgba(233,196,106,0.45)]"
            src="/trash-the-movie.mp4"
            poster="/story/finale.jpeg"
            controls
            playsInline
            preload="none"
          />
        </div>
      </section>

      <section aria-labelledby="ring" className="py-24 md:py-32">
        <SectionHead id="ring" title="The Mickey Mouse ring inquiry">
          The whole group chat calls Oscar&apos;s title a Mickey Mouse ring. We pulled the tape on every playoff
          game and let the numbers rule.
        </SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <MickeyRing run={oscar} exhibits={verdict.exhibits} mickey={verdict.mickey} players={players} />
        </div>
      </section>

      <section aria-labelledby="auction" className="relative overflow-hidden bg-[#0a1a14] py-28 md:py-40">
        <Rain />
        <div className="relative mx-auto max-w-4xl px-5 md:px-10">
          <h2
            id="auction"
            className="font-display scroll-mt-24 text-[clamp(3.6rem,11vw,9rem)] leading-[0.82] font-black"
          >
            The storm is here
          </h2>
          <p className="mt-6 max-w-[58ch] text-lg leading-relaxed text-[var(--muted)]">
            KawhiNot13 and junkyarddoggg have warned the league. The push for FAAB keeps growing, and so does the
            resentment. Then came the Great Auction: send every waiver pickup back to the wire and start FAAB from
            zero. It would have been the most corrupt thing in fantasy sports history.
          </p>
          <Ballot />
          <p className="font-display mt-10 text-5xl leading-none font-black md:text-7xl">It failed by one vote.</p>
        </div>
      </section>
    </main>
  );
}
