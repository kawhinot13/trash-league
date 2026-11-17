import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AppNav, YahooNav } from "@/components/app/chrome";
import { RLoader } from "@/components/app/mark";
import { YahooImport, YahooRefresh } from "@/components/app/yahoo-client";
import { BrandProvider, type BrandConfig } from "@/components/trash/brand";
import { SESSION_COOKIE, getAccount, sessionFromValue } from "@/lib/app/account";
import { initialsOf } from "@/lib/core/names";
import type { Dataset } from "@/lib/core/types";
import { HOLIDAY } from "@/lib/holiday";
import { isLeagueKey } from "@/lib/yahoo/api";
import { yahooLeague } from "@/lib/yahoo/import";
import { linkOf, yahooConfigured } from "@/lib/yahoo/oauth";

/**
 * Members-only Yahoo league pages. Every visit checks: signed in to Rafterlore, Yahoo connected, and
 * that Yahoo account manages (or managed) a team in this league. Anyone else gets "not found", so a
 * private league's existence isn't revealed. Rendered per request, never cached for others.
 */
export async function YahooGate({ id, path = "", children }: { id: string; path?: string; children: (d: Dataset) => React.ReactNode }) {
  if (!yahooConfigured() || !isLeagueKey(id)) notFound();
  const jar = await cookies();
  const session = sessionFromValue(jar.get(SESSION_COOKIE)?.value);
  const account = session ? await getAccount(session).catch(() => null) : null;
  const here = `/y/${id}${path}`;
  if (!account)
    return (
      <Gate title="Members only">
        Yahoo leagues on Rafterlore are visible only to their own managers. Sign in, then connect your Yahoo account to see this one.
        <Action href={`/api/auth/google?next=${encodeURIComponent(here)}`}>Sign in with Google</Action>
      </Gate>
    );
  const link = await linkOf(account.id);
  if (!link)
    return (
      <Gate title="Connect Yahoo">
        Yahoo leagues are visible only to their own managers. Connect the Yahoo account you play this league with.
        <Action href={`/api/yahoo/connect?next=${encodeURIComponent(here)}`}>Connect Yahoo</Action>
      </Gate>
    );
  const row = await yahooLeague(id);
  if (!row || !row.members.includes(link.guid)) notFound();
  if (row.status !== "ready" || !row.dataset)
    return (
      <>
        <meta name="robots" content="noindex" />
        <AppNav />
        <YahooImport id={id} name={row.name} failed={row.status === "error"} />
      </>
    );
  const d = row.dataset;
  const brand = brandOf(id, d);
  return (
    <>
      <meta name="robots" content="noindex" />
      <YahooNav name={d.league.seasons[d.league.seasons.length - 1]?.name ?? row.name} id={id} />
      <BrandProvider config={brand}>{children(d)}</BrandProvider>
      <p className="mx-auto max-w-6xl px-5 pb-6 text-xs text-[var(--muted)] md:px-10">
        League data from Yahoo Fantasy, shown only to this league&apos;s managers. Rafterlore isn&apos;t affiliated with or endorsed by
        Yahoo.
      </p>
      {d.league.seasons.at(-1)?.status !== "complete" ? <YahooRefresh id={id} updatedAt={new Date(row.updated_at).toISOString()} /> : null}
    </>
  );
}

function brandOf(id: string, d: Dataset): BrandConfig {
  return {
    name: d.league.seasons.at(-1)?.name ?? d.name,
    tag: "League",
    holiday: HOLIDAY,
    sport: "nfl",
    lineup: "weekly",
    source: "Yahoo",
    since: d.league.seasons[0]?.years.slice(0, 4),
    base: `/y/${id}`,
    storage: `ry:${id}:`,
    scores: "/api/yahoo/scores",
    avatars: Object.fromEntries(d.league.managers.map((m) => [m.id, null])),
    headshots: "badge",
    badges: Object.fromEntries(Object.entries(d.extras.players).map(([pid, p]) => [pid, [initialsOf(p[0]), p[1]?.[0] ?? ""] as [string, string]])),
    games: { dive: "Dumpster Dive", wordle: "Rosterdle", lineup: "The Lineup" },
    wordleHints: true,
    names: Object.fromEntries(d.league.managers.map((m) => [m.id, m.nick])),
    short: Object.fromEntries(d.league.seasons.map((s) => [s.code, `’${s.years.slice(2, 4)}`])),
  };
}

function Gate({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <meta name="robots" content="noindex" />
      <AppNav />
      <main className="mx-auto max-w-6xl px-5 pt-32 pb-24 md:px-10">
        <h1 className="font-display text-5xl font-black md:text-7xl">{title}</h1>
        <div className="mt-4 flex max-w-[56ch] flex-col items-start gap-6 text-lg text-[var(--muted)]">{children}</div>
      </main>
    </>
  );
}

function Action({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="inline-flex h-12 items-center rounded-full bg-[var(--paper)] px-7 text-base font-semibold text-[var(--bin)]">
      {children}
    </a>
  );
}

export function YahooLoading() {
  return (
    <>
      <AppNav />
      <main className="mx-auto flex min-h-[70dvh] max-w-6xl items-center justify-center px-5 pt-24 md:px-10" aria-busy>
        <RLoader label="Loading the league" />
      </main>
    </>
  );
}

