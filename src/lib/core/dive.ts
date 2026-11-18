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
 * Answers are ranked by that mix: the most obvious scores 1, the deepest cut 100 (a miss scores 0).
 */
export type Prompt = {
  kind: string;
  prompt: string;
  /** [pid, niche score 0-100] for every valid answer, deepest first */
  answers: [string, number][];
  /** The manager the prompt is about, so a day doesn't ask about the same one twice. */
  who?: string;
  /** 2: added with the no-repeat schedule (2026-11-16). 3: added 2026-11-18 (waivers, NBA teams); only
   * the schedule from RESTART uses them, so earlier days keep their prompts. */
  v?: 2 | 3;
  /** The question's shape ("roster", "traded-for"...), so a day never asks the same kind of thing twice. */
  t?: string;
};

type Raw = {
  seasons: {
    code: string;
    status: string;
    draft: { no: number; pid: string; by: string; round: number }[];
    trades: { sides: Record<string, string[]> }[];
    /** Week -> manager -> roster; week "0" is the draft. */
    rosters?: Record<string, Record<string, string[]>>;
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
    // Rank from most obvious (1) to deepest (100). Ties break by league fame, then id, so every
    // prompt has exactly one 100-point answer and one 0.
    const order = [...obvious].sort(([pa, a], [pb, b]) => b - a || (fame.get(pb) ?? 0) - (fame.get(pa) ?? 0) || (pa < pb ? -1 : pa > pb ? 1 : 0));
    const n = order.length;
    return order
      // A right answer always scores something: the most obvious one is 1, never 0 (0 means a miss).
      .map(([p], i) => [p, i === n - 1 ? 100 : Math.max(1, Math.min(99, Math.round((100 * i) / Math.max(1, n - 1))))] as [string, number])
      .sort((a, b) => b[1] - a[1]);
  }


  const fame = leagueFame();
  const years = Object.fromEntries(league.seasons.map((s) => [s.code, s.years]));
  const active = league.seasons.find((s) => s.code === lastCode(d))!.standings.map((r) => r.manager);
  const out: Prompt[] = [];
  const add = (kind: string, prompt: string, signal: Map<string, number>, weight: number, extra: Pick<Prompt, "who" | "v" | "t"> = {}) => {
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
    add("Starters", `Name a player ${nick(m)} has started.`, starts, 0.55, { who: m, t: "started" });
    add("Draft night", `Name a player ${nick(m)} has drafted.`, picks, 0.6, { who: m, t: "mgr-drafted" });
    for (const s of raw.seasons.filter((x) => x.status === "complete")) {
      const wk = new Map(Object.entries(s.guys[m] ?? {}).map(([pid, [w]]) => [pid, w] as [string, number]));
      add("Locker room", `Name a player who was on ${nick(m)}'s roster in ${years[s.code]}.`, wk, 0.55, { who: m, t: "roster" });
    }
    // This season so far (v3: only the schedule from the restart uses it). Answers grow as the season goes.
    for (const s of raw.seasons.filter((x) => x.status !== "complete")) {
      const wk = new Map(Object.entries(s.guys[m] ?? {}).map(([pid, [w]]) => [pid, w] as [string, number]));
      add("Locker room", `Name a player who has been on ${nick(m)}'s roster this season (${years[s.code]}).`, wk, 0.55, { v: 3, who: m, t: "roster-now" });
    }
  }
  for (const s of raw.seasons) {
    // Traded that season: obvious = how much he produced in the league that season.
    const prodSeason = new Map<string, number>();
    for (const ps of Object.values(s.guys)) for (const [pid, [, , pts]] of Object.entries(ps)) sum(prodSeason, pid, pts);
    const traded = new Map<string, number>();
    for (const t of s.trades)
      for (const p of Object.values(t.sides).flat()) if (!p.startsWith("pick:")) traded.set(p, prodSeason.get(p) ?? 0);
    add("Trade log", `Name a player who was traded in ${years[s.code]}.`, traded, 0.5, { t: "season-traded" });
    if (s.playoffs.length) {
      const ps = new Map<string, number>();
      for (const g of s.playoffs) for (const [p, pts] of g.starters) sum(ps, p, 1 + pts / 100);
      add("Playoffs", `Name a player who started a playoff game in ${years[s.code]}.`, ps, 0.5, { t: "playoffs" });
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
    { t: "journey" },
  );
  // First round: the earlier the pick, the more obvious. A #1 overall pick is the most obvious answer.
  const firsts = new Map<string, number>();
  for (const s of raw.seasons) for (const d of s.draft.filter((x) => x.round === 1)) firsts.set(d.pid, Math.max(firsts.get(d.pid) ?? 0, 13 - d.no));
  add("First round", `Name a player taken in the first round of any ${d.name} draft.`, firsts, 0.65, { t: "first" });

  // More prompts (v2): champions' rosters, each manager's trades, each season's draft, late rounds.
  const v2 = { v: 2 } as const;
  for (const s of raw.seasons) {
    const champ = league.seasons.find((x) => x.code === s.code)?.champion;
    if (champ) {
      const wk = new Map(Object.entries(s.guys[champ] ?? {}).map(([pid, [w]]) => [pid, w] as [string, number]));
      add("Champions", `Name a player on ${nick(champ)}'s ${years[s.code]} title team.`, wk, 0.55, { ...v2, who: champ, t: "champs" });
    }
    const picks = new Map(s.draft.map((x) => [x.pid, 200 - x.no] as [string, number]));
    add("Draft night", `Name a player drafted in the ${years[s.code]} ${d.name} draft.`, picks, 0.6, { ...v2, t: "season-draft" });
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
    add("Trade log", `Name a player ${nick(m)} has traded for.`, got, 0.5, { ...v2, who: m, t: "traded-for" });
    add("Trade log", `Name a player ${nick(m)} has traded away.`, gave, 0.5, { ...v2, who: m, t: "traded-away" });
  }
  const late = new Map<string, number>();
  for (const s of raw.seasons) for (const x of s.draft.filter((y) => y.round >= 8)) late.set(x.pid, Math.max(late.get(x.pid) ?? 0, s.guys[x.by]?.[x.pid]?.[2] ?? 0));
  add("Late rounds", `Name a player taken in round 8 or later of any ${d.name} draft.`, late, 0.5, { ...v2, t: "late" });

  // More prompts (v3, from the restart): waiver pickups and NBA teams.
  const v3 = { v: 3 } as const;
  // A pickup: on a team's roster in some week without being drafted by it or traded to it that season.
  const pickedBy = new Map<string, Map<string, number>>(); // manager -> player -> weeks kept
  for (const s of raw.seasons) {
    if (!s.rosters) continue;
    const drafted = new Set(s.draft.map((x) => `${x.by}|${x.pid}`));
    const traded = new Set(s.trades.flatMap((t) => Object.entries(t.sides).flatMap(([m, ps]) => ps.map((p) => `${m}|${p}`))));
    const season = new Map<string, number>(); // player -> points for the team that picked him up
    for (const [w, teams] of Object.entries(s.rosters)) {
      if (w === "0") continue;
      for (const [m, ps] of Object.entries(teams))
        for (const p of ps) {
          if (drafted.has(`${m}|${p}`) || traded.has(`${m}|${p}`) || p.startsWith("pick:")) continue;
          const mine = pickedBy.get(m) ?? pickedBy.set(m, new Map()).get(m)!;
          if (!mine.has(`${s.code}|${p}`)) mine.set(`${s.code}|${p}`, s.guys[m]?.[p]?.[0] ?? 1);
          season.set(p, Math.max(season.get(p) ?? 0, s.guys[m]?.[p]?.[2] ?? 0));
        }
    }
    add("Waiver wire", `Name a player picked up off waivers in ${years[s.code]}.`, season, 0.5, { ...v3, t: "waivers-season" });
  }
  // Cut list: players a manager let go (on his roster one week, gone the next, not traded away). Works from
  // the first weeks of a brand-new league. Obvious = held longer before the cut.
  const dropped = new Map<string, Map<string, number>>();
  for (const s of raw.seasons) {
    if (!s.rosters) continue;
    const gave = new Set(
      s.trades.flatMap((t) => Object.keys(t.sides).flatMap((m) => Object.entries(t.sides).filter(([k]) => k !== m).flatMap(([, ps]) => ps.map((p) => `${m}|${p}`)))),
    );
    const weeks = Object.keys(s.rosters).map(Number).sort((a, b) => a - b);
    for (let k = 0; k + 1 < weeks.length; k++) {
      const now = s.rosters[String(weeks[k])];
      const next = s.rosters[String(weeks[k + 1])];
      for (const [m, ps] of Object.entries(now)) {
        const after = new Set(next[m] ?? []);
        if (!next[m]) continue;
        for (const p of ps) {
          if (after.has(p) || gave.has(`${m}|${p}`) || p.startsWith("pick:")) continue;
          const mine = dropped.get(m) ?? dropped.set(m, new Map()).get(m)!;
          mine.set(p, (mine.get(p) ?? 0) + (s.guys[m]?.[p]?.[0] ?? 1));
        }
      }
    }
  }
  for (const m of active) add("Cut list", `Name a player ${nick(m)} has dropped.`, dropped.get(m) ?? new Map(), 0.55, { ...v3, who: m, t: "mgr-dropped" });

  for (const m of active) {
    const kept = new Map<string, number>();
    for (const [k, w] of pickedBy.get(m) ?? []) sum(kept, k.split("|")[1], w);
    add("Waiver wire", `Name a player ${nick(m)} has picked up off waivers.`, kept, 0.55, { ...v3, who: m, t: "waivers-mgr" });
  }
  // League-wide, open-ended questions (no manager): the cutoff adapts to the league's history, the highest one
  // that still leaves at least 10 answers, so brand-new leagues get them too.
  const cutoff = (vals: Map<string, number>, steps: number[]) => steps.find((t) => [...vals.values()].filter((v) => v >= t).length >= 10);
  const above = (vals: Map<string, number>, t: number) => new Map([...vals].filter(([, v]) => v >= t));
  const fmt = (n: number) => n.toLocaleString("en-US");
  {
    const starts = new Map<string, number>();
    const pts = new Map<string, number>();
    const avg = new Map<string, number>();
    for (const s of raw.seasons)
      for (const ps of Object.values(s.guys))
        for (const [pid, [, st, p]] of Object.entries(ps)) {
          sum(starts, pid, st);
          sum(pts, pid, p);
          if (st >= 3) avg.set(pid, Math.max(avg.get(pid) ?? 0, p / st));
        }
    const st = cutoff(starts, [50, 40, 30, 25, 20, 15, 10, 6, 4, 3, 2]);
    if (st) add("Workhorses", `Name a player who has been started ${st}+ times in ${d.name}.`, above(starts, st), 0.5, { ...v3, t: "legend-starts" });
    const pt = cutoff(pts, [3000, 2500, 2000, 1500, 1000, 750, 500, 300, 200, 100]);
    if (pt) add("Franchise scorers", `Name a player who has scored ${fmt(pt)}+ points for ${d.name} teams.`, above(pts, pt), 0.5, { ...v3, t: "legend-points" });
    const av = cutoff(avg, [80, 70, 65, 60, 55, 50, 45, 40, 30, 20, 15]);
    if (av) add("Big numbers", `Name a player who averaged ${av}+ per start for a ${d.name} team in a season.`, above(avg, av), 0.5, { ...v3, t: "legend-avg" });
  }
  {
    // Draft busts: drafted, then never started by the team that drafted him that season. Obvious = picked earlier.
    const busts = new Map<string, number>();
    for (const s of raw.seasons) {
      if (s.status !== "complete" && s.status !== "in_season") continue;
      for (const x of s.draft) if ((s.guys[x.by]?.[x.pid]?.[1] ?? 0) === 0) busts.set(x.pid, Math.max(busts.get(x.pid) ?? 0, 200 - x.no));
    }
    add("Draft busts", `Name a player who was drafted in ${d.name} but never started for the team that drafted him.`, busts, 0.5, { ...v3, t: "busts" });
  }
  {
    // Waiver gems: picked up off waivers, then started a lot by the team that grabbed him.
    const gems = new Map<string, number>();
    for (const s of raw.seasons)
      for (const [m, kept] of pickedBy)
        for (const k of kept.keys()) {
          const [code, p] = k.split("|");
          if (code !== s.code) continue;
          gems.set(p, Math.max(gems.get(p) ?? 0, s.guys[m]?.[p]?.[1] ?? 0));
        }
    const gt = cutoff(gems, [15, 12, 10, 8, 6, 4, 3, 2]);
    if (gt) add("Waiver gems", `Name a waiver pickup who was started ${gt}+ times by the team that grabbed him.`, above(gems, gt), 0.5, { ...v3, t: "waiver-gems" });
  }

  // NBA teams: players on that team now who have been on a league roster (basketball leagues).
  if (d.sport !== "nfl") {
    const weeksIn = new Map<string, number>();
    for (const s of raw.seasons) for (const ps of Object.values(s.guys)) for (const [pid, [w]] of Object.entries(ps)) sum(weeksIn, pid, w);
    const byTeam = new Map<string, Map<string, number>>();
    for (const [pid, w] of weeksIn) {
      const team = players[pid]?.[2];
      if (team && NBA_TEAMS[team]) (byTeam.get(team) ?? byTeam.set(team, new Map()).get(team)!).set(pid, w);
    }
    for (const [team, ps] of [...byTeam].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      add("NBA teams", `Name a ${NBA_TEAMS[team]} player who has been on a ${d.name} roster.`, ps, 0.4, { ...v3, t: "nba-team" });
  }
  return out;
}

const ROUNDS = 5;

/** NBA team names by Sleeper's abbreviation (players' current team). */
const NBA_TEAMS: Record<string, string> = {
  ATL: "Hawks", BOS: "Celtics", BKN: "Nets", CHA: "Hornets", CHI: "Bulls", CLE: "Cavaliers", DAL: "Mavericks", DEN: "Nuggets",
  DET: "Pistons", GSW: "Warriors", HOU: "Rockets", IND: "Pacers", LAC: "Clippers", LAL: "Lakers", MEM: "Grizzlies", MIA: "Heat",
  MIL: "Bucks", MIN: "Timberwolves", NOP: "Pelicans", NYK: "Knicks", OKC: "Thunder", ORL: "Magic", PHI: "76ers", PHX: "Suns",
  POR: "Trail Blazers", SAC: "Kings", SAS: "Spurs", TOR: "Raptors", UTA: "Jazz", WAS: "Wizards",
};
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
/**
 * From this day the schedule restarts from scratch, without the original pick's history. That pick
 * shuffled with a random-comparison sort, which JavaScript engines don't agree on, so Chrome, Safari
 * and Node could plan different prompts for the same day. Every step from here is engine-independent.
 */
export const RESTART = "2026-11-18";
const nextDay = (day: string) => new Date(Date.parse(`${day}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/**
 * Today's five prompts, identical for everyone on the same day. From SCHEDULE_FROM on, days are
 * planned in order: a prompt doesn't come back within about two weeks (less for small pools), the
 * day's kinds differ where possible and kinds from yesterday wait a day, and no manager is asked
 * about twice. When fresh prompts run short, a kind is used twice before an old prompt returns,
 * and the longest-rested prompt comes back first.
 */
export function dailyPrompts(all: Prompt[], day: string, calendar: Calendar = {}) {
  if (day >= RESTART) return planned(all, day, calendar);
  // Days before the restart keep exactly the prompts they had (nothing added since).
  const pool = all.filter((q) => q.v !== 3);
  if (day < SCHEDULE_FROM) return legacy(pool, day);
  const restart = false;
  const from = restart ? RESTART : SCHEDULE_FROM;
  const cooldown = Math.max(1, Math.min(14, Math.floor(pool.length / ROUNDS) - 1));
  const lastUsed = new Map<string, number>();
  const kinds = [...new Set(pool.map((q) => q.kind))].sort();
  let picks: Prompt[] = [];
  let yesterday = new Set<string>();
  // Days before the schedule (including the set it replaced on its first day) count as used.
  const before = restart ? [] : LEGACY_DAYS.map((d) => legacy(pool, d));
  before.forEach((qs, i) => qs.forEach((q) => lastUsed.set(q.prompt, i - before.length)));
  if (before.length) yesterday = new Set(before[before.length - 1].map((q) => q.kind));
  let n = 0;
  for (let d = from; d <= day; d = nextDay(d), n++) {
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

/**
 * How a prompt reads in this league. Prompts are stored (and scheduled) with "started"; lock-in
 * leagues say "locked in" and daily-lineup leagues "in the lineup" (see lineup-terms.ts). Football
 * keeps "started". Display only: the stored text, and so the daily schedule, never changes.
 */
export function promptText(prompt: string, lineup: "lock-in" | "daily" | "weekly" | null | undefined) {
  if (lineup === "weekly") return prompt;
  const lock = lineup !== "daily";
  return prompt
    .replace(/has been started (\d+)\+ times/, (_, n: string) => (lock ? `has been locked in ${n}+ times` : `has been in a lineup ${n}+ weeks`))
    .replace(/per start for/, lock ? "per lock-in for" : "per week in the lineup for")
    .replace(/but never started for the team/, lock ? "but was never locked in by the team" : "but never made the lineup for the team")
    .replace(/was started (\d+)\+ times by/, (_, n: string) => (lock ? `was locked in ${n}+ times by` : `was in the lineup ${n}+ weeks for`))
    .replace(/^Name a player (.+) has started\.$/, (_, who: string) => (lock ? `Name a player ${who} has locked in.` : `Name a player ${who} has had in the lineup.`))
    .replace(/^Name a player who started a playoff game in (.+)\.$/, (_, yrs: string) =>
      lock ? `Name a player who was locked in for a playoff game in ${yrs}.` : `Name a player who was in a playoff lineup in ${yrs}.`,
    );
}

/** The prompt's category label in this league ("Starters" reads "Lock-ins" in lock-in leagues). */
export const kindText = (kind: string, lineup: "lock-in" | "daily" | "weekly" | null | undefined) =>
  kind === "Starters" ? (lineup === "weekly" ? "Starters" : lineup === "daily" ? "Lineups" : "Lock-ins") : kind;

/**
 * The schedule from RESTART on, built for variety. Each prompt has a shape ("roster", "traded-for",
 * "playoffs"...). A day never repeats a shape, never reuses yesterday's shapes when others are left,
 * and takes the longest-rested shapes first; within a shape, the prompt asked longest ago (or never)
 * goes first, and managers asked about yesterday wait a day. Engine-independent: seeded numbers only.
 */
/** Days the owner hand-picked. Used only when every prompt exists in the league's pool (so Trash only);
 * the schedule plans the following days around them. */
const PINNED: Record<string, string[]> = {
  "2026-11-18": [
    "Name a player who has been on at least three different Trash rosters.",
    "Name a player picked up off waivers in 2025–26.",
    "Name a player taken in round 8 or later of any Trash draft.",
    "Name a Knicks player who has been on a Trash roster.",
    "Name a player Rico has traded for.",
  ],
  // Owner's picks (2026-11-18): question types Rafterlore hadn't asked yet, and an NBA team.
  "2026-11-19": [
    "Name a Warriors player who has been on a Trash roster.",
    "Name a player Rico has dropped.",
    "Name a player who averaged 80+ per start for a Trash team in a season.",
    "Name a player who was drafted in Trash but never started for the team that drafted him.",
    "Name a player who has been started 50+ times in Trash.",
  ],
};

/** Hand-picked days (tests check every one can be found in Trash's pool). */
export const PINNED_DAYS: Readonly<Record<string, readonly string[]>> = PINNED;

/** A written calendar: day -> that day's prompt texts. Days in it never change (see extendCalendar). */
export type Calendar = Record<string, string[]>;

function planned(pool: Prompt[], day: string, fixed: Calendar = {}): Prompt[] {
  return schedule(pool, day, fixed).get(day) ?? [];
}

/**
 * Every day from RESTART through `until`. Days in `fixed` (the written calendar) and PINNED days use
 * their own prompts (whichever still exist; any gap is filled by the rules); the rest are planned around them.
 */
function schedule(pool: Prompt[], until: string, fixed: Calendar = {}): Map<string, Prompt[]> {
  const out = new Map<string, Prompt[]>();
  const shape = (q: Prompt) => q.t ?? q.kind;
  const shapes = [...new Set(pool.map(shape))].sort();
  // Each shape belongs to one category (the label players see, e.g. "Waiver wire"); a day never repeats one.
  const kindOf = new Map(pool.map((q) => [shape(q), q.kind]));
  // The exact same question waits at least 10 days (less if the pool is small).
  const cool = Math.max(1, Math.min(10, Math.floor(pool.length / ROUNDS) - 2));
  const lastShape = new Map<string, number>();
  const lastPrompt = new Map<string, number>();
  const lastWho = new Map<string, number>();
  let n = 0;
  for (let d = RESTART; d <= until; d = nextDay(d), n++) {
    const r = rng(Number(d.replaceAll("-", "")) + 7);
    const chosen: Prompt[] = [];
    const who = new Set<string>();
    const used = new Set<string>();
    const kinds = new Set<string>();
    const set = fixed[d] ?? PINNED[d];
    const pin = set?.map((t) => pool.find((q) => q.prompt === t)).filter((q): q is Prompt => !!q);
    // A written day keeps whatever of its prompts still exist; a pinned day needs all of them (Trash only).
    if (pin && (fixed[d] ? pin.length : pin.length === set!.length))
      for (const q of pin.slice(0, ROUNDS)) {
        chosen.push(q);
        used.add(shape(q));
        kinds.add(q.kind);
        if (q.who) who.add(q.who);
      }
    for (let slot = chosen.length; slot < ROUNDS; slot++) {
      const ranked = shapes
        .filter((t) => !used.has(t) && !kinds.has(kindOf.get(t)!))
        .map((t) => {
          const all = pool.filter((q) => shape(q) === t && !chosen.includes(q) && !(q.who && who.has(q.who)));
          const fresh = all.filter((q) => n - (lastPrompt.get(q.prompt) ?? -1000) > cool);
          const rest = Math.min(30, n - (lastShape.get(t) ?? -30));
          // Empty shapes last; shapes with only recently asked questions next to last; yesterday's
          // shapes after the rest; then longest rested; random among equals.
          const key = (all.length ? 0 : 1000) + (fresh.length ? 0 : 500) + (rest <= 1 ? 100 : 0) - rest + r() * 0.9;
          return { of: fresh.length ? fresh : all, key };
        })
        .sort((a, b) => a.key - b.key);
      const of = ranked[0]?.of ?? [];
      if (!of.length) break;
      const scored = of.map((q) => {
        const since = lastPrompt.has(q.prompt) ? n - lastPrompt.get(q.prompt)! : 1000;
        const fresh = q.who && lastWho.get(q.who) === n - 1 ? -60 : 0;
        return { q, s: since + fresh + r() * 0.9 };
      });
      const q = scored.reduce((a, b) => (b.s > a.s ? b : a)).q;
      chosen.push(q);
      used.add(shape(q));
      kinds.add(q.kind);
      if (q.who) who.add(q.who);
    }
    for (const q of chosen) {
      lastShape.set(shape(q), n);
      lastPrompt.set(q.prompt, n);
      if (q.who) lastWho.set(q.who, n);
    }
    out.set(d, chosen);
  }
  return out;
}

const addDays = (day: string, k: number) => new Date(Date.parse(`${day}T12:00:00Z`) + k * 86_400_000).toISOString().slice(0, 10);

/**
 * Write the calendar ahead: days up to and including `today` that are already written stay exactly as
 * they are; any other day from RESTART to `ahead` days out is (re)planned around them. Run it whenever
 * the league's data is rebuilt, so new data can only change days nobody has played yet.
 */
/**
 * Moving a league's calendar to new names (e.g. "Trash Season 4" -> "Trash", usernames -> nicknames)
 * without changing what anyone was asked: every day up to `today` becomes exactly what `oldPool`
 * showed that day, written with `newPool`'s wording. The pools must come from the same data, so
 * they list the same questions in the same order.
 */
export function renameCalendar(oldPool: Prompt[], newPool: Prompt[], cal: Calendar, today: string): Calendar {
  if (oldPool.length !== newPool.length) return {};
  const to = new Map(oldPool.map((q, i) => [q.prompt, newPool[i].prompt]));
  const out: Calendar = {};
  for (const d of Object.keys(cal).sort()) {
    if (d > today) continue;
    const shown = d >= RESTART ? planned(oldPool, d, cal).map((q) => q.prompt) : cal[d];
    out[d] = shown.map((t) => to.get(t) ?? t);
  }
  return out;
}

export function extendCalendar(pool: Prompt[], cal: Calendar, today: string, ahead = 30): Calendar {
  const keep: Calendar = Object.fromEntries(Object.entries(cal).filter(([d]) => d <= today));
  const plan = schedule(pool, addDays(today < RESTART ? RESTART : today, ahead), keep);
  const out: Calendar = { ...keep };
  for (const [d, qs] of plan) if (!(d in keep)) out[d] = qs.map((q) => q.prompt);
  return out;
}
