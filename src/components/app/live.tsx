import { Avatar } from "@/components/app/avatar";
import type { LeaguePage } from "@/lib/app/league-page";
import { liveWeek, type LiveSide } from "@/lib/app/live-week";
import { logError } from "@/lib/app/safe";

const fmt = (x: number) => x.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * This week's head-to-head games with each side's starters. Scores only where Sleeper's matchup
 * scores are right: football (checked: weekly scores add up to the official totals). Basketball
 * matchup scores don't, so basketball shows the pairings and lineups without points.
 */
export async function LiveGames({ p }: { p: LeaguePage }) {
  const scores = p.view.sport === "nfl";
  const s = p.view.current;
  if (s.status !== "in_season") return <p className="text-[var(--muted)]">No games this week. The season isn&apos;t underway.</p>;
  const lw = await liveWeek(s.leagueId, s.season, p.view.sport).catch((e) => {
    logError(`live ${s.leagueId}`, e);
    return undefined;
  });
  if (lw === undefined) return <p className="text-[var(--muted)]">Sleeper didn&apos;t answer. Reload in a minute.</p>;
  if (!lw || !lw.games.length) return <p className="text-[var(--muted)]">No matchups this week.</p>;
  const team = new Map(s.teams.map((t) => [t.rosterId, t]));
  return (
    <div>
      <p className="text-sm text-[var(--muted)]">
        {scores ? (
          <>
            Week {lw.week}. Updated{" "}
            {new Date(lw.asOf).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET.
          </>
        ) : (
          <>Week {lw.week} matchups.</>
        )}
      </p>
      <ol className="mt-6 grid gap-4 lg:grid-cols-2">
        {lw.games.map(([x, y]) => (
          <li key={`${x.rosterId}-${y.rosterId}`} className="rounded-2xl border border-[var(--line)] bg-[var(--bin-2)] p-4 md:p-5">
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
              <Head side={x} lead={x.pts > y.pts} t={team.get(x.rosterId)} p={p} scores={scores} />
              <span className="pt-8 text-sm text-[var(--muted)]">vs</span>
              <Head side={y} lead={y.pts > x.pts} t={team.get(y.rosterId)} p={p} scores={scores} right />
            </div>
            <details className="group mt-4 border-t border-[var(--line)] pt-3">
              <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--muted)] hover:text-[var(--paper)]">
                <span className="group-open:hidden">Show starters</span>
                <span className="hidden group-open:inline">Hide starters</span>
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-4 text-sm tabular-nums">
                <Starters side={x} scores={scores} />
                <Starters side={y} scores={scores} />
              </div>
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Head({
  side,
  lead,
  t,
  p,
  right,
  scores,
}: {
  side: LiveSide;
  lead: boolean;
  t?: LeaguePage["view"]["current"]["teams"][number];
  p: LeaguePage;
  right?: boolean;
  scores: boolean;
}) {
  const name = t ? p.nameOf(t.ownerId) : "Open team";
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${right ? "items-end text-right" : ""}`}>
      <Avatar src={t?.avatar ?? null} name={name} size={36} />
      <p className="w-full break-words font-semibold">{t?.team ?? name}</p>
      <p className="w-full break-words text-xs text-[var(--muted)]">{name}</p>
      {scores ? (
        <p className={`font-display mt-1 text-4xl leading-none font-black tabular-nums ${lead ? "" : "text-[var(--paper)]/55"}`}>{fmt(side.pts)}</p>
      ) : null}
    </div>
  );
}

function Starters({ side, scores }: { side: LiveSide; scores: boolean }) {
  return (
    <ol className="min-w-0 space-y-1">
      {side.starters.map((s) => (
        <li key={s.pid} className="flex justify-between gap-2">
          <span className="min-w-0 break-words">{s.name}</span>
          {scores ? <span className="shrink-0 text-[var(--muted)]">{fmt(s.pts)}</span> : null}
        </li>
      ))}
    </ol>
  );
}
