import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { AppNav } from "@/components/app/chrome";
import { Freshen } from "@/components/app/freshen";
import { Importer } from "@/components/app/importer";
import { loadLeague, type LeaguePage } from "@/lib/app/league-page";
import { isSleeperId } from "@/lib/app/validate";
import { BrandProvider } from "@/components/trash/brand";

/** One load per request, shared by the page and its metadata. */
export const load = cache((leagueId: string, snapshots = false, dataset = false) => loadLeague(leagueId, { snapshots, dataset }));

/**
 * Loads a league for one of its pages and handles every outcome: not a league, rate limited,
 * removed by its members, or Sleeper/database trouble. `children` renders the page itself.
 */
export async function LeagueGate({
  leagueId,
  snapshots,
  dataset,
  children,
}: {
  leagueId: string;
  snapshots?: boolean;
  /** Load the league's full dataset (the shared Trash-style features). */
  dataset?: boolean;
  children: (p: LeaguePage) => React.ReactNode;
}) {
  if (!isSleeperId(leagueId)) notFound();
  // No per-request APIs here: league pages are built once and served from the cache until the
  // league's data changes (invalidateFamily / the league:<id> tag).
  const r = await load(leagueId, snapshots, dataset);
  if (r.status === "not_found") notFound();
  if (r.status === "missing")
    return (
      <>
        <AppNav />
        <Importer leagueId={leagueId} />
      </>
    );
  if (r.status === "limited")
    return (
      <Notice title="Slow down a little">
        Rafterlore only imports a few new leagues per network each hour, to stay gentle on Sleeper. Try this one again in{" "}
        {r.minutes} minute{r.minutes === 1 ? "" : "s"}. Leagues already on Rafterlore open as usual.
      </Notice>
    );
  if (r.status === "removed")
    return (
      <Notice title="This league was removed">
        Its managers asked for it to be taken off Rafterlore, so nothing is shown and nothing new is saved.
        {r.purgeAfter ? (
          <>
            {" "}
            Its stored data is deleted on {new Date(r.purgeAfter).toLocaleDateString("en-US", { month: "long", day: "numeric" })}. Changed
            your mind?{" "}
            <Link href={`/l/${leagueId}/remove`} className="font-semibold text-[var(--paper)] underline underline-offset-4">
              Restore it
            </Link>
            .
          </>
        ) : null}
      </Notice>
    );
  if (r.status === "error")
    return <Notice title="Couldn't load this league">Sleeper or the database didn&apos;t answer. Reload in a moment.</Notice>;
  const p = r.page;
  return (
    <>
      <AppNav league={{ name: p.view.name, id: leagueId, live: p.view.current.status === "in_season" }} />
      <BrandProvider config={p.brand}>{children(p)}</BrandProvider>
      {p.db ? <Freshen leagueId={leagueId} /> : null}
    </>
  );
}

export function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-6xl px-5 pt-36 pb-24 md:px-10">
        <h1 className="font-display text-5xl font-black md:text-7xl">{title}</h1>
        <p className="mt-4 max-w-[56ch] text-lg text-[var(--muted)]">{children}</p>
        <Link href="/l" className="mt-8 inline-block rounded-full bg-[var(--paper)] px-6 py-3 font-semibold text-[var(--bin)]">
          Find a league
        </Link>
      </main>
    </>
  );
}

/** Loading state shared by league pages. */
export function LeagueLoading() {
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-6xl px-5 pt-36 md:px-10" aria-busy>
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="banner h-52 w-32 shrink-0 animate-pulse bg-[var(--bin-2)] md:h-60 md:w-36" />
          ))}
        </div>
        <p className="mt-10 text-[var(--muted)]">Loading the league…</p>
      </main>
    </>
  );
}
