import Link from "next/link";
import { PRODUCT } from "@/lib/app/brand";
import { LeagueTabs } from "@/components/app/tabs";

/** Slim nav for Rafterlore. The only blurred surface, per the performance rules. */
export function AppNav({ league }: { league?: { name: string; id: string; live: boolean } }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[rgba(17,26,44,0.86)] backdrop-blur-md">
      <nav aria-label="Rafterlore" className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 md:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/l" className="font-display shrink-0 text-2xl font-black tracking-tight">
            {PRODUCT}
          </Link>
          {league ? (
            <>
              <span aria-hidden className="h-5 w-px shrink-0 bg-[var(--line)]" />
              <Link href={`/l/${league.id}`} className="truncate text-sm font-semibold text-[var(--muted)] hover:text-[var(--paper)]">
                {league.name}
              </Link>
            </>
          ) : null}
        </div>
        {league ? (
          <Link
            href="/l"
            className="hidden shrink-0 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold transition-colors duration-200 hover:border-[var(--muted)] sm:block"
          >
            Find a league
          </Link>
        ) : null}
      </nav>
      {league ? <LeagueTabs id={league.id} live={league.live} /> : null}
    </header>
  );
}

export function AppFooter() {
  return (
    <footer className="border-t border-[var(--line)] px-4 py-10 text-sm text-[var(--muted)] md:px-10">
      <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="font-display text-3xl font-black text-[var(--paper)]">{PRODUCT}</p>
          <p className="mt-3 max-w-[62ch] text-[var(--paper)]/85">
            {PRODUCT} works with Sleeper leagues. It is not affiliated with or endorsed by Sleeper.
          </p>
          <p className="mt-2 max-w-[62ch]">
            League records come from Sleeper&apos;s public data. Anything built from Sleeper&apos;s weekly matchup scores
            is marked &ldquo;per Sleeper&rdquo;, because those don&apos;t always match the official totals. Free and
            non-commercial.
          </p>
        </div>
        <ul className="flex gap-5 font-semibold text-[var(--paper)]">
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
          <li>
            <Link href="/l" className="underline-offset-4 hover:underline">
              Find a league
            </Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}
