import data from "@/data/extras.json";
import { league } from "@/lib/league";

type PlayoffRow = {
  week: number;
  who: string;
  mid: number;
  act: number;
  opt: number;
  starters: [string, number][];
};
const raw = data as unknown as {
  seasons: { code: string; trades: { sides: Record<string, string[]> }[]; playoffs: PlayoffRow[] }[];
};

const ROUND: Record<number, string> = { 22: "Quarterfinal", 23: "Semifinal", 24: "Final" };

export type RingGame = {
  round: string;
  week: number;
  opp: string;
  oppSeed: number;
  me: { act: number; opt: number };
  op: { act: number; opt: number };
  /** Would the opponent have won with their best possible lineup? */
  oppCouldWin: boolean;
  carry: { pid: string; pts: number }[];
};

export type RingRun = {
  code: string;
  years: string;
  champ: string;
  seed: number;
  record: string;
  pfRank: number;
  trades: number;
  playoffAvg: number;
  games: RingGame[];
};

/** A champion's title run, per Sleeper's weekly playoff scores. */
export function ringRun(code: string): RingRun {
  const ls = league.seasons.find((s) => s.code === code)!;
  const ex = raw.seasons.find((s) => s.code === code)!;
  const champ = ls.champion!;
  const seed = new Map(ls.standings.map((r) => [r.manager, r.seed]));
  const pfRank = [...ls.standings].sort((a, b) => b.pf - a.pf).findIndex((r) => r.manager === champ) + 1;
  const me = ls.standings.find((r) => r.manager === champ)!;
  const games: RingGame[] = [22, 23, 24].map((week) => {
    const a = ex.playoffs.find((e) => e.week === week && e.who === champ)!;
    const b = ex.playoffs.find((e) => e.week === week && e.mid === a.mid && e.who !== champ)!;
    return {
      round: ROUND[week],
      week,
      opp: b.who,
      oppSeed: seed.get(b.who) ?? 0,
      me: { act: a.act, opt: a.opt },
      op: { act: b.act, opt: b.opt },
      oppCouldWin: b.opt > a.act,
      carry: [...a.starters]
        .sort((x, y) => y[1] - x[1])
        .slice(0, 3)
        .map(([pid, pts]) => ({ pid, pts })),
    };
  });
  const all = ex.playoffs.map((e) => e.act);
  return {
    code,
    years: ls.years,
    champ,
    seed: me.seed,
    record: `${me.w}–${me.l}`,
    pfRank,
    trades: ex.trades.filter((t) => t.sides[champ]).length,
    playoffAvg: all.reduce((s, x) => s + x, 0) / all.length,
    games,
  };
}

export type Exhibit = {
  title: string;
  finding: string;
  ruling: "mickey" | "legit";
};

/** The case, built from the numbers. Each exhibit rules one way. */
export function mickeyCase(run: RingRun, compare: RingRun): { exhibits: Exhibit[]; mickey: number } {
  const g = run.games;
  const choked = g.filter((x) => x.oppCouldWin).length;
  const avgOppSeed = g.reduce((s, x) => s + x.oppSeed, 0) / g.length;
  const effMe = g.reduce((s, x) => s + x.me.act, 0) / g.reduce((s, x) => s + x.me.opt, 0);
  const beatAvg = g.filter((x) => x.me.act > run.playoffAvg).length;
  const cChoked = compare.games.filter((x) => x.oppCouldWin).length;
  const exhibits: Exhibit[] = [
    {
      title: "The regular season",
      finding: `${run.record}, the #${run.seed} seed, #${run.pfRank} in points scored. A real contender.`,
      ruling: run.seed <= 3 ? "legit" : "mickey",
    },
    {
      title: "The path",
      finding: `Beat the #${g.map((x) => x.oppSeed).join(", #")} seeds. The final was against the #${g[2].oppSeed} seed, a Cinderella running on fumes.`,
      ruling: avgOppSeed >= 5 ? "mickey" : "legit",
    },
    {
      title: "The opponents' lineups",
      finding: `${choked === 3 ? "All three" : choked} opponents could have won with their best possible lineup. ${g
        .map((x) => `${x.opp} left ${Math.round(x.op.opt - x.op.act)} on the bench`)
        .join(", ")}. For comparison, ${compare.champ}'s ${compare.years} opponents: ${cChoked} of 3.`,
      ruling: choked >= 2 ? "mickey" : "legit",
    },
    {
      title: "Oscar's own lineups",
      finding: `Played ${(effMe * 100).toFixed(0)}% of the best possible lineup in the playoffs. Not exactly locked in either.`,
      ruling: effMe < 0.78 ? "mickey" : "legit",
    },
    {
      title: "The scoreboard",
      finding: `Outscored the league's playoff average (${Math.round(run.playoffAvg)}) in ${beatAvg} of 3 weeks, and won the final by ${Math.round(g[2].me.act - g[2].op.act)}.`,
      ruling: beatAvg >= 2 ? "legit" : "mickey",
    },
    {
      title: "How the roster was built",
      finding: `${run.trades} trades all season. Draft and waivers only. Nobody got fleeced for this ring.`,
      ruling: run.trades === 0 ? "legit" : "mickey",
    },
  ];
  return { exhibits, mickey: exhibits.filter((e) => e.ruling === "mickey").length };
}
