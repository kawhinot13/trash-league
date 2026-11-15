import { sportOf } from "@/lib/core/sport";
import type { Analysis } from "@/lib/app/analysis";
import { seasonView, type Finish } from "@/lib/app/model";
import { seasonYears } from "@/lib/app/sleeper";
import type { PlayerDir } from "@/lib/app/sleeper-cache";
import type { Dataset, ExtrasData, LeagueData, Manager, RawSeason, Season } from "@/lib/core/types";

/**
 * Turn a league's stored Sleeper data and replayed weeks into the same dataset the Trash site is
 * built from (league.json + extras.json shapes), so every shared feature works for any league.
 * Manager ids are Sleeper user ids (open teams: "r<roster id>"); season codes run s1, s2, ...
 */
export type { SeasonInput } from "@/lib/app/analysis";
import type { SeasonInput } from "@/lib/app/analysis";

// Distinct, readable team colors on the dark arena palette, assigned in all-time order.
const COLORS = [
  "#e07a3f", "#3fae5a", "#2ea7e0", "#c8102e", "#a24bd8", "#e9c46a", "#18b39b", "#1d5fbf",
  "#d65aa8", "#8a9a2b", "#9a6a3a", "#5b6ee1", "#e05a5a", "#20b2aa", "#b08ad8", "#6b7a2b",
];

const r1 = (x: number) => Math.round(x * 10) / 10;
const FINISH: Record<Exclude<Finish, null>, string> = {
  Champion: "Champion",
  "Runner-up": "Runner-up",
  Third: "Semifinal",
  Semifinal: "Semifinal",
  Playoffs: "Quarterfinal",
};

