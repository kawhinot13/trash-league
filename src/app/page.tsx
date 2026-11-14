import { Suspense } from "react";
import { RivalryMachine } from "@/components/trash/rivalry";
import { LockInIndex } from "@/components/trash/lockin";
import { RedraftBoard } from "@/components/trash/redraft";
import { TimeMachine } from "@/components/trash/time-machine";
import { ManagerQuiz } from "@/components/trash/quiz";
import { RicoPeek } from "@/components/trash/rico-peek";
import {
  lockIn,
  machine,
  players,
  quizManagers,
  redrafts,
} from "@/lib/extras";
import { Hero } from "@/components/trash/hero";
import {
  GlassNav,
  Preloader,
  ScrollProgress,
  StatStrip,
  Ticker,
} from "@/components/trash/polish";
import {
  Banners,
  Court,
  Crimes,
  Footer,
  SectionHead,
  Standings,
} from "@/components/trash/sections";
import {
  Ballot,
  ManagerCards,
  OwnsGrid,
  Rain,
  Story,
  type StoryItem,
} from "@/components/trash/interactive";
import { league, liveStandings } from "@/lib/league";
import { waiverIntel, weekIfEndedToday } from "@/lib/live";
import {
  Almanac,
  Explain,
  LiveWeek,
  MatchupOfWeek,
  WaiverWire,
} from "@/components/trash/intel";

const STORY: StoryItem[] = [
  {
    img: "/story/draft.jpeg",
    when: "Draft night, 2023",
    title: "Luka goes first",
    text: "Dinahsty opens the first draft in league history with Luka Dončić.",
  },
  {
    img: "/story/heist.jpeg",
    when: "Season 1, weeks 3–6",
    title: "The Jokić heist",
    text: "Out to MilesBridgessgf in week 3, back to jgood432 in week 6. The league still calls it a scam.",
  },
  {
    img: "/story/bug.jpeg",
    when: "Season 1, week 6",
    title: "Bug's lot",
    text: "Oscar31 trades Harden and Porziņģis for McCollum and Cam Thomas, then boards up the house.",
  },
  {
    img: "/story/alley.jpeg",
    when: "Season 1, week 8",
    title: "The alley",
    text: "junkyarddoggg leaves with Wembanyama. charlesjames05 finishes 4–17 and is never seen again.",
  },
  {
    img: "/story/rico.jpeg",
    when: "Season 1",
    title: "The trade machine",
    text: "RI3O is part of 30 of the league's 50 trades.",
  },
  {
    img: "/story/final1.jpeg",
    when: "Season 1 final",
    title: "The first champion",
    text: "The #5 seed Dinahsty beats junkyarddoggg, jgood432 and KawhiNot13.",
  },
  {
    img: "/story/luka.jpeg",
    when: "Season 2, weeks 2–4",
    title: "The Luka trades",
    text: "KawhiNot13 to jgood432, then jgood432 to junkyarddoggg, with Amen Thompson.",
  },
  {
    img: "/story/gobert.jpeg",
    when: "Draft, 2024",
    title: "Round 5, pick 56",
    text: "Oscar31 takes Rudy Gobert. The crickets take over.",
  },
  {
    img: "/story/final2.jpeg",
    when: "Season 2 final",
    title: "Beaten by the trade",
    text: "The #5 seed junkyarddoggg knocks out the 18–3 ABsBrainsCells, then beats jgood432.",
  },
  {
    img: "/story/rico2.jpeg",
    when: "Season 2, weeks 8–9",
    title: "Wembanyama, briefly",
    text: "RI3O holds Wembanyama for one week. A year later: 4–17, dead last.",
  },
  {
    img: "/story/cinderella.jpeg",
    when: "Season 3 playoffs",
    title: "The Cinderella",
    text: "#8 seed MilesBridgessgf topples the champ, then midnight: Oscar31 wins without a trade.",
  },
  {
    img: "/story/goodie.jpeg",
    when: "Seasons 1–3",
    title: "Always the bridesmaid",
    text: "jgood432 has the best record ever. 3rd, 2nd, 3rd. Zero rings.",
  },
  {
    img: "/story/owns.jpeg",
    when: "All time, per Sleeper",
    title: "Who owns who",
    text: "jgood432 is 6–0 against Edizzle6. GreenBean69420 is 6–1 against KawhiNot13.",
  },
  {
    img: "/story/storm.jpeg",
    when: "Season 4, now",
    title: "The Great Storm",
    text: "KawhiNot13 and junkyarddoggg have warned the league.",
  },
  {
    img: "/story/auction.jpeg",
    when: "Season 4, now",
    title: "The Great Auction",
    text: "Every pickup back to the wire, FAAB from zero. It failed by one vote.",
  },
];

