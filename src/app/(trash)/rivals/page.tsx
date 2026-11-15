import type { Metadata } from "next";
import { Explain } from "@/components/trash/intel";
import { OwnsGrid } from "@/components/trash/interactive";
import { PageIntro } from "@/components/trash/page-intro";
import { RivalryMachine } from "@/components/trash/rivalry";
import { SectionHead } from "@/components/trash/sections";
import { league } from "@/lib/league";

export const metadata: Metadata = { title: "Rivals — Trash" };

export default function RivalsPage() {
  const names = league.managers.filter((m) => m.id !== "charlesjames05").map((m) => m.id);
  const colors = Object.fromEntries(league.managers.map((m) => [m.id, m.color]));
  return (
    <main className="overflow-x-clip">
      <PageIntro title="Rivals">
        Some rivalries are rivalries. Some are ownership. Pick any two managers and settle it.
      </PageIntro>

      <section aria-labelledby="rivalry" className="py-10 md:py-24">
        <SectionHead id="rivalry" title="Rivalry machine">
          Every meeting, every trade between them and a verdict on who really has the upper hand.
        </SectionHead>
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <RivalryMachine managers={league.managers} seasons={league.seasons} h2h={league.h2h} />
        </div>
      </section>

      <section aria-labelledby="owns" className="py-14 md:py-32">
        <SectionHead id="owns" title="Who owns who">
          Every regular-season meeting, per Sleeper&apos;s weekly scores.
        </SectionHead>
        <OwnsGrid names={names} h2h={league.h2h} colors={colors} />
        <div className="mx-auto max-w-6xl px-5 md:px-10">
          <Explain>
            <p>
              Each square is how many regular-season games the row manager won against the column manager, all
              four seasons combined. Gold squares are winning matchups, red are losing ones. &ldquo;Owns&rdquo;
              means a winning record of at least 5 games with no more than 1 loss.
            </p>
            <p>
              These come from Sleeper&apos;s week-by-week scores, which don&apos;t always match the official
              standings for this league, so treat them as league lore rather than gospel.
            </p>
          </Explain>
        </div>
      </section>
    </main>
  );
}
