import { Hero } from "@/components/trash/hero";
import { Ticker } from "@/components/trash/polish";
import { Court, Standings } from "@/components/trash/sections";
import { MatchupOfWeek, OfficialTable, WaiverWire } from "@/components/trash/intel";
import { league, liveStandings } from "@/lib/league";
import { waiverIntel, weekPairings } from "@/lib/live";

/* Server blocks that read live Sleeper data. Wrap each in <Suspense>.
   Only official numbers: records, points for and this week's pairings. No live team scores. */
export async function LiveTable() {
  const [{ rows: official, live: ok, week }, pairs] = await Promise.all([
    liveStandings(),
    weekPairings(),
  ]);
  if (!ok || !week) return <Standings rows={official} live={ok} week={week} />;
  const opp = pairs?.week === week ? pairs.opp : {};
  // Matchup of the week: the two highest-ranked teams playing each other this week.
  const seed = new Map(official.map((r) => [r.manager, r]));
  const motw = Object.entries(opp)
    .filter(([x, y]) => x < y && seed.has(x) && seed.has(y))
    .sort(
      ([a1, b1], [a2, b2]) =>
        seed.get(a1)!.seed + seed.get(b1)!.seed - (seed.get(a2)!.seed + seed.get(b2)!.seed),
    )[0];
  const side = (name: string) => {
    const o = seed.get(name)!;
    return {
      manager: name,
      rec: `${o.w}–${o.l}${o.t ? `–${o.t}` : ""}`,
      streak: o.streak,
      pf: o.pf,
      seed: o.seed,
    };
  };
  const [a, b] = motw ? [...motw].sort((x, y) => seed.get(x)!.seed - seed.get(y)!.seed) : [];
  return (
    <Court id="standings" title="Season 4 table">
      {a && b ? (
        <div className="mb-10">
          <MatchupOfWeek
            week={week}
            a={side(a)}
            b={side(b)}
            h2hA={league.h2h[a]?.[b] ?? 0}
            h2hB={league.h2h[b]?.[a] ?? 0}
          />
        </div>
      ) : null}
      <OfficialTable week={week} official={official} opp={opp} />
    </Court>
  );
}
export async function LiveTicker() {
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

export async function Waivers() {
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
export async function LiveHero() {
  const { rows, week } = await liveStandings();
  const top = rows
    .filter((r) => r.w === rows[0].w && r.l === rows[0].l)
    .map((r) => r.manager);
  return <Hero week={week} leaders={top.slice(0, 2)} />;
}

