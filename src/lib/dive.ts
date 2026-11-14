import data from "@/data/extras.json";
import { players } from "@/lib/extras";
import { league } from "@/lib/league";

/**
 * Dumpster Dive: five "name a player who…" prompts a day where the more niche your correct
 * answer, the more it scores.
 *
 * How obvious an answer is mixes two things:
 *  - League fame, the same for every prompt: production in Trash starting lineups (50%), how
 *    early he has ever been drafted in Trash (30%) and weeks on Trash rosters (20%).
 *  - The prompt's own signal, e.g. for "taken in the first round" an earlier pick is more
 *    obvious; for "started for Rico" more starts for Rico is more obvious.
 * Answers are ranked by that mix: the most obvious scores 0, the deepest cut 100.
 */
export type Prompt = {
  kind: string;
  prompt: string;
  /** [pid, niche score 0-100] for every valid answer, deepest first */
  answers: [string, number][];
};

type Raw = {
  seasons: {
    code: string;
    status: string;
    draft: { no: number; pid: string; by: string; round: number }[];
    trades: { sides: Record<string, string[]> }[];
    playoffs: { starters: [string, number][] }[];
    guys: Record<string, Record<string, [number, number, number]>>;
  }[];
};
const raw = data as unknown as Raw;
const nick = (id: string) => league.managers.find((m) => m.id === id)?.nick ?? id;

/** Percentile rank in [0, 1] of each value among the map's values (higher value -> closer to 1). */
function pct(m: Map<string, number>): Map<string, number> {
  const vals = [...m.values()].sort((a, b) => a - b);
  const n = Math.max(1, vals.length - 1);
  const out = new Map<string, number>();
  for (const [k, v] of m) {
    let lo = 0;
    let hi = vals.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (vals[mid] < v) lo = mid + 1;
      else hi = mid;
    }
    out.set(k, lo / n);
  }
  return out;
}

/** League-wide fame for every player, 0 (nobody) to 1 (Jokić). */
function leagueFame() {
  const prod = new Map<string, number>();
  const weeks = new Map<string, number>();
  const early = new Map<string, number>();
  for (const s of raw.seasons) {
    for (const ps of Object.values(s.guys))
      for (const [pid, [w, , pts]] of Object.entries(ps)) {
        prod.set(pid, (prod.get(pid) ?? 0) + pts);
        weeks.set(pid, (weeks.get(pid) ?? 0) + w);
      }
    for (const d of s.draft) early.set(d.pid, Math.max(early.get(d.pid) ?? 0, 200 - d.no));
  }
  for (const pid of prod.keys()) if (!early.has(pid)) early.set(pid, 0);
  const [P, W, E] = [pct(prod), pct(weeks), pct(early)];
  const fame = new Map<string, number>();
  for (const pid of prod.keys()) fame.set(pid, 0.5 * (P.get(pid) ?? 0) + 0.3 * (E.get(pid) ?? 0) + 0.2 * (W.get(pid) ?? 0));
  return fame;
}

/**
 * Score a prompt's answers. `signal` is the prompt's own "how obvious" value per answer (higher =
 * more obvious); `weight` is how much it counts against league fame.
 */
function score(signal: Map<string, number>, fame: Map<string, number>, weight: number): [string, number][] {
  const ids = [...signal.keys()].filter((p) => players[p]?.[0]);
  const local = pct(new Map(ids.map((p) => [p, signal.get(p)!])));
  const obvious = ids.map((p) => [p, weight * local.get(p)! + (1 - weight) * (fame.get(p) ?? 0)] as const);
  const n = obvious.length;
  return obvious
    .map(([p, o]) => {
      const more = obvious.filter(([, x]) => x > o).length; // answers more obvious than this one
      return [p, Math.round((100 * more) / Math.max(1, n - 1))] as [string, number];
    })
    .sort((a, b) => b[1] - a[1]);
}

export function divePool(): Prompt[] {
  const fame = leagueFame();
  const years = Object.fromEntries(league.seasons.map((s) => [s.code, s.years]));
  const active = league.seasons.find((s) => s.code === "s4")!.standings.map((r) => r.manager);
  const out: Prompt[] = [];
  const add = (kind: string, prompt: string, signal: Map<string, number>, weight: number) => {
    const answers = score(signal, fame, weight);
    if (answers.length >= 8) out.push({ kind, prompt, answers });
  };
  const sum = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);

  for (const m of active) {
    const starts = new Map<string, number>();
    const picks = new Map<string, number>();
    for (const s of raw.seasons) {
      for (const [pid, [, st]] of Object.entries(s.guys[m] ?? {})) if (st > 0) sum(starts, pid, st);
      for (const d of s.draft.filter((x) => x.by === m)) picks.set(d.pid, Math.max(picks.get(d.pid) ?? 0, 200 - d.no));
    }
    add("Starters", `Name a player ${nick(m)} has started.`, starts, 0.55);
    add("Draft night", `Name a player ${nick(m)} has drafted.`, picks, 0.6);
    for (const s of raw.seasons.filter((x) => x.status === "complete")) {
      const wk = new Map(Object.entries(s.guys[m] ?? {}).map(([pid, [w]]) => [pid, w] as [string, number]));
      add("Locker room", `Name a player who was on ${nick(m)}'s roster in ${years[s.code]}.`, wk, 0.55);
    }
  }
  for (const s of raw.seasons) {
    // Traded that season: obvious = how much he produced in Trash that season.
    const prodSeason = new Map<string, number>();
    for (const ps of Object.values(s.guys)) for (const [pid, [, , pts]] of Object.entries(ps)) sum(prodSeason, pid, pts);
    const traded = new Map<string, number>();
    for (const t of s.trades)
      for (const p of Object.values(t.sides).flat()) if (!p.startsWith("pick:")) traded.set(p, prodSeason.get(p) ?? 0);
    add("Trade log", `Name a player who was traded in ${years[s.code]}.`, traded, 0.5);
    if (s.playoffs.length) {
      const ps = new Map<string, number>();
      for (const g of s.playoffs) for (const [p, pts] of g.starters) sum(ps, p, 1 + pts / 100);
      add("Playoffs", `Name a player who started a playoff game in ${years[s.code]}.`, ps, 0.5);
    }
  }
  // Journeymen: more Trash teams is the obvious end of this one.
  const teams = new Map<string, Set<string>>();
  for (const s of raw.seasons)
    for (const [m, ps] of Object.entries(s.guys))
      for (const p of Object.keys(ps)) (teams.get(p) ?? teams.set(p, new Set()).get(p)!).add(m);
  add(
    "Journeymen",
    "Name a player who has been on at least three different Trash rosters.",
    new Map([...teams].filter(([, ms]) => ms.size >= 3).map(([p, ms]) => [p, ms.size])),
    0.35,
  );
  // First round: the earlier the pick, the more obvious. A #1 overall pick is the most obvious answer.
  const firsts = new Map<string, number>();
  for (const s of raw.seasons) for (const d of s.draft.filter((x) => x.round === 1)) firsts.set(d.pid, Math.max(firsts.get(d.pid) ?? 0, 13 - d.no));
  add("First round", "Name a player taken in the first round of any Trash draft.", firsts, 0.65);
  return out;
}
