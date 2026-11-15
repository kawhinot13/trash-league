import Link from "next/link";
import { PRODUCT } from "@/lib/app/brand";

/** Slim nav for the multi-league app. The only blurred surface, per the performance rules. */
export function AppNav({ league }: { league?: { name: string; href: string } }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[rgba(17,26,44,0.82)] backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 md:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/l" className="font-display shrink-0 text-2xl font-black tracking-tight">
            {PRODUCT}
          </Link>
          {league ? (
            <>
              <span aria-hidden className="h-5 w-px shrink-0 bg-[var(--line)]" />
              <Link href={league.href} className="truncate text-sm font-semibold text-[var(--muted)] hover:text-[var(--paper)]">
                {league.name}
              </Link>
            </>
          ) : null}
        </div>
        {league ? (
        <Link
          href="/l"
          className="shrink-0 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold transition-colors duration-200 hover:border-[var(--muted)]"
        >
          Find a league
        </Link>
        ) : null}
      </nav>
    </header>
  );
}

export function AppFooter() {
  return (
    <footer className="border-t border-[var(--line)] px-4 py-10 text-sm text-[var(--muted)] md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 md:flex-row md:justify-between">
        <p className="font-display text-3xl font-black text-[var(--paper)]">{PRODUCT}</p>
        <p className="max-w-[60ch]">
          Records, champions, drafts and trades come from Sleeper&apos;s public data. Official points for are saved every
          night. Anything built from Sleeper&apos;s weekly matchup scores is marked &ldquo;per Sleeper&rdquo;: those
          scores don&apos;t always match the official totals. Not affiliated with Sleeper.
        </p>
      </div>
    </footer>
  );
}