async function LiveTable() {
  const [{ rows: official, live: ok, week }, wk] = await Promise.all([
    liveStandings(),
    weekIfEndedToday(),
  ]);
  if (!ok || !week) return <Standings rows={official} live={ok} week={week} />;
  // Matchup of the week: the two highest-ranked teams playing each other this week.
  const seed = new Map(official.map((r) => [r.manager, r]));
  const pairs = (wk?.rows ?? []).filter((r) => r.manager < r.opp);
  const motw = pairs.sort(
    (x, y) =>
      seed.get(x.manager)!.seed +
      seed.get(x.opp)!.seed -
      (seed.get(y.manager)!.seed + seed.get(y.opp)!.seed),
  )[0];
  const side = (name: string) => {
    const o = seed.get(name)!;
    const l = wk!.rows.find((r) => r.manager === name)!;
    return {
      manager: name,
      rec: `${o.w}–${o.l}${o.t ? `–${o.t}` : ""}`,
      streak: o.streak,
      now: l.now,
      proj: l.proj,
      winProb: l.winProb,
      seed: o.seed,
    };
  };
  return (
    <Court id="standings" title="Season 4 table">
      {motw ? (
        <div className="mb-10">
          <MatchupOfWeek
            week={week}
            a={side(motw.manager)}
            b={side(motw.opp)}
            h2hA={league.h2h[motw.manager]?.[motw.opp] ?? 0}
            h2hB={league.h2h[motw.opp]?.[motw.manager] ?? 0}
            why="The two highest-ranked teams facing each other."
            asOf={wk!.asOf}
          />
        </div>
      ) : null}
      <LiveWeek
        week={week}
        rows={wk?.rows ?? null}
        daysLeft={wk?.daysLeft ?? 0}
        official={official}
        asOf={wk?.asOf ?? new Date().toISOString()}
      />
    </Court>
  );
}
async function LiveTicker() {
  const [wire, { rows: table, week }] = await Promise.all([
    waiverIntel(),
    liveStandings(),
  ]);
  const items: { tag: string; text: string }[] = [];
  const up = [...table].sort((a, b) => (b.move ?? 0) - (a.move ?? 0))[0];
  const down = [...table].sort((a, b) => (a.move ?? 0) - (b.move ?? 0))[0];
  const hot = [...table]
    .filter((r) => r.streak?.endsWith("W"))
    .sort((a, b) => parseInt(b.streak!) - parseInt(a.streak!))[0];
  if (up?.move)
    items.push({
      tag: "Climber",
      text: `${up.manager} rose ${up.move} spot${up.move > 1 ? "s" : ""} to #${up.seed} after week ${(week ?? 1) - 1}`,
    });
  if (down?.move)
    items.push({
      tag: "Faller",
      text: `${down.manager} slid ${-down.move} spot${down.move < -1 ? "s" : ""} to #${down.seed}`,
    });
  if (hot)
    items.push({
      tag: "Streak",
      text: `${hot.manager} has won ${parseInt(hot.streak!)} straight`,
    });
  if (wire?.players[0])
    items.push({
      tag: "Waivers",
      text: `Top pickup: ${wire.players[0].name}, ${wire.players[0].recentAvg.toFixed(1)} fantasy points a game lately`,
    });
  items.push(
    {
      tag: "Record",
      text: `${league.totals.trades} trades since 2023. RI3O has been in ${league.managers.find((m) => m.id === "RI3O")?.trades ?? 0} of them`,
    },
    {
      tag: "History",
      text: "Three seasons, three different champions. Nobody has won it twice",
    },
    {
      tag: "Ringless",
      text: "jgood432: best record in league history, zero titles",
    },
  );
  return <Ticker items={items} />;
}

