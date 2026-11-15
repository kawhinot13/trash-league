import Link from "next/link";
import { Suspense } from "react";
import { AccountButton } from "@/components/app/account";
import { RMark } from "@/components/app/mark";
import { GlassNav } from "@/components/trash/polish";
import { PRODUCT } from "@/lib/app/brand";
import { HOLIDAY } from "@/lib/holiday";

/**
 * Rafterlore's chrome is the Trash site's: the same floating glass nav and footer, pointed at
 * the league being viewed. Holiday decor follows the site-wide switch (HOLIDAY); never the Trash song.
 */
/** The nav reads the URL (active section), so it renders inside Suspense on dynamic routes. */
export function AppNav(props: { league?: { name: string; id: string; live: boolean } }) {
  return (
    <Suspense fallback={null}>
      <Nav {...props} />
    </Suspense>
  );
}

function Nav({ league }: { league?: { name: string; id: string; live: boolean } }) {
  if (!league)
    return (
      <GlassNav
        logo={PRODUCT}
        home="/l"
        links={[]}
        cta={{ href: "/l", label: "Find a league" }}
        holiday={HOLIDAY}
        music={false}
        extra={<AccountButton />}
        mark={<RMark className="h-8 w-auto text-[var(--paper)]" />}
      />
    );
  const home = `/l/${league.id}`;
  return (
    <GlassNav
      logo={league.name}
      product={{ name: PRODUCT, href: "/l" }}
      mark={<RMark className="h-9 w-auto text-[var(--paper)]" />}
      home={home}
      links={[
        [home, "Home"],
        [`${home}/live`, "Live"],
        [`${home}/front-office`, "Front office"],
        [`${home}/managers`, "Managers"],
        [`${home}/rivals`, "Rivals"],
        [`${home}/history`, "History"],
        [`${home}/stats`, "Stats"],
      ]}
      cta={{ href: `${home}#dive`, label: "Daily games" }}
      holiday={HOLIDAY}
      music={false}
      extra={<AccountButton />}
    />
  );
}

export function AppFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-[var(--line)] px-5 pt-12 text-sm text-[var(--muted)] md:px-10">
      <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-6">
        <div>
          <p className="font-display flex items-center gap-3 text-4xl font-black text-[var(--paper)]">
            <RMark className="h-10 w-auto" />
            {PRODUCT}
          </p>
          <ul className="mt-4 flex gap-5 font-semibold text-[var(--paper)]">
            <li>
              <Link href="/l" className="underline-offset-4 hover:underline">
                Find a league
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="underline-offset-4 hover:underline">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="underline-offset-4 hover:underline">
                Terms
              </Link>
            </li>
          </ul>
        </div>
        <div className="flex max-w-[56ch] flex-col gap-4">
          <p className="text-[var(--paper)]/85">
            {PRODUCT} works with Sleeper leagues. It is not affiliated with or endorsed by Sleeper.
          </p>
          <p>An independent fantasy sports history and analytics platform. For recreational and informational use only.</p>
          <p>
            Records, champions, drafts and trades come from Sleeper&apos;s public data. Head-to-head records and weekly
            scores come from Sleeper&apos;s weekly matchups, which don&apos;t always match the official totals, so
            they&apos;re marked &ldquo;per Sleeper&rdquo;. Free and non-commercial.
          </p>
        </div>
      </div>
      <p
        aria-hidden
        className="font-display pointer-events-none mt-12 -mb-[0.18em] text-center text-[17vw] leading-[0.8] font-black tracking-[-0.04em] text-transparent uppercase select-none"
        style={{
          backgroundImage: "linear-gradient(180deg, rgba(246,243,234,0.16), rgba(246,243,234,0.02))",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
        }}
      >
        {PRODUCT}
      </p>
    </footer>
  );
}
