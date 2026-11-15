import { lastCode } from "@/lib/core/extras";
import type { Dataset } from "@/lib/core/types";

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
  /** The manager the prompt is about, so a day doesn't ask about the same one twice. */
  who?: string;
  /** Added with the no-repeat schedule (2026-11-16); older days are picked without these. */
  v?: 2;
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

export function divePool(d: Dataset): Prompt[] {
  const raw = d.extras as unknown as Raw;
  const league = d.league;
  const players = d.extras.players;
  const nick = (id: string) => league.managers.find((m) => m.id === id)?.nick ?? id;
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
    // Rank from most obvious (0) to deepest (100). Ties break by league fame, then id, so every
    // prompt has exactly one 100-point answer and one 0.
    const order = [...obvious].sort(([pa, a], [pb, b]) => b - a || (fame.get(pb) ?? 0) - (fame.get(pa) ?? 0) || (pa < pb ? -1 : pa > pb ? 1 : 0));
    const n = order.length;
    return order
      .map(([p], i) => [p, i === n - 1 ? 100 : Math.min(99, Math.round((100 * i) / Math.max(1, n - 1)))] as [string, number])
      .sort((a, b) => b[1] - a[1]);
  }


  const fame = leagueFame();
  const years = Object.fromEntries(league.seasons.map((s) => [s.code, s.years]));
  const active = league.seasons.find((s) => s.code === lastCode(d))!.standings.map((r) => r.manager);
  const out: Prompt[] = [];
  const add = (kind: string, prompt: string, signal: Map<string, number>, weight: number, extra: Pick<Prompt, "who" | "v"> = {}) => {
    const answers = score(signal, fame, weight);
    if (answers.length >= 8) out.push({ kind, prompt, answers, ...extra });
  };
  const sum = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);

  for (const m of active) {
    const starts = new Map<string, number>();
    const picks = new Map<string, number>();
    for (const s of raw.seasons) {
      for (const [pid, [, st]] of Object.entries(s.guys[m] ?? {})) if (st > 0) sum(starts, pid, st);
      for (const d of s.draft.filter((x) => x.by === m)) picks.set(d.pid, Math.max(picks.get(d.pid) ?? 0, 200 - d.no));
    }
    add("Starters", `Name a player ${nick(m)} has started.`, starts, 0.55, { who: m });
    add("Draft night", `Name a player ${nick(m)} has drafted.`, picks, 0.6, { who: m });
    for (const s of raw.seasons.filter((x) => x.status === "complete")) {
      const wk = new Map(Object.entries(s.guys[m] ?? {}).map(([pid, [w]]) => [pid, w] as [string, number]));
      add("Locker room", `Name a player who was on ${nick(m)}'s roster in ${years[s.code]}.`, wk, 0.55, { who: m });
    }
  }
  for (const s of raw.seasons) {
    // Traded that season: obvious = how much he produced in the league that season.
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
  // Journeymen: more league teams is the obvious end of this one.
  const teams = new Map<string, Set<string>>();
  for (const s of raw.seasons)
    for (const [m, ps] of Object.entries(s.guys))
      for (const p of Object.keys(ps)) (teams.get(p) ?? teams.set(p, new Set()).get(p)!).add(m);
  add(
    "Journeymen",
    `Name a player who has been on at least three different ${d.name} rosters.`,
    new Map([...teams].filter(([, ms]) => ms.size >= 3).map(([p, ms]) => [p, ms.size])),
    0.35,
  );
  // First round: the earlier the pick, the more obvious. A #1 overall pick is the most obvious answer.
  const firsts = new Map<string, number>();
  for (const s of raw.seasons) for (const d of s.draft.filter((x) => x.round === 1)) firsts.set(d.pid, Math.max(firsts.get(d.pid) ?? 0, 13 - d.no));
  add("First round", `Name a player taken in the first round of any ${d.name} draft.`, firsts, 0.65);

  // More prompts (v2): champions' rosters, each manager's trades, each season's draft, late rounds.
  const v2 = { v: 2 } as const;
  for (const s of raw.seasons) {
    const champ = league.seasons.find((x) => x.code === s.code)?.champion;
    if (champ) {
      const wk = new Map(Object.entries(s.guys[champ] ?? {}).map(([pid, [w]]) => [pid, w] as [string, number]));
      add("Champions", `Name a player on ${nick(champ)}'s ${years[s.code]} title team.`, wk, 0.55, { ...v2, who: champ });
    }
    const picks = new Map(s.draft.map((x) => [x.pid, 200 - x.no] as [string, number]));
    add("Draft night", `Name a player drafted in the ${years[s.code]} ${d.name} draft.`, picks, 0.6, v2);
  }
  for (const m of active) {
    const got = new Map<string, number>();
    const gave = new Map<string, number>();
    for (const s of raw.seasons)
      for (const t of s.trades) {
        if (!t.sides[m]) continue;
        for (const p of t.sides[m]) if (!p.startsWith("pick:")) sum(got, p, 1 + (s.guys[m]?.[p]?.[2] ?? 0) / 100);
        for (const [k, ps] of Object.entries(t.sides))
          if (k !== m) for (const p of ps) if (!p.startsWith("pick:")) sum(gave, p, 1 + (s.guys[k]?.[p]?.[2] ?? 0) / 100);
      }
    add("Trade log", `Name a player ${nick(m)} has traded for.`, got, 0.5, { ...v2, who: m });
    add("Trade log", `Name a player ${nick(m)} has traded away.`, gave, 0.5, { ...v2, who: m });
  }
  const late = new Map<string, number>();
  for (const s of raw.seasons) for (const x of s.draft.filter((y) => y.round >= 8)) late.set(x.pid, Math.max(late.get(x.pid) ?? 0, s.guys[x.by]?.[x.pid]?.[2] ?? 0));
  add("Late rounds", `Name a player taken in round 8 or later of any ${d.name} draft.`, late, 0.5, v2);
  return out;
}

