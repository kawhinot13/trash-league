import data from "@/data/extras.json";
import { league } from "@/lib/league";

/** Built by scripts/build-extras.py from Sleeper. See that file for the scoring model. */
type RawSeason = {
  code: string;
  season: string;
  weeks: number;
  status: string;
  draft: {
    no: number;
    round: number;
    pid: string;
    by: string;
    value: number;
    gp: number;
  }[];
  rosters: Record<string, Record<string, string[]>>;
  trades: { week: number; sides: Record<string, string[]> }[];
  adds: Record<string, number>;
  /** [week, actual, optimal] */
  lineups: Record<string, [number, number, number][]>;
};
/** pid -> [name, positions, team, has headshot] */
export type Players = Record<string, [string, string[], string, number]>;
const raw = data as unknown as {
  asOf: string;
  seasons: RawSeason[];
  players: Players;
};
export const players = raw.players;
export const asOf = raw.asOf;

const years: Record<string, string> = Object.fromEntries(
  league.seasons.map((s) => [s.code, s.years]),
);

/* ── Lock-in index ─────────────────────────────────────────── */
export type LockSeason = {
  code: string;
  act: number;
  opt: number;
  eff: number;
  weeks: number;
};
export type LockRow = {
  id: string;
  act: number;
  opt: number;
  eff: number;
  weeks: number;
  left: number;
  perfect: number;
  seasons: LockSeason[];
  worst: { code: string; week: number; act: number; opt: number };
  best: { code: string; week: number; act: number; opt: number };
};
export type BenchCrime = {
  id: string;
  code: string;
  years: string;
  week: number;
  act: number;
  opt: number;
};

export function lockIn() {
  const rows = new Map<string, LockRow>();
  const crimes: BenchCrime[] = [];
  const bySeason: { code: string; years: string; eff: number; live: boolean }[] = [];
  for (const s of raw.seasons) {
    let sa = 0;
    let so = 0;
    for (const [id, weeks] of Object.entries(s.lineups)) {
      const r =
        rows.get(id) ??
        ({
          id,
          act: 0,
          opt: 0,
          eff: 0,
          weeks: 0,
          left: 0,
          perfect: 0,
          seasons: [],
          worst: { code: s.code, week: 0, act: 0, opt: 0 },
          best: { code: s.code, week: 0, act: 1, opt: 999 },
        } as LockRow);
      let a = 0;
      let o = 0;
      for (const [week, act, opt] of weeks) {
        a += act;
        o += opt;
        if (opt - act > r.worst.opt - r.worst.act)
          r.worst = { code: s.code, week, act, opt };
        if (act / opt > r.best.act / r.best.opt)
          r.best = { code: s.code, week, act, opt };
        if (act / opt >= 0.97) r.perfect += 1;
        crimes.push({ id, code: s.code, years: years[s.code], week, act, opt });
      }
      r.act += a;
      r.opt += o;
      r.weeks += weeks.length;
      r.seasons.push({ code: s.code, act: a, opt: o, eff: a / o, weeks: weeks.length });
      rows.set(id, r);
      sa += a;
      so += o;
    }
    bySeason.push({
      code: s.code,
      years: years[s.code],
      eff: sa / so,
      live: s.status !== "complete",
    });
  }
  const out = [...rows.values()].map((r) => ({
    ...r,
    eff: r.act / r.opt,
    left: (r.opt - r.act) / r.weeks,
  }));
  out.sort((a, b) => b.eff - a.eff);
  crimes.sort((a, b) => b.opt - b.act - (a.opt - a.act));
  return { rows: out, crimes: crimes.slice(0, 10), bySeason };
}

/* ── Draft re-do ───────────────────────────────────────────── */
export type RedoPick = {
  slot: number;
  by: string;
  took: { pid: string; value: number; gp: number; redo: number };
  should: { pid: string; value: number; gp: number; no: number; by: string };
};
export type Redraft = {
  code: string;
  years: string;
  live: boolean;
  weeks: number;
  picks: RedoPick[];
  steal: { pid: string; no: number; by: string; redo: number; value: number };
  bust: { pid: string; no: number; by: string; redo: number; value: number };
};

export function redrafts(): Redraft[] {
  return raw.seasons.map((s) => {
    const pool = [...s.draft].sort((a, b) => b.value - a.value || a.no - b.no);
    const rank = new Map(pool.map((p, i) => [p.pid, i + 1]));
    const first = s.draft.filter((p) => p.round === 1);
    const picks: RedoPick[] = first.map((p, i) => ({
      slot: p.no,
      by: p.by,
      took: { pid: p.pid, value: p.value, gp: p.gp, redo: rank.get(p.pid)! },
      should: { ...pool[i], no: pool[i].no, by: pool[i].by },
    }));
    const withRank = s.draft.map((p) => ({ ...p, redo: rank.get(p.pid)! }));
    const steal = [...withRank].sort(
      (a, b) => b.no - b.redo - (a.no - a.redo),
    )[0];
    const bust = [...withRank]
      .filter((p) => p.round === 1)
      .sort((a, b) => b.redo - b.no - (a.redo - a.no))[0];
    return {
      code: s.code,
      years: years[s.code],
      live: s.status !== "complete",
      weeks: s.weeks,
      picks,
      steal,
      bust,
    };
  });
}

