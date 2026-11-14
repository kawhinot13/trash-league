import { Suspense } from "react";
import { Hero } from "@/components/trash/hero";
import { Banners, Crimes, Footer, SectionHead, Standings } from "@/components/trash/sections";
import { Ballot, ManagerCards, OwnsGrid, Rain, Story, type StoryItem } from "@/components/trash/interactive";
import { league, liveStandings } from "@/lib/league";

const STORY: StoryItem[] = [
  { img: "/story/draft.jpeg", when: "Draft night, 2023", title: "Luka goes first", text: "Dinahsty opens the first draft in league history with Luka Dončić." },
  { img: "/story/heist.jpeg", when: "Season 1, weeks 3–6", title: "The Jokić heist", text: "Out to MilesBridgessgf in week 3, back to jgood432 in week 6. The league still calls it a scam." },
  { img: "/story/bug.jpeg", when: "Season 1, week 6", title: "Bug's lot", text: "Oscar31 trades Harden and Porziņģis for McCollum and Cam Thomas, then boards up the house." },
  { img: "/story/alley.jpeg", when: "Season 1, week 8", title: "The alley", text: "junkyarddoggg leaves with Wembanyama. charlesjames05 finishes 4–17 and is never seen again." },
  { img: "/story/rico.jpeg", when: "Season 1", title: "The trade machine", text: "RI3O is part of 30 of the league's 50 trades." },
  { img: "/story/final1.jpeg", when: "Season 1 final", title: "The first champion", text: "The #5 seed Dinahsty beats junkyarddoggg, jgood432 and KawhiNot13." },
  { img: "/story/luka.jpeg", when: "Season 2, weeks 2–4", title: "The Luka trades", text: "KawhiNot13 to jgood432, then jgood432 to junkyarddoggg, with Amen Thompson." },
  { img: "/story/gobert.jpeg", when: "Draft, 2024", title: "Round 5, pick 56", text: "Oscar31 takes Rudy Gobert. The crickets take over." },
  { img: "/story/final2.jpeg", when: "Season 2 final", title: "Beaten by the trade", text: "The #5 seed junkyarddoggg knocks out the 18–3 ABsBrainsCells, then beats jgood432." },
  { img: "/story/rico2.jpeg", when: "Season 2, weeks 8–9", title: "Wembanyama, briefly", text: "RI3O holds Wembanyama for one week. A year later: 4–17, dead last." },
  { img: "/story/cinderella.jpeg", when: "Season 3 playoffs", title: "The Cinderella", text: "#8 seed MilesBridgessgf topples the champ, then midnight: Oscar31 wins without a trade." },
  { img: "/story/goodie.jpeg", when: "Seasons 1–3", title: "Always the bridesmaid", text: "jgood432 has the best record ever. 3rd, 2nd, 3rd. Zero rings." },
  { img: "/story/owns.jpeg", when: "All time, per Sleeper", title: "Who owns who", text: "jgood432 is 6–0 against Edizzle6. GreenBean69420 is 6–1 against KawhiNot13." },
  { img: "/story/storm.jpeg", when: "Season 4, now", title: "The Great Storm", text: "KawhiNot13 and junkyarddoggg have warned the league." },
  { img: "/story/auction.jpeg", when: "Season 4, now", title: "The Great Auction", text: "Every pickup back to the wire, FAAB from zero. It failed by one vote." },
];

async function LiveTable() {
  const { rows, live, week } = await liveStandings();
  return <Standings rows={rows} live={live} week={week} />;
}
async function LiveHero() {
  const { rows, week } = await liveStandings();
  const top = rows.filter((r) => r.w === rows[0].w && r.l === rows[0].l).map((r) => r.manager);
  return <Hero week={week} leaders={top.slice(0, 2)} />;
}

export default function Home() {
  const names = league.managers.filter((m) => m.id !== "charlesjames05").map((m) => m.id);
  const colors = Object.fromEntries(league.managers.map((m) => [m.id, m.color]));
  return (
    <main className="overflow-x-clip">
      <Suspense fallback={<Hero week={null} leaders={["LeBugger", "GreenBean69420"]} />}>
        <LiveHero />
      </Suspense>

      <Suspense fallback={<Standings rows={league.seasons[3].standings} live={false} week={null} />}>
        <LiveTable />
      </Suspense>

      <Banners />

      <section aria-labelledby="story" className="py-24 md:pt-32 md:pb-0">
        <SectionHead id="story" title="The story so far">
          Fifteen moments that made the league, drawn from the animated movie.
        </SectionHead>
        <Story items={STORY} />
      </section>

      <Crimes />

      <section aria-labelledby="owns" className="py-24 md:py-32">
        <SectionHead id="owns" title="Who owns who">
          Every regular-season meeting, per Sleeper&apos;s weekly scores. Some rivalries aren&apos;t rivalries, they&apos;re
          ownership.
        </SectionHead>
        <OwnsGrid names={names} h2h={league.h2h} colors={colors} />
      </section>

      <section aria-labelledby="managers" className="py-24 md:py-32">
        <SectionHead id="managers" title="The managers">
          Thirteen people have played in Trash. Ranked by all-time win rate. Open a card for the full file.
        </SectionHead>
        <ManagerCards managers={league.managers} />
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

      <section aria-labelledby="auction" className="relative overflow-hidden bg-[#0a1a14] py-28 md:py-40">
        <Rain />
        <div className="relative mx-auto max-w-4xl px-5 md:px-10">
          <h2 id="auction" className="font-display scroll-mt-24 text-[clamp(3.6rem,11vw,9rem)] leading-[0.82] font-black">
            The storm is here
          </h2>
          <p className="mt-6 max-w-[58ch] text-lg leading-relaxed text-[var(--muted)]">
            KawhiNot13 and junkyarddoggg have warned the league. The push for FAAB keeps growing, and so does the resentment.
            Then came the Great Auction: send every waiver pickup back to the wire and start FAAB from zero. It would have
            been the most corrupt thing in fantasy sports history.
          </p>
          <Ballot />
          <p className="font-display mt-10 text-5xl leading-none font-black md:text-7xl">It failed by one vote.</p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
