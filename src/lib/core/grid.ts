import type { Dataset } from "@/lib/core/types";

/**
 * Starting Nine: a daily 3 x 3 grid. Each square crosses a row (who: managers, title teams, seasons) with a
 * column (what: NBA teams, big lock-ins, waiver pickups, trades, first-round picks, positions, journeymen),
 * and you name a player who fits both. Nine guesses, each player once; deeper answers score more.
 *
 * The day's grid is picked only from FINISHED seasons (`gate`), so pickups this season can add right
 * answers but can never change which grid a day shows. Answers (`ids`) count every season.
 */
export type GridKind =
  | "mgr" | "champ" | "season" | "drafter" | "runnerup"
  | "nba" | "conf" | "big" | "waiver" | "traded" | "traded2" | "first" | "late" | "pos" | "journey"
  | "playoff" | "never" | "starts" | "points" | "avg" | "every" | "once"
  | "ppg" | "rpg" | "apg" | "threes" | "stocks" | "minutes" | "nbagame";
export type Criterion = {
  id: string;
  kind: GridKind;
  /** Display label; "big" is formatted on the page from `n` (lock-in wording follows the league). */
  label: string;
  n?: number;
  /** Every right answer, all seasons. */
  ids: string[];
  /** How many right answers come from finished seasons alone (what the daily pick checks). */
  gate: number;
  /** The right answers that come from finished seasons alone. */
  gateIds: string[];
};
export type GridData = { criteria: Criterion[]; fame: Record<string, number> };
export type DayGrid = { rows: Criterion[]; cols: Criterion[] };

/** Fewest right answers a square needs (from finished seasons). */
export const MIN_CELL = 3;
/** Most right answers a square may have (all seasons), so no square is a gimme. */
export const MAX_CELL = 60;
export const GUESSES = 9;

const NBA: Record<string, string> = {
  ATL: "Hawks", BOS: "Celtics", BKN: "Nets", CHA: "Hornets", CHI: "Bulls", CLE: "Cavaliers", DAL: "Mavericks", DEN: "Nuggets",
  DET: "Pistons", GSW: "Warriors", HOU: "Rockets", IND: "Pacers", LAC: "Clippers", LAL: "Lakers", MEM: "Grizzlies", MIA: "Heat",
  MIL: "Bucks", MIN: "Timberwolves", NOP: "Pelicans", NYK: "Knicks", OKC: "Thunder", ORL: "Magic", PHI: "76ers", PHX: "Suns",
  POR: "Trail Blazers", SAC: "Kings", SAS: "Spurs", TOR: "Raptors", UTA: "Jazz", WAS: "Wizards",
};
const POS: [string, string][] = [["PG", "Point guard"], ["SG", "Shooting guard"], ["SF", "Small forward"], ["PF", "Power forward"], ["C", "Center"]];

