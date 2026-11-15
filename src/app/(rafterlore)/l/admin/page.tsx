import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { AppNav } from "@/components/app/chrome";
import { SESSION_COOKIE, authConfigured, getAccount, sessionFromValue } from "@/lib/app/account";
import { adminStats } from "@/lib/app/admin";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

const n0 = (x: number) => x.toLocaleString("en-US");
const when = (d: Date | null) =>
  d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) : "–";

/** The owner's dashboard. Anyone who isn't a signed-in admin gets a plain "not found". */
/** What anyone who isn't an admin sees: a short note, never data. */
function Gate({ title, children, signIn }: { title: string; children: React.ReactNode; signIn?: boolean }) {
  return (
    <>
      <AppNav />
      <main className="mx-auto min-h-[60dvh] max-w-3xl px-5 pt-36 pb-24 md:px-10 md:pt-44">
        <h1 className="font-display text-6xl leading-[0.9] font-black md:text-7xl">{title}</h1>
        <p className="mt-5 text-lg text-[var(--muted)]">{children}</p>
        {signIn ? (
          <a href="/api/auth/google?next=/l/admin" className="mt-8 inline-block rounded-full bg-[var(--paper)] px-6 py-3 font-semibold text-[var(--bin)]">
            Sign in with Google
          </a>
        ) : null}
      </main>
    </>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <Admin />
    </Suspense>
  );
}

async function Admin() {
  // Read the visitor's cookie first: this page is per request, never prerendered.
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!authConfigured()) return <Gate title="Sign-in isn't set up">Admin needs Google sign-in to be switched on in Vercel first.</Gate>;
  const session = sessionFromValue(raw);
  const me = session ? await getAccount(session).catch(() => null) : null;
  if (!me)
    return (
      <Gate title="Admin" signIn>
        Sign in with the site admin&apos;s Google account to see this page.
      </Gate>
    );
  if (!me.admin)
    return (
      <Gate title="Not an admin (yet)">
        This account doesn&apos;t have admin access. If it should: add its email to <strong>ADMIN_EMAILS</strong> in Vercel
        (Settings, Environment Variables), redeploy, then sign out here and sign back in. Admin access is checked when you
        sign in.
      </Gate>
    );
  const { totals: t, leagues, plays, failures, crons } = await adminStats();
  const cards: [string, string, string?][] = [
    ["Leagues", n0(t.leagues), `${n0(t.seasons)} seasons stored`],
    ["Accounts", n0(t.accounts), `${n0(t.active7)} active, ${n0(t.new7)} new this week`],
    ["Daily-game plays", n0(t.plays7), "last 7 days"],
    ["Sleeper calls", n0(t.calls24), "last 24 hours (limit 500/min)"],
    ["Import queue", `${t.queued + t.running}`, `${t.running} running, ${t.failed7} failed this week`],
    ["Removed leagues", n0(t.removed), "waiting to be deleted"],
  ];
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-6xl px-5 pt-32 pb-24 md:px-10 md:pt-40">
        <p className="text-sm font-semibold tracking-[0.2em] text-[var(--wood)] uppercase">Owner only</p>
        <h1 className="font-display mt-2 text-6xl font-black md:text-7xl">Admin</h1>
        <p className="mt-4 max-w-[60ch] text-[var(--muted)]">
          Rafterlore at a glance. Visits, pages and where people come from are in Vercel → your project → Analytics.
        </p>

        <dl className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(([k, v, sub]) => (
            <div key={k} className="rounded-2xl bg-[var(--bin-2)] p-5">
              <dt className="text-sm text-[var(--muted)]">{k}</dt>
              <dd className="font-display mt-1 text-5xl leading-none font-black tabular-nums">{v}</dd>
              {sub ? <dd className="mt-2 text-sm text-[var(--muted)]">{sub}</dd> : null}
            </div>
          ))}
        </dl>

        {plays.length ? (
          <p className="mt-6 text-sm text-[var(--muted)]">
            Plays this week: {plays.map((p) => `${p.game} ${n0(p.n)}`).join(" · ")}
          </p>
        ) : null}

        <h2 className="font-display mt-16 text-4xl font-black">Leagues</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl bg-[var(--bin-2)]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-[var(--muted)]">
              <tr>
                {["League", "Sport", "Seasons", "Added", "Refreshed"].map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leagues.map((l) => (
                <tr key={l.id} className="border-t border-[var(--line)]">
                  <th scope="row" className="px-4 py-3 font-semibold">
                    <Link href={`/l/${l.id}`} className="underline-offset-4 hover:underline">
                      {l.name}
                    </Link>
                    {l.removed ? <span className="ml-2 text-xs text-[#ffb3a8]">removed</span> : null}
                    {l.pack ? <span className="ml-2 text-xs text-[var(--wood)]">{l.pack} pack</span> : null}
                  </th>
                  <td className="px-4 py-3">{l.sport === "nfl" ? "Football" : "Basketball"}</td>
                  <td className="px-4 py-3 tabular-nums">{l.seasons}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{when(l.created_at)}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{when(l.refreshed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl bg-[var(--bin-2)] p-5">
            <h2 className="font-display text-3xl font-black">Nightly runs</h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              {crons.length
                ? crons.map((c, i) => (
                    <li key={i} className="flex flex-wrap justify-between gap-2">
                      <span>{when(c.started_at)}</span>
                      <span className="text-[var(--muted)]">
                        {c.finished_at ? `${c.leagues} leagues, ${c.snapshots} snapshots${c.failed ? `, ${c.failed} failed` : ""}` : "didn't finish"}
                      </span>
                    </li>
                  ))
                : "No runs yet."}
            </ul>
          </section>
          <section className="rounded-2xl bg-[var(--bin-2)] p-5">
            <h2 className="font-display text-3xl font-black">Recent import failures</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {failures.length
                ? failures.map((f, i) => (
                    <li key={i}>
                      <span className="font-semibold">{f.name}</span> <span className="text-[var(--muted)]">{when(f.updated_at)}</span>
                      <br />
                      <span className="break-words text-[var(--muted)]">{f.error ?? "unknown"}</span>
                    </li>
                  ))
                : "None."}
            </ul>
          </section>
        </div>
      </main>
    </>
  );
}