/* ── Trade time machine ────────────────────────────────────── */
export type MachineSeason = {
  code: string;
  years: string;
  weeks: number;
  live: boolean;
  rosters: Record<string, Record<string, string[]>>;
  trades: { week: number; sides: Record<string, string[]> }[];
  draft: Record<string, number>;
};
export function machine(): MachineSeason[] {
  return raw.seasons.map((s) => ({
    code: s.code,
    years: years[s.code],
    weeks: s.weeks,
    live: s.status !== "complete",
    rosters: s.rosters,
    trades: s.trades,
    draft: Object.fromEntries(s.draft.map((p) => [`${p.by}|${p.pid}`, p.no])),
  }));
}

/* ── Quiz traits ───────────────────────────────────────────── */
export const TRAITS = ["trades", "wire", "lockin", "draft", "wins", "rings"] as const;
export type Trait = (typeof TRAITS)[number];
export type QuizManager = {
  id: string;
  nick: string;
  color: string;
  /** z-scores across active managers */
  z: Record<Trait, number>;
  facts: Record<Trait, string>;
};

export function quizManagers(): QuizManager[] {
  const active = league.seasons
    .find((s) => s.code === "s4")!
    .standings.map((r) => r.manager);
  const lock = new Map(lockIn().rows.map((r) => [r.id, r]));
  // Draft eye: across all of a manager's picks in rounds 1–4, how many spots better
  // (or worse) the player finished than where he was taken. Completed seasons only.
  const eye = new Map<string, number[]>();
  for (const s of raw.seasons.filter((x) => x.status === "complete")) {
    const pool = [...s.draft].sort((a, b) => b.value - a.value);
    const rank = new Map(pool.map((p, i) => [p.pid, i + 1]));
    for (const p of s.draft.filter((d) => d.round <= 4)) {
      const a = eye.get(p.by) ?? [];
      a.push(p.no - rank.get(p.pid)!);
      eye.set(p.by, a);
    }
  }
  const base = active.map((id) => {
    const m = league.managers.find((x) => x.id === id)!;
    const n = m.seasons.length;
    const adds = league.seasons.reduce((t, s) => {
      const r = s.standings.find((x) => x.manager === id) as
        | { adds?: number }
        | undefined;
      return t + (r?.adds ?? 0);
    }, 0);
    const e = eye.get(id) ?? [0];
    const l = lock.get(id)!;
    return {
      m,
      v: {
        trades: m.trades / n,
        wire: adds / n,
        lockin: l.eff,
        draft: e.reduce((a, b) => a + b, 0) / e.length,
        wins: m.pct,
        rings: m.titles.length * 2 + (m as unknown as { finals: number }).finals + m.playoffs * 0.5,
      } as Record<Trait, number>,
      facts: {
        trades: `${m.trades} trades in ${n} seasons`,
        wire: `${Math.round(adds / n)} waiver adds a season`,
        lockin: `${(l.eff * 100).toFixed(1)}% lineup efficiency`,
        draft: "",
        wins: `${(m.pct * 100).toFixed(1)}% career win rate`,
        rings: m.titles.length
          ? `${m.titles.length} title${m.titles.length > 1 ? "s" : ""}`
          : `${m.playoffs} playoff trip${m.playoffs === 1 ? "" : "s"}, no titles`,
      } as Record<Trait, string>,
    };
  });
  const z = (t: Trait) => {
    const xs = base.map((b) => b.v[t]);
    const mu = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / xs.length) || 1;
    return (x: number) => (x - mu) / sd;
  };
  const zs = Object.fromEntries(TRAITS.map((t) => [t, z(t)])) as Record<Trait, (x: number) => number>;
  // Everyone's early picks fall on average (injuries), so describe drafting against the league.
  const avgEye = base.reduce((t, b) => t + b.v.draft, 0) / base.length;
  for (const b of base) {
    const d = b.v.draft - avgEye;
    b.facts.draft = `Early picks finish ${Math.abs(d).toFixed(0)} spots ${d >= 0 ? "better" : "worse"} than the league average`;
  }
  return base.map((b) => ({
    id: b.m.id,
    nick: b.m.nick,
    color: b.m.color,
    z: Object.fromEntries(TRAITS.map((t) => [t, zs[t](b.v[t])])) as Record<Trait, number>,
    facts: b.facts,
  }));
}

/* ── My Guys ───────────────────────────────────────────────── */
export type Guy = {
  pid: string;
  weeks: number;
  starts: number;
  pts: number;
  seasons: string[];
};
export type GuysRow = { id: string; most: Guy[]; best: Guy[] };

/** Every manager's most-rostered and most productive players, all seasons, playoffs included.
 * Points are what the player actually put up in that manager's starting lineup. */
export function myGuys(): GuysRow[] {
  const by = new Map<string, Map<string, Guy>>();
  for (const s of raw.seasons as (RawSeason & { guys: Record<string, Record<string, [number, number, number]>> })[]) {
    for (const [who, ps] of Object.entries(s.guys ?? {})) {
      const m = by.get(who) ?? new Map<string, Guy>();
      for (const [pid, [weeks, starts, pts]] of Object.entries(ps)) {
        const g = m.get(pid) ?? { pid, weeks: 0, starts: 0, pts: 0, seasons: [] };
        g.weeks += weeks;
        g.starts += starts;
        g.pts += pts;
        if (!g.seasons.includes(s.code)) g.seasons.push(s.code);
        m.set(pid, g);
      }
      by.set(who, m);
    }
  }
  const order = league.managers.map((m) => m.id);
  return [...by.entries()]
    .map(([id, m]) => {
      const all = [...m.values()];
      return {
        id,
        most: [...all].sort((a, b) => b.weeks - a.weeks || b.pts - a.pts).slice(0, 6),
        best: [...all].sort((a, b) => b.pts - a.pts).slice(0, 6),
      };
    })
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}