/** Every category the league's data supports, with its answers. */
export function gridData(d: Dataset): GridData {
  const raw = d.extras;
  const players = raw.players;
  const done = new Set(d.league.seasons.filter((s) => s.status === "complete").map((s) => s.code));
  const years = Object.fromEntries(d.league.seasons.map((s) => [s.code, s.years]));
  const cur = d.league.seasons[d.league.seasons.length - 1];
  const active = cur.standings.map((r) => r.manager).filter((m) => !/^r\d+$/.test(m)); // open slots ("r5") aren't managers
  const nick = (id: string) => d.league.managers.find((m) => m.id === id)?.nick ?? id;
  const out: Criterion[] = [];
  const add = (id: string, kind: GridKind, label: string, all: Set<string>, gate: Set<string>, n?: number) => {
    const ids = [...all].filter((p) => players[p]?.[0]);
    const gateIds = ids.filter((p) => gate.has(p));
    out.push({ id, kind, label, ids, gate: gateIds.length, gateIds, ...(n ? { n } : {}) });
  };
  const both = () => ({ all: new Set<string>(), gate: new Set<string>() });
  const put = (x: { all: Set<string>; gate: Set<string> }, p: string, fin: boolean) => {
    x.all.add(p);
    if (fin) x.gate.add(p);
  };

  // Who: rostered by each active manager (weekly rosters plus pickups the weekly rosters missed).
  const byMgr = new Map<string, ReturnType<typeof both>>();
  const anyRoster = both();
  const teamsOf = new Map<string, Set<string>>();
  const waiver = both();
  const traded = both();
  for (const s of raw.seasons) {
    const fin = done.has(s.code);
    const drafted = new Set(s.draft.map((x) => `${x.by}|${x.pid}`));
    const tradedTo = new Set(s.trades.flatMap((t) => Object.entries(t.sides).flatMap(([m, ps]) => ps.map((p) => `${m}|${p}`))));
    const season = both();
    const on = (m: string, p: string, picked: boolean) => {
      const x = byMgr.get(m) ?? byMgr.set(m, both()).get(m)!;
      put(x, p, fin);
      put(anyRoster, p, fin);
      put(season, p, fin);
      (teamsOf.get(p) ?? teamsOf.set(p, new Set()).get(p)!).add(m);
      if (picked && !drafted.has(`${m}|${p}`) && !tradedTo.has(`${m}|${p}`)) put(waiver, p, fin);
    };
    for (const [m, ps] of Object.entries(s.guys)) for (const p of Object.keys(ps)) on(m, p, true);
    for (const [m, ps] of Object.entries(s.added ?? {})) for (const [p] of ps) on(m, p, true);
    for (const t of s.trades) for (const ps of Object.values(t.sides)) for (const p of ps) if (!p.startsWith("pick:")) put(traded, p, fin);
    if (fin) add(`season:${s.code}`, "season", `On a roster in ${years[s.code]}`, season.all, season.gate);
    // Title team: the champion's roster that season.
    const champ = d.league.seasons.find((x) => x.code === s.code)?.champion;
    if (fin && champ && s.guys[champ]) {
      const c = new Set(Object.keys(s.guys[champ]));
      add(`champ:${s.code}`, "champ", `On ${nick(champ)}'s ${years[s.code]} title team`, c, c);
    }
  }
  for (const m of active) {
    const x = byMgr.get(m);
    if (x) add(`mgr:${m}`, "mgr", `Rostered by ${nick(m)}`, x.all, x.gate);
  }

  // What: NBA teams he has played for (league seasons' box scores) or plays for now, if he's been rostered.
  const played = d.extras.teamsPlayed ?? {};
  for (const [abbr, name] of Object.entries(NBA)) {
    const x = both();
    for (const p of anyRoster.all) if (players[p]?.[2] === abbr || (played[p] ?? []).includes(abbr)) put(x, p, anyRoster.gate.has(p));
    add(`nba:${abbr}`, "nba", name, x.all, x.gate);
  }
  add("waiver", "waiver", "Picked up off waivers", waiver.all, waiver.gate);
  add("traded", "traded", "Traded in league history", traded.all, traded.gate);
  {
    const x = both();
    for (const s of raw.seasons) for (const p of s.draft) if (p.round === 1) put(x, p.pid, true); // drafts are set before a season starts
    add("first", "first", "First-round pick", x.all, x.gate);
  }
  for (const [pos, label] of POS) {
    const x = both();
    for (const p of anyRoster.all) if (players[p]?.[1]?.includes(pos)) put(x, p, anyRoster.gate.has(p));
    add(`pos:${pos}`, "pos", label, x.all, x.gate);
  }
  {
    const x = both();
    for (const [p, ms] of teamsOf) if (ms.size >= 3) put(x, p, true);
    // Gate from finished seasons only.
    const fin = new Map<string, Set<string>>();
    for (const s of raw.seasons.filter((y) => done.has(y.code)))
      for (const [m, ps] of Object.entries(s.guys)) for (const p of Object.keys(ps)) (fin.get(p) ?? fin.set(p, new Set()).get(p)!).add(m);
    x.gate = new Set([...fin].filter(([, ms]) => ms.size >= 3).map(([p]) => p));
    add("journey", "journey", `On 3+ ${d.name} rosters`, x.all, x.gate);
  }
  // Big nights, in tiers (50+, 60+, ...): one start of N+ for a league team (Sleeper's starter points).
  // Gate: finished seasons' weekly top starters (a subset, so the day's pick never moves).
  {
    const best = d.extras.bigNights ?? {};
    for (let n = 50; n <= 200; n += 10) {
      const all = new Set(Object.entries(best).filter(([, v]) => v >= n).map(([p]) => p));
      if (all.size < 12) break;
      const gate = new Set<string>();
      for (const s of raw.seasons.filter((y) => done.has(y.code)))
        for (const w of Object.values(s.weekly ?? {})) for (const [, p, pts] of w.top) if (pts >= n && all.has(p)) gate.add(p);
      add(`big:${n}`, "big", `${n}+`, all, gate, n);
    }
  }
  // Real NBA numbers (box scores, Rafterlore): per-game averages in a season he was on a league roster
  // (10+ games), and single-game highs. Tiers too: 15+, 20+, 25+ points a game, and so on.
  {
    const ns = d.extras.nbaSeasons ?? {};
    const sleeperSeason = new Map(raw.seasons.map((x) => [x.season, x.code]));
    const rosteredIn = new Map<string, Set<string>>();
    for (const x of raw.seasons) {
      const set = new Set<string>();
      for (const ps of Object.values(x.guys)) for (const p of Object.keys(ps)) set.add(p);
      for (const ps of Object.values(x.added ?? {})) for (const [p] of ps) set.add(p);
      rosteredIn.set(x.code, set);
    }
    const stat = (id: string, kind: GridKind, label: string, ok: (a: number[]) => boolean, minGames = 10) => {
      const x = both();
      for (const [p, bySeason] of Object.entries(ns))
        for (const [season, a] of Object.entries(bySeason)) {
          const code = sleeperSeason.get(season);
          if (!code || !rosteredIn.get(code)?.has(p) || a[0] < minGames || !ok(a)) continue;
          put(x, p, done.has(code));
        }
      if (x.gate.size >= 6) add(id, kind, label, x.all, x.gate);
    };
    for (const n of [15, 20, 25, 30]) stat(`ppg:${n}`, "ppg", `Averaged ${n}+ PPG in a league season`, (a) => a[1] >= n);
    for (const n of [8, 10, 12]) stat(`rpg:${n}`, "rpg", `Averaged ${n}+ rebounds in a league season`, (a) => a[2] >= n);
    for (const n of [5, 7, 9]) stat(`apg:${n}`, "apg", `Averaged ${n}+ assists in a league season`, (a) => a[3] >= n);
    for (const n of [2, 3]) stat(`threes:${n}`, "threes", `Averaged ${n}+ threes a game in a league season`, (a) => a[4] >= n);
    stat("stocks:stl", "stocks", "Averaged 1.5+ steals in a league season", (a) => a[5] >= 1.5);
    stat("stocks:blk", "stocks", "Averaged 1.5+ blocks in a league season", (a) => a[6] >= 1.5);
    for (const n of [30, 35]) stat(`minutes:${n}`, "minutes", `Averaged ${n}+ minutes in a league season`, (a) => a[7] >= n);
    for (const n of [40, 50]) stat(`nbagame:${n}`, "nbagame", `Scored ${n}+ in an NBA game (league season)`, (a) => a[8] >= n, 1);
  }

  // More rows: drafted by each manager; runner-up teams.
  for (const m of active) {
    const x = both();
    for (const s of raw.seasons) for (const p of s.draft) if (p.by === m) put(x, p.pid, true);
    add(`drafter:${m}`, "drafter", `Drafted by ${nick(m)}`, x.all, x.gate);
  }
  for (const s of raw.seasons.filter((y) => done.has(y.code))) {
    const ru = d.league.seasons.find((x) => x.code === s.code)?.runnerUp;
    if (ru && s.guys[ru]) {
      const c = new Set(Object.keys(s.guys[ru]));
      add(`runnerup:${s.code}`, "runnerup", `On ${nick(ru)}'s ${years[s.code]} runner-up team`, c, c);
    }
  }
  // More columns, from what each player did for league teams (weeks, starts, points per manager-season).
  const EAST = new Set(["ATL", "BOS", "BKN", "CHA", "CHI", "CLE", "DET", "IND", "MIA", "MIL", "NYK", "ORL", "PHI", "TOR", "WAS"]);
  for (const [id, label, east] of [["conf:E", "Eastern Conference team", true], ["conf:W", "Western Conference team", false]] as const) {
    const x = both();
    for (const p of anyRoster.all) {
      const teams = new Set([players[p]?.[2], ...(played[p] ?? [])].filter((t): t is string => !!t && !!NBA[t]));
      if ([...teams].some((t) => EAST.has(t) === east)) put(x, p, anyRoster.gate.has(p));
    }
    add(id, "conf", label, x.all, x.gate);
  }
  const tally = (fin: boolean) => {
    const t = { starts: new Map<string, number>(), seasons: new Map<string, Set<string>>(), trades: new Map<string, number>(), bestTeamPts: new Map<string, number>(), bestAvg: new Map<string, number>(), rostered: new Set<string>(), started: new Set<string>(), playoff: new Set<string>(), late: new Set<string>() };
    for (const s of raw.seasons.filter((y) => !fin || done.has(y.code))) {
      for (const ps of Object.values(s.guys))
        for (const [p, [, st, pt]] of Object.entries(ps)) {
          t.rostered.add(p);
          if (st > 0) t.started.add(p);
          t.starts.set(p, (t.starts.get(p) ?? 0) + st);
          (t.seasons.get(p) ?? t.seasons.set(p, new Set()).get(p)!).add(s.code);
          t.bestTeamPts.set(p, Math.max(t.bestTeamPts.get(p) ?? 0, pt));
          if (st >= 5) t.bestAvg.set(p, Math.max(t.bestAvg.get(p) ?? 0, pt / st));
        }
      for (const tr of s.trades) for (const ps of Object.values(tr.sides)) for (const p of ps) if (!p.startsWith("pick:")) t.trades.set(p, (t.trades.get(p) ?? 0) + 1);
      for (const g of s.playoffs ?? []) for (const [p] of g.starters) t.playoff.add(p);
      for (const p of s.draft) if (p.round >= 8) t.late.add(p.pid);
    }
    return t;
  };
  const A = tally(false);
  const F = tally(true);
  const nSeasons = raw.seasons.length;
  const nDone = raw.seasons.filter((y) => done.has(y.code)).length;
  const from = (f: (t: ReturnType<typeof tally>) => Set<string>) => [f(A), f(F)] as const;
  const keys = <T,>(m: Map<string, T>, ok: (v: T) => boolean) => new Set([...m].filter(([, v]) => ok(v)).map(([p]) => p));
  // Score tiers: every round number enough players reach becomes its own square (one per grid).
  const tiers = (m: Map<string, number>, steps: number[]) => steps.filter((t) => [...m.values()].filter((v) => v >= t).length >= 12);
  const more: [string, GridKind, string, readonly [Set<string>, Set<string>]][] = [
    ["traded2", "traded2", "Traded 2+ times", from((t) => keys(t.trades, (v) => v >= 2))],
    ["late", "late", "Drafted in round 8 or later", from((t) => t.late)],
    ["playoff", "playoff", "Started a playoff game", from((t) => t.playoff)],
    ["never", "never", "Rostered but never started", from((t) => new Set([...t.rostered].filter((p) => !t.started.has(p))))],
    ["once", "once", "On a roster in just one season", from((t) => keys(t.seasons, (v) => v.size === 1))],
  ];
  if (nDone >= 2) more.push(["every", "every", "On a roster every season", [keys(A.seasons, (v) => v.size === nSeasons), keys(F.seasons, (v) => v.size === nDone)]]);
  for (const n of tiers(F.starts, [10, 20, 30, 40, 50, 75, 100])) more.push([`starts:${n}`, "starts", `Started ${n}+ times`, from((t) => keys(t.starts, (v) => v >= n))]);
  for (const n of tiers(F.bestTeamPts, [500, 750, 1000, 1500, 2000, 2500, 3000]))
    more.push([`points:${n}`, "points", `Scored ${n.toLocaleString("en-US")}+ for one team in a season`, from((t) => keys(t.bestTeamPts, (v) => v >= n))]);
  for (const n of tiers(F.bestAvg, [30, 35, 40, 45, 50, 55, 60, 65, 70]))
    more.push([`avg:${n}`, "avg", `Averaged ${n}+ a start in a season (5+ starts)`, from((t) => keys(t.bestAvg, (v) => v >= n))]);
  for (const [id, kind, label, [all, gate]] of more) add(id, kind, label, all, new Set([...gate].filter((p) => all.has(p))));

  // Fame (how obvious an answer is), from FINISHED seasons only, so a square's points never move during a
  // season (this season's games used to shift them between players). Someone with no finished season is
  // placed by his draft slot this season (a high pick is famous); undrafted newcomers count as deep.
  const pts = new Map<string, number>();
  const wks = new Map<string, number>();
  for (const s of raw.seasons.filter((y) => done.has(y.code)))
    for (const ps of Object.values(s.guys))
      for (const [p, [w, , pt]] of Object.entries(ps)) {
        pts.set(p, (pts.get(p) ?? 0) + pt);
        wks.set(p, (wks.get(p) ?? 0) + w);
      }
  const pct = (m: Map<string, number>) => {
    const s = [...m].sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
    return new Map(s.map(([k], i) => [k, s.length > 1 ? i / (s.length - 1) : 0.5]));
  };
  const [P, W] = [pct(pts), pct(wks)];
  const fame: Record<string, number> = {};
  for (const p of pts.keys()) fame[p] = Math.round((0.6 * (P.get(p) ?? 0) + 0.4 * (W.get(p) ?? 0)) * 1000) / 1000;
  const lastDraft = raw.seasons[raw.seasons.length - 1]?.draft ?? [];
  const picks = Math.max(1, lastDraft.length);
  for (const x of lastDraft) if (fame[x.pid] === undefined) fame[x.pid] = Math.round((1 - x.no / picks) * 0.9 * 1000) / 1000;
  for (const p of anyRoster.all) if (fame[p] === undefined) fame[p] = 0;
  return { criteria: out, fame };
}

