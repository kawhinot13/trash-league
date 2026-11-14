import Link from "next/link";
import { Suspense } from "react";
import { DumpsterDive } from "@/components/trash/dive";
import { Trashle } from "@/components/trash/trashle";
import { Hero } from "@/components/trash/hero";
import { LiveHero, LiveTicker } from "@/components/trash/live-blocks";
import { StatStrip } from "@/components/trash/polish";
import { SectionHead } from "@/components/trash/sections";
import { divePool } from "@/lib/dive";
import { trashle } from "@/lib/trashle";
import { lockIn, players } from "@/lib/extras";
import { league } from "@/lib/league";

/** Doors into the rest of the site, each with one real number so it isn't just a menu. */
function Doors() {
  const lock = lockIn();
  const doors = [
    {
      href: "/live",
      title: "Live",
      line: "The Season 4 table, this week's matchups and the waiver wire.",
      stat: "Updated every few minutes",
      tone: "var(--wood)",
    },
    {
      href: "/managers",
      title: "Managers",
      line: "Profiles, my guys, the Lock-In Index and the personality quiz.",
      stat: `${Math.round(lock.rows.reduce((t, r) => t + (r.opt - r.act), 0)).toLocaleString()} points left on benches`,
      tone: "#7fd49a",
    },
    {
      href: "/rivals",
      title: "Rivals",
      line: "Who owns who, and the rivalry machine for any two managers.",
      stat: `${league.totals.trades} trades and counting`,
      tone: "var(--paper)",
    },
    {
      href: "/history",
      title: "History",
      line: "The Mickey Mouse ring inquiry, the re-draft, the time machine and the story so far.",
      stat: "Three seasons, three champions",
      tone: "var(--gold)",
    },
  ];
  return (
    <section aria-labelledby="explore" className="pb-28 md:pb-36">
      <SectionHead id="explore" title="Around the league" />
      <ul className="mx-auto grid max-w-6xl gap-4 px-5 sm:grid-cols-2 md:px-10">
        {doors.map((d) => (
          <li key={d.href}>
            <Link
              href={d.href}
              className="group flex h-full flex-col justify-between rounded-[24px] border border-white/10 bg-[rgba(16,40,30,0.55)] p-6 transition-[border-color,background-color] duration-200 hover:border-white/25 hover:bg-[rgba(16,40,30,0.8)] md:p-8"
            >
              <div>
                <p className="font-display text-5xl font-black md:text-6xl">{d.title}</p>
                <p className="mt-3 max-w-[40ch] text-[var(--paper)]/80">{d.line}</p>
              </div>
              <p className="mt-8 text-sm font-semibold" style={{ color: d.tone }}>
                {d.stat}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Home() {
  return (
    <main id="top" className="overflow-x-clip">
      <Suspense fallback={<Hero week={null} leaders={["LeBugger", "GreenBean69420"]} />}>
        <LiveHero />
      </Suspense>
      <StatStrip
        stats={[
          { value: league.totals.seasons, label: "Seasons played" },
          { value: league.totals.managers, label: "Managers, all time" },
          { value: league.totals.trades, label: "Trades made" },
          { value: league.seasons.filter((s) => s.champion).length, label: "Different champions" },
        ]}
      />
      <Suspense fallback={<div className="mt-14 h-12 md:mt-20" />}>
        <LiveTicker />
      </Suspense>

      <section id="dive" aria-labelledby="dive-title" className="scroll-mt-24 py-24 md:py-32">
        <SectionHead id="dive-title" title="Today's dive">
          Five prompts a day from four seasons of league history. Any right answer counts, but the more niche
          your pick, the more it scores. Same prompts for everyone, so the group chat can compare.
        </SectionHead>
        <div className="mx-auto max-w-5xl px-5 md:px-10">
          <DumpsterDive pool={divePool()} players={players} />
        </div>
      </section>

      <section id="trashle" aria-labelledby="trashle-title" className="scroll-mt-24 pb-24 md:pb-32">
        <SectionHead id="trashle-title" title="Trashle">
          A new mystery player every day. Guess the last name in six tries.
        </SectionHead>
        <div className="mx-auto max-w-5xl px-5 md:px-10">
          <Trashle {...trashle()} players={players} />
        </div>
      </section>

      <Doors />
    </main>
  );
}