async function Waivers() {
  const w = await waiverIntel();
  if (!w)
    return (
      <p className="mx-auto max-w-6xl px-5 text-[var(--muted)] md:px-10">
        Waiver intel is unavailable right now because Sleeper did not respond.
        Try again in a few minutes.
      </p>
    );
  return (
    <div className="mx-auto max-w-6xl px-5 md:px-10">
      <WaiverWire players={w.players} week={w.week} />
    </div>
  );
}
async function LiveHero() {
  const { rows, week } = await liveStandings();
  const top = rows
    .filter((r) => r.w === rows[0].w && r.l === rows[0].l)
    .map((r) => r.manager);
  return <Hero week={week} leaders={top.slice(0, 2)} />;
}

export default function Home() {
  const lock = lockIn();
  const names = league.managers
    .filter((m) => m.id !== "charlesjames05")
    .map((m) => m.id);
  const colors = Object.fromEntries(
    league.managers.map((m) => [m.id, m.color]),
  );
  return (
    <main className="overflow-x-clip">
      <Preloader />
      <RicoPeek
        trades={league.managers.find((m) => m.id === "RI3O")?.trades ?? 0}
        record={(() => {
          const r = league.managers.find((m) => m.id === "RI3O");
          return r ? `${r.w}–${r.l}` : "";
        })()}
      />
      <ScrollProgress />
      <GlassNav />
      <Suspense
        fallback={<Hero week={null} leaders={["LeBugger", "GreenBean69420"]} />}
      >
        <LiveHero />
      </Suspense>

      <StatStrip
        stats={[
          { value: league.totals.seasons, label: "Seasons played" },
          { value: league.totals.managers, label: "Managers, all time" },
          { value: league.totals.trades, label: "Trades made" },
          {
            value: league.seasons.filter((s) => s.champion).length,
            label: "Different champions",
          },
        ]}
      />

      <Suspense fallback={<div className="mt-14 h-12 md:mt-20" />}>
        <LiveTicker />
      </Suspense>
      <div className="h-16 md:h-24" />
      <Suspense
        fallback={
          <Standings
            rows={league.seasons[3].standings}
            live={false}
            week={null}
          />
        }
      >
        <LiveTable />
      </Suspense>

      <section aria-labelledby="waivers" className="py-24 md:py-32">
        <SectionHead id="waivers" title="Waiver intel">
          Everyone on the wire, ranked for this league&apos;s scoring. Recent
          form, minutes, games left this week and what the rest of Sleeper is
          grabbing.
        </SectionHead>
        <Suspense
          fallback={
            <p className="mx-auto max-w-6xl px-5 text-[var(--muted)] md:px-10">
              Loading the wire…
            </p>
          }
        >
          <Waivers />
        </Suspense>
      </section>

      <Banners />

      <section aria-labelledby="almanac" className="py-24 md:py-32">
        <SectionHead id="almanac" title="The almanac">
          Four seasons, sorted by the questions the league actually argues
          about. Luck, playoff résumés, trade partners, waiver habits, drafts
          and every final table.
        </SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <Almanac
            managers={league.managers}
            seasons={league.seasons}
            partners={
              (
                league as unknown as {
                  partners: { a: string; b: string; n: number }[];
                }
              ).partners
            }
          />
        </div>
      </section>

      <Crimes />

      <section aria-labelledby="owns" className="py-24 md:py-32">
        <SectionHead id="owns" title="Who owns who">
          Every regular-season meeting, per Sleeper&apos;s weekly scores. Some
          rivalries aren&apos;t rivalries, they&apos;re ownership.
        </SectionHead>
        <OwnsGrid names={names} h2h={league.h2h} colors={colors} />
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <Explain>
            <p>
              Each square is how many regular-season games the row manager won
              against the column manager, all four seasons combined. Gold
              squares are winning matchups, red are losing ones.
              &ldquo;Owns&rdquo; means a winning record of at least 5 games with
              no more than 1 loss.
            </p>
            <p>
              These come from Sleeper&apos;s week-by-week scores, which
              don&apos;t always match the official standings for this league, so
              treat them as league lore rather than gospel.
            </p>
          </Explain>
        </div>
      </section>

      <section aria-labelledby="rivalry" className="py-24 md:py-32">
        <SectionHead id="rivalry" title="Rivalry machine">
          Pick any two managers. Get every meeting, every trade between them and
          a verdict on who really has the upper hand.
        </SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <RivalryMachine
            managers={league.managers}
            seasons={league.seasons}
            h2h={league.h2h}
          />
        </div>
      </section>

      <section aria-labelledby="lockin" className="py-24 md:py-32">
        <SectionHead id="lockin" title="The Lock-In Index">
          Who sets a lineup like a front office and who leaves 70-point nights
          on the bench. Every manager&apos;s real score against the best lineup
          they could have played.
        </SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <LockInIndex {...lock} managers={league.managers} />
        </div>
      </section>

      <section aria-labelledby="redraft" className="py-24 md:py-32">
        <SectionHead id="redraft" title="The re-draft">
          Every first-round pick, done again knowing how the season actually
          went.
        </SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <RedraftBoard
            drafts={redrafts()}
            players={players}
            managers={league.managers}
          />
        </div>
      </section>

      <section aria-labelledby="machine" className="py-24 md:py-32">
        <SectionHead id="machine" title="Trade time machine">
          Drag through four seasons and watch every roster get built, traded
          apart and rebuilt, week by week.
        </SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <TimeMachine
            seasons={machine()}
            players={players}
            managers={league.managers}
          />
        </div>
      </section>

      <section aria-labelledby="managers" className="py-24 md:py-32">
        <SectionHead id="managers" title="The managers">
          Thirteen people have played in Trash. Ranked by all-time win rate.
          Open a card for the full file.
        </SectionHead>
        <ManagerCards managers={league.managers} />
      </section>

      <section aria-labelledby="quiz" className="py-24 md:py-32">
        <SectionHead id="quiz" title="Which Trash manager are you?">
          Six questions. One match, picked from real Sleeper numbers.
        </SectionHead>
        <div className="mx-auto max-w-4xl px-5 md:px-10">
          <ManagerQuiz managers={quizManagers()} />
        </div>
      </section>

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

      <section
        aria-labelledby="auction"
        className="relative overflow-hidden bg-[#0a1a14] py-28 md:py-40"
      >
        <Rain />
        <div className="relative mx-auto max-w-4xl px-5 md:px-10">
          <h2
            id="auction"
            className="font-display scroll-mt-24 text-[clamp(3.6rem,11vw,9rem)] leading-[0.82] font-black"
          >
            The storm is here
          </h2>
          <p className="mt-6 max-w-[58ch] text-lg leading-relaxed text-[var(--muted)]">
            KawhiNot13 and junkyarddoggg have warned the league. The push for
            FAAB keeps growing, and so does the resentment. Then came the Great
            Auction: send every waiver pickup back to the wire and start FAAB
            from zero. It would have been the most corrupt thing in fantasy
            sports history.
          </p>
          <Ballot />
          <p className="font-display mt-10 text-5xl leading-none font-black md:text-7xl">
            It failed by one vote.
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