const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const ROW_KINDS: GridKind[] = ["mgr", "champ", "season", "drafter", "runnerup"];
const COL_KINDS: GridKind[] = [
  "nba", "conf", "big", "waiver", "traded", "traded2", "first", "late", "pos", "journey", "playoff", "never", "starts", "points", "avg", "every", "once",
  "ppg", "rpg", "apg", "threes", "stocks", "minutes", "nbagame",
];

/** Right answers for a square, and how many come from finished seasons. */
export function cell(a: Criterion, b: Criterion) {
  const B = new Set(b.ids);
  const G = new Set(b.gateIds);
  const ids = a.ids.filter((p) => B.has(p));
  const gateIds = a.gateIds.filter((p) => G.has(p));
  return { ids, gate: gateIds.length, gateIds };
}

/** "Whose team" categories: hard to recall, so a grid has at most one (owner's call 2026-11-20). */
export const OWN_KINDS: GridKind[] = ["mgr", "drafter", "champ", "runnerup"];
/** Kinds that make silly squares together (a Celtic is always an Eastern Conference team). */
const CLASH: [GridKind, GridKind][] = [["nba", "conf"], ["once", "every"], ["never", "starts"], ["never", "playoff"], ["traded", "traded2"], ["first", "late"]];

/**
 * The day's grid: six categories of six different kinds, broad ones first. At most one "whose team"
 * category (rostered by, drafted by, title or runner-up team), in a little under half the grids; the rest
 * are things anyone can reason about (NBA teams, stats, tiers, positions, seasons...). Every square has
 * MIN_CELL to MAX_CELL answers from finished seasons (checked on finished seasons only, so the pick never
 * moves). Kinds are drawn first, then a category of that kind, so 30 NBA teams don't crowd out the rest.
 */