export function buildDataset(
  name: string,
  inputs: SeasonInput[],
  analysis: Analysis,
  exact: Map<string, number>,
  dir: PlayerDir,
): Dataset {
  const lgSeasons: Season[] = [];
  const exSeasons: RawSeason[] = [];
  const need = new Set<string>();
  const managerSeasons = new Map<string, Manager["seasons"]>();
  const tradesBy = new Map<string, number>();
  const addsBy = new Map<string, number>();
  const playoffWL = new Map<string, [number, number]>();
  const partners = new Map<string, number>();
  let tradeTotal = 0;
  const gradeOf = new Map(analysis.trades.map((t) => [`${t.season}|${t.week}|${t.ts}`, t]));

  inputs.forEach(({ bundle, weeks, regEnd, current }, si) => {
    const code = `s${si + 1}`;
    const lg = bundle.league;
    const v = seasonView(bundle);
    const who = new Map<number, string>(bundle.rosters.map((r) => [r.roster_id, r.owner_id ?? `r${r.roster_id}`]));
    const W = (rid: number | string) => who.get(Number(rid)) ?? `r${rid}`;
    const model = analysis.model[lg.league_id] ?? "one";
    const complete = lg.status === "complete";
    const reg = weeks.filter((w) => w.week <= regEnd).sort((a, b) => a.week - b.week);
    const all = [...weeks].sort((a, b) => a.week - b.week);

    // Draft: every pick, valued by what the player could score for a team in this format
    // (his best game each regular-season week) and games played.
    const value = new Map<string, number>();
    const gp = new Map<string, number>();
    for (const w of reg)
      for (const [pid, [best, n]] of Object.entries(w.best ?? {})) {
        if (best > 0) value.set(pid, (value.get(pid) ?? 0) + best);
        gp.set(pid, (gp.get(pid) ?? 0) + n);
      }
    const picks = [...bundle.picks].sort((a, b) => a.pick_no - b.pick_no);
    const draft = picks.map((p) => {
      need.add(p.player_id);
      return { no: p.pick_no, round: p.round, pid: p.player_id, by: W(p.roster_id), value: r1(value.get(p.player_id) ?? 0), gp: gp.get(p.player_id) ?? 0 };
    });

    // Rosters: draft night (week 0) and each replayed regular-season week.
    const rosters: Record<string, Record<string, string[]>> = { "0": {} };
    for (const d of draft) (rosters["0"][d.by] ??= []).push(d.pid);
    for (const w of reg) rosters[String(w.week)] = Object.fromEntries(w.teams.map((t) => [W(t.rid), t.pl]));

    // Weekly lines, my guys, adds, playoffs, recap inputs.
    const lineups: Record<string, [number, number, number][]> = {};
    const guys: RawSeason["guys"] = {};
    const adds: Record<string, number> = {};
    const playoffs: RawSeason["playoffs"] = [];
    const weekly: NonNullable<RawSeason["weekly"]> = {};
    const bracketPairs = new Set(
      bundle.winners.filter((m) => m.t1 != null && m.t2 != null).map((m) => [m.t1, m.t2].sort((x, y) => x! - y!).join("-")),
    );
    for (const w of all) {
      const po = w.week > regEnd;
      const starts = new Map<string, Map<string, number>>();
      for (const t of w.teams) {
        const id = W(t.rid);
        const g = (guys[id] ??= {});
        for (const pid of t.pl) {
          const x = (g[pid] ??= [0, 0, 0]);
          x[0] += 1;
          need.add(pid);
        }
        const sm = new Map<string, number>();
        t.st.forEach((pid, i) => {
          const pts = t.sp[i] ?? 0;
          const x = (g[pid] ??= [0, 0, 0]);
          x[1] += 1;
          x[2] = r1(x[2] + pts);
          sm.set(pid, pts);
          need.add(pid);
        });
        starts.set(id, sm);
        const raw = model === "one" ? t.one : t.all;
        const act = exact.get(`${lg.league_id}|${t.rid}|${w.week}`) ?? t.pts;
        const opt = r1(Math.max(raw, act));
        if (!po && (t.pts > 0 || t.st.length)) (lineups[id] ??= []).push([w.week, r1(act), opt]);
        if (po && t.mid != null) {
          const partner = w.teams.find((x) => x.mid === t.mid && x.rid !== t.rid);
          if (partner && bracketPairs.has([t.rid, partner.rid].sort((x, y) => x - y).join("-")))
            playoffs.push({ week: w.week, who: id, mid: t.mid, act: r1(act), opt, starters: t.st.map((p, i) => [p, r1(t.sp[i] ?? 0)]) });
        }
      }
      for (const [rid, pid] of w.adds) {
        adds[W(rid)] = (adds[W(rid)] ?? 0) + 1;
        addsBy.set(W(rid), (addsBy.get(W(rid)) ?? 0) + 1);
        need.add(pid);
      }
      if (!po) {
        const byMid = new Map<number, typeof w.teams>();
        for (const t of w.teams) if (t.mid != null) (byMid.get(t.mid) ?? byMid.set(t.mid, []).get(t.mid)!).push(t);
        const games = [...byMid.values()]
          .filter((p) => p.length === 2)
          .map((p) => p.sort((a, b) => a.rid - b.rid))
          .map(([a, b]) => [W(a.rid), W(b.rid), r1(a.pts), r1(b.pts)] as [string, string, number, number]);
        const top = [...starts.entries()]
          .flatMap(([id, m]) => [...m.entries()].map(([pid, pts]) => [id, pid, pts] as [string, string, number]))
          .sort((a, b) => b[2] - a[2])
          .slice(0, 5);
        const wadds = w.adds
          .map(([rid, pid]) => [W(rid), pid, starts.get(W(rid))?.get(pid) ?? 0] as [string, string, number])
          .sort((a, b) => b[2] - a[2])
          .slice(0, 5);
        weekly[String(w.week)] = { games, top, adds: wadds };
      }
    }

    // Trades, with each side's graded gain [points as a starter afterwards, weeks held].
    const exTrades: RawSeason["trades"] = [];
    const lgTrades: Season["trades"] = [];
    for (const w of current ? [...all, current] : all)
      for (const t of w.trades) {
        const sides = Object.fromEntries(Object.entries(t.sides).map(([rid, got]) => [W(rid), got]));
        const g = gradeOf.get(`${lg.season}|${w.week}|${t.ts}`);
        const gain = g ? Object.fromEntries(g.sides.map((s) => [s.who, [s.pts, s.held] as [number, number]])) : undefined;
        exTrades.push({ week: w.week, sides, ...(gain ? { gain } : {}) });
        lgTrades.push({
          season: code,
          week: w.week,
          sides: Object.fromEntries(
            Object.entries(sides).map(([id, got]) => [
              id,
              got.map((p) => (p.startsWith("pick:") ? { pid: null, name: `${p.slice(5).replace(" R", " round ")} pick` } : { pid: p, name: dir[p]?.[0] ?? p })),
            ]),
          ),
        });
        tradeTotal += 1;
        const ids = Object.keys(sides).sort();
        for (const id of ids) tradesBy.set(id, (tradesBy.get(id) ?? 0) + 1);
        for (let i = 0; i < ids.length; i++)
          for (let j = i + 1; j < ids.length; j++) partners.set(`${ids[i]}|${ids[j]}`, (partners.get(`${ids[i]}|${ids[j]}`) ?? 0) + 1);
        Object.values(sides).flat().forEach((p) => need.add(p));
      }

    // Playoff record, and the bracket the history pages draw.
    const maxR = Math.max(0, ...bundle.winners.map((m) => m.r));
    const bracket: Season["bracket"] = [];
    for (const m of bundle.winners) {
      const fromWinners = m.r === 1 || m.t1_from?.w != null;
      if (!fromWinners || (m.r === maxR && m.p !== 1)) continue;
      bracket.push({ round: m.r, a: m.t1 != null ? W(m.t1) : "", b: m.t2 != null ? W(m.t2) : "", winner: m.w != null ? W(m.w) : null });
      if (m.w != null && m.l != null) {
        const wr = playoffWL.get(W(m.w)) ?? [0, 0];
        wr[0] += 1;
        playoffWL.set(W(m.w), wr);
        const lr = playoffWL.get(W(m.l)) ?? [0, 0];
        lr[1] += 1;
        playoffWL.set(W(m.l), lr);
      }
    }

    const standings = v.teams.map((t) => {
      const r = bundle.rosters.find((x) => x.roster_id === t.rosterId);
      const id = t.ownerId ?? `r${t.rosterId}`;
      const finish = v.finish.get(t.rosterId) ?? null;
      (managerSeasons.get(id) ?? managerSeasons.set(id, []).get(id)!).push({
        code,
        seed: t.seed,
        w: t.w,
        l: t.l,
        t: t.t,
        pf: t.pf,
        team: t.team,
        finish: !complete ? "In progress" : finish ? FINISH[finish] : "Missed playoffs",
      });
      return { manager: id, team: t.team, w: t.w, l: t.l, t: t.t, pf: t.pf, pa: t.pa, moves: r?.settings?.total_moves ?? 0, seed: t.seed, adds: adds[id] ?? 0 };
    });

    lgSeasons.push({
      code,
      years: seasonYears(lg.season, sportOf(lg)),
      name: lg.name,
      status: lg.status,
      leagueId: lg.league_id,
      standings,
      champion: v.champion ? (v.champion.ownerId ?? `r${v.champion.rosterId}`) : null,
      runnerUp: v.runnerUp ? (v.runnerUp.ownerId ?? `r${v.runnerUp.rosterId}`) : null,
      bracket,
      draft: draft.slice(0, lg.total_rosters || 12).map((d) => ({ no: d.no, pid: d.pid, player: dir[d.pid]?.[0] ?? d.pid, by: d.by })),
      trades: lgTrades,
    });
    exSeasons.push({
      code,
      season: lg.season,
      weeks: reg.length,
      status: lg.status,
      draft,
      rosters,
      trades: exTrades,
      adds,
      lineups,
      playoffs,
      guys,
      weekly,
    });
  });

  // Managers, all-time.
  const ids = [...managerSeasons.keys()];
  const latest = new Map<string, { nick: string; team: string }>();
  inputs.forEach(({ bundle }) => {
    const users = new Map(bundle.users.map((u) => [u.user_id, u]));
    for (const r of bundle.rosters) {
      const u = r.owner_id ? users.get(r.owner_id) : undefined;
      const id = r.owner_id ?? `r${r.roster_id}`;
      latest.set(id, { nick: u?.display_name ?? `Team ${r.roster_id}`, team: u?.metadata?.team_name || u?.display_name || `Team ${r.roster_id}` });
    }
  });
  const managers: Manager[] = ids.map((id) => {
    const ss = managerSeasons.get(id)!;
    const w = ss.reduce((a, s) => a + s.w, 0);
    const l = ss.reduce((a, s) => a + s.l, 0);
    const t = ss.reduce((a, s) => a + s.t, 0);
    const gp = w + l + t;
    const titles = ss.filter((s) => s.finish === "Champion").map((s) => s.code);
    const pa = lgSeasons.reduce((a, s) => a + ((s.standings.find((x) => x.manager === id) as { pa?: number } | undefined)?.pa ?? 0), 0);
    const [pw, pl] = playoffWL.get(id) ?? [0, 0];
    return {
      id,
      nick: latest.get(id)?.nick ?? id,
      color: "",
      team: latest.get(id)?.team ?? id,
      w,
      l,
      t,
      pf: r1(ss.reduce((a, s) => a + s.pf, 0)),
      pct: gp ? Math.round(((w + t / 2) / gp) * 1000) / 1000 : 0,
      titles,
      playoffs: ss.filter((s) => s.finish !== "Missed playoffs" && s.finish !== "In progress").length,
      trades: tradesBy.get(id) ?? 0,
      seasons: ss,
      ...({ pa: r1(pa), adds: addsBy.get(id) ?? 0, pw, pl, finals: ss.filter((s) => s.finish === "Champion" || s.finish === "Runner-up").length } as object),
    } as Manager;
  });
  managers.sort((a, b) => b.pct - a.pct);
  managers.forEach((m, i) => (m.color = COLORS[i % COLORS.length]));

  // Head to head per Sleeper (wins of a over b), every meeting including playoffs.
  const h2h: LeagueData["h2h"] = {};
  for (const g of analysis.games) {
    if (g.pa === g.pb) continue;
    const [w, l] = g.pa > g.pb ? [g.a, g.b] : [g.b, g.a];
    (h2h[w] ??= {})[l] = (h2h[w][l] ?? 0) + 1;
  }

  const players: ExtrasData["players"] = {};
  for (const pid of need) {
    if (pid.startsWith("pick:")) continue;
    const p = dir[pid];
    players[pid] = p ? [p[0], p[1], p[2], 1, p[3], p[4]] : [analysis.players[pid]?.[0] ?? "Unknown player", analysis.players[pid]?.[1] ?? [], "", 0, 0, ""];
  }

  return {
    name,
    league: {
      seasons: lgSeasons,
      managers,
      h2h,
      totals: { seasons: lgSeasons.length, managers: managers.length, trades: tradeTotal },
      partners: [...partners.entries()]
        .map(([k, n]) => {
          const [a, b] = k.split("|");
          return { a, b, n };
        })
        .sort((x, y) => y.n - x.n),
    },
    extras: { asOf: new Date().toISOString(), seasons: exSeasons, players },
    sport: sportOf(inputs[inputs.length - 1]?.bundle.league),
  };
}