const ROUNDS = 5;
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

/** The original daily pick (one per kind, days picked independently). Kept for days before the
 * schedule below, so dives already played keep their prompts and scores. */
function legacy(pool: Prompt[], day: string) {
  const old = pool.filter((q) => !q.v);
  const r = rng(Number(day.replaceAll("-", "")));
  const kinds = [...new Set(old.map((q) => q.kind))].sort().sort(() => r() - 0.5);
  return kinds.slice(0, ROUNDS).map((k) => {
    const of = old.filter((q) => q.kind === k);
    return of[Math.floor(r() * of.length)];
  });
}

/** First day of the no-repeat schedule (it replaced that day's original set, which was reset). */
const SCHEDULE_FROM = "2026-11-15";
/** Days that used the original pick: launch day and the replaced first day. */
const LEGACY_DAYS = ["2026-11-14", "2026-11-15"];
const nextDay = (day: string) => new Date(Date.parse(`${day}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/**
 * Today's five prompts, identical for everyone on the same day. From SCHEDULE_FROM on, days are
 * planned in order: a prompt doesn't come back within about two weeks (less for small pools), the
 * day's kinds differ where possible and kinds from yesterday wait a day, and no manager is asked
 * about twice. When fresh prompts run short, a kind is used twice before an old prompt returns,
 * and the longest-rested prompt comes back first.
 */
export function dailyPrompts(pool: Prompt[], day: string) {
  if (day < SCHEDULE_FROM) return legacy(pool, day);
  const cooldown = Math.max(1, Math.min(14, Math.floor(pool.length / ROUNDS) - 1));
  const lastUsed = new Map<string, number>();
  const kinds = [...new Set(pool.map((q) => q.kind))].sort();
  let picks: Prompt[] = [];
  let yesterday = new Set<string>();
  // Days before the schedule (including the set it replaced on its first day) count as used.
  const before = LEGACY_DAYS.map((d) => legacy(pool, d));
  before.forEach((qs, i) => qs.forEach((q) => lastUsed.set(q.prompt, i - before.length)));
  if (before.length) yesterday = new Set(before[before.length - 1].map((q) => q.kind));
  let n = 0;
  for (let d = SCHEDULE_FROM; d <= day; d = nextDay(d), n++) {
    const r = rng(Number(d.replaceAll("-", "")));
    const fresh = (q: Prompt) => n - (lastUsed.get(q.prompt) ?? -Infinity) > cooldown;
    const chosen: Prompt[] = [];
    const who = new Set<string>();
    const usable = (q: Prompt) => !chosen.includes(q) && !(q.who && who.has(q.who));
    for (let slot = 0; slot < ROUNDS; slot++) {
      const ranked = kinds
        .map((k) => {
          const of = pool.filter((q) => q.kind === k && usable(q));
          const today = chosen.some((q) => q.kind === k);
          const key = (of.length ? 0 : 64) + (of.some(fresh) ? 0 : 16) + (today ? 8 : 0) + (yesterday.has(k) ? 2 : 0) + r();
          return { of, key };
        })
        .sort((a, b) => a.key - b.key);
      // A brand-new league can have no prompts at all yet.
      const of = ranked[0]?.of ?? [];
      if (!of.length) break;
      const ok = of.filter(fresh);
      const q = ok.length
        ? ok[Math.floor(r() * ok.length)]
        : [...of].sort((a, b) => (lastUsed.get(a.prompt) ?? -1) - (lastUsed.get(b.prompt) ?? -1))[0];
      chosen.push(q);
      if (q.who) who.add(q.who);
    }
    for (const q of chosen) lastUsed.set(q.prompt, n);
    picks = chosen;
    yesterday = new Set(chosen.map((q) => q.kind));
  }
  return picks;
}