export function dayGrid(data: GridData, day: string): DayGrid | null {
  const r = rng(Number(day.replaceAll("-", "")) * 11 + 5);
  const by = (k: GridKind) => data.criteria.filter((c) => c.kind === k && c.gate >= MIN_CELL);
  const all = [...new Set([...ROW_KINDS, ...COL_KINDS])];
  const broad = all.filter((k) => !OWN_KINDS.includes(k) && by(k).length);
  const own = OWN_KINDS.filter((k) => by(k).length);
  if (broad.length < 5) return null;
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const clash = (ks: GridKind[]) => CLASH.some(([x, y]) => ks.includes(x) && ks.includes(y));
  // Decided once per day (a little under half the days), so easier-to-fill grids can't tilt the share.
  let h = 2166136261; // FNV-1a of the day: consecutive days get unrelated coins
  for (const ch of `own:${day}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const ownDay = own.length > 0 && h % 100 < 40;
  for (let tries = 0; tries < 24000; tries++) {
    const withOwn = tries < 20000 ? ownDay : !ownDay && own.length > 0;
    const kinds = [...broad].sort(() => r() - 0.5).slice(0, withOwn ? 5 : 6);
    if (withOwn) kinds.splice(Math.floor(r() * 3), 0, pick(own)); // the "whose team" one sits in the rows
    if (clash(kinds)) continue;
    const cs = kinds.map((k) => pick(by(k)));
    const rows = cs.slice(0, 3);
    const cols = cs.slice(3);
    if (rows.every((a) => cols.every((b) => cell(a, b).gate >= MIN_CELL && cell(a, b).gateIds.length <= MAX_CELL))) return { rows, cols };
  }
  return null;
}

/**
 * Points for a right answer: 10 for the most obvious, 100 for the deepest, ranked against the square's
 * answers from finished seasons (plus this one), so answers added later in the season can't move it.
 */
export function cellPoints(ids: string[], fame: Record<string, number>, pid: string): number {
  const order = [...new Set([...ids, pid])].sort((a, b) => (fame[b] ?? 0) - (fame[a] ?? 0) || (a < b ? -1 : 1)); // most famous first
  const i = order.indexOf(pid);
  return order.length === 1 ? 100 : Math.round(10 + (90 * i) / (order.length - 1));
}
