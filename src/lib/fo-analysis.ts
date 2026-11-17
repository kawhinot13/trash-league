import type { FOPlayer, FOTeam } from "@/lib/core/front-office";

/** Which player positions can fill each lineup slot. */
const SLOT_OK: Record<string, string[]> = {
  PG: ["PG"],
  SG: ["SG"],
  G: ["PG", "SG"],
  SF: ["SF"],
  PF: ["PF"],
  F: ["SF", "PF"],
  C: ["C"],
  UTIL: ["PG", "SG", "SF", "PF", "C"],
  // Football
  QB: ["QB"],
  RB: ["RB"],
  WR: ["WR"],
  TE: ["TE"],
  K: ["K"],
  DEF: ["DEF"],
  FLEX: ["RB", "WR", "TE"],
  SUPER_FLEX: ["QB", "RB", "WR", "TE"],
  REC_FLEX: ["WR", "TE"],
  WRRB_FLEX: ["WR", "RB"],
};

export type Sport = "nba" | "nfl";
/** Football values are one game a week (basketball: the week's best game), so its scale is smaller. */
const SCALE: Record<Sport, number> = { nba: 1, nfl: 0.35 };

/** Value a player brings right now: injured players count for less (Out and IR barely count). */
export const avail = (p: FOPlayer) => {
  if (p.onIR) return p.value * 0.15;
  const k: Record<string, number> = { Out: 0.25, Doubtful: 0.55, Questionable: 0.85, "Day-To-Day": 0.9 };
  return p.value * (k[p.injury ?? ""] ?? 1);
};

/** Rest-of-season value, for trades: short injuries barely matter, IR matters more. */
export const healthy = (p: FOPlayer) => p.value * (p.onIR ? 0.6 : p.injury === "Out" ? 0.85 : 1);

/** Best legal lineup (one player per slot), by bitmask DP over slots with backtracking. */
export function bestLineup(pl: FOPlayer[], slots: string[], worth: (p: FOPlayer) => number = avail) {
  const avail = worth;
  const ps = [...pl].sort((a, b) => avail(b) - avail(a)).slice(0, 16);
  const n = slots.length;
  let dp = new Map<number, { v: number; pick: (string | null)[] }>([[0, { v: 0, pick: Array(n).fill(null) }]]);
  for (const p of ps) {
    const ok = slots.map((s, i) => (SLOT_OK[s]?.some((x) => p.pos.includes(x)) ? i : -1)).filter((i) => i >= 0);
    const next = new Map(dp);
    for (const [mask, st] of dp)
      for (const i of ok) {
        if (mask & (1 << i)) continue;
        const m2 = mask | (1 << i);
        const v = st.v + avail(p);
        if ((next.get(m2)?.v ?? -1) < v) {
          const pick = [...st.pick];
          pick[i] = p.pid;
          next.set(m2, { v, pick });
        }
      }
    dp = next;
  }
  const top = [...dp.values()].sort((a, b) => b.v - a.v)[0];
  const starters = top.pick;
  const used = new Set(starters.filter(Boolean));
  const bench = ps.filter((p) => !used.has(p.pid)).map((p) => p.pid);
  return { total: top.v, starters, bench };
}

export type Metric = "stars" | "lineup" | "depth" | "guards" | "forwards" | "centers" | "health" | "qb" | "rb" | "wr" | "te";
export const METRICS: { key: Metric; label: string; info: string }[] = [
  { key: "stars", label: "Star power", info: "Your three best players' weekly value. Stars win this format: every slot only counts one game." },
  { key: "lineup", label: "Starting nine", info: "Your best legal lineup's weekly value, the number that actually wins matchups." },
  { key: "depth", label: "Depth", info: "Your best five players outside your top nine. With daily lineups they still play whenever a starter sits, and they cover injuries." },
  { key: "guards", label: "Guards", info: "Your best three PG/SG-eligible players." },
  { key: "forwards", label: "Forwards", info: "Your best three SF/PF-eligible players." },
  { key: "centers", label: "Centers", info: "Your best two C-eligible players." },
  { key: "health", label: "Health", info: "How much of your rotation is available right now (injuries and IR count against it)." },
];

export const METRICS_NFL: { key: Metric; label: string; info: string }[] = [
  { key: "stars", label: "Star power", info: "Your three best players' weekly value." },
  { key: "lineup", label: "Starting lineup", info: "Your best legal lineup's weekly value, the number that actually wins matchups." },
  { key: "depth", label: "Depth", info: "Your best five bench players: who starts on bye weeks and when someone gets hurt." },
  { key: "qb", label: "Quarterbacks", info: "Your best QB." },
  { key: "rb", label: "Running backs", info: "Your best two RBs." },
  { key: "wr", label: "Receivers", info: "Your best three WRs." },
  { key: "te", label: "Tight ends", info: "Your best TE." },
  { key: "health", label: "Health", info: "How much of your roster is available right now (injuries and IR count against it)." },
];

export const metricsFor = (sport: Sport = "nba") => (sport === "nfl" ? METRICS_NFL : METRICS);

const topN = (xs: number[], n: number) => [...xs].sort((a, b) => b - a).slice(0, n).reduce((a, x) => a + x, 0);

/** Full strength: every player at his healthy value, as if everyone injured were back. */
export const fullStrength = (p: FOPlayer) => p.value;

/** `worth`: how a player counts. Right now (default) discounts injuries; `fullStrength` ignores them.
 * Health always measures who's actually available. */
export function profile(t: FOTeam, P: Record<string, FOPlayer>, slots: string[], sport: Sport = "nba", worth: (p: FOPlayer) => number = avail) {
  const pl = t.players.map((id) => P[id]).filter(Boolean);
  const lu = bestLineup(pl, slots, worth);
  const group = (pos: string[], n: number) => topN(pl.filter((p) => p.pos.some((x) => pos.includes(x))).map(worth), n);
  const full = topN(pl.map((p) => p.value), 9);
  const m: Record<Metric, number> = {
    stars: topN(pl.map(worth), 3),
    lineup: lu.total,
    depth: lu.bench.slice(0, 5).reduce((a, id) => a + worth(P[id]), 0),
    guards: sport === "nba" ? group(["PG", "SG"], 3) : 0,
    forwards: sport === "nba" ? group(["SF", "PF"], 3) : 0,
    centers: sport === "nba" ? group(["C"], 2) : 0,
    health: full ? topN(pl.map(avail), 9) / full : 1,
    qb: sport === "nfl" ? group(["QB"], 1) : 0,
    rb: sport === "nfl" ? group(["RB"], 2) : 0,
    wr: sport === "nfl" ? group(["WR"], 3) : 0,
    te: sport === "nfl" ? group(["TE"], 1) : 0,
  };
  return { id: t.id, lineup: lu, m };
}

export type Profile = ReturnType<typeof profile>;

/** League rank (1 = best) of each team on each metric. */
export function ranks(all: Profile[], sport: Sport = "nba") {
  const r: Record<string, Record<Metric, number>> = {};
  for (const { key } of metricsFor(sport)) {
    const sorted = [...all].sort((a, b) => b.m[key] - a.m[key]);
    sorted.forEach((p, i) => ((r[p.id] ??= {} as Record<Metric, number>)[key] = i + 1));
  }
  return r;
}

export type Advice = { title: string; text: string; targets?: { pid: string; owner: string | null; why: string }[] };

/** Plain-English diagnosis: what kind of team this is, what it's good at, what it's missing, and what to do. */
export function diagnose(
  me: Profile,
  all: Profile[],
  P: Record<string, FOPlayer>,
  teams: FOTeam[],
  free: string[],
  slots: string[],
  sport: Sport = "nba",
  full = false,
) {
  const nfl = sport === "nfl";
  const k = SCALE[sport];
  // At full strength everyone counts as healthy, so Health isn't a strength or a weakness there.
  const shown = metricsFor(sport).filter((x) => !(full && x.key === "health"));
  const R = ranks(all, sport);
  const r = R[me.id];
  const n = all.length;
  const top = (k: Metric) => r[k] <= Math.ceil(n / 3);
  const low = (k: Metric) => r[k] > n - Math.ceil(n / 3);
  const myTeam = teams.find((t) => t.id === me.id)!;
  const mine = myTeam.players.map((id) => P[id]).filter(Boolean);
  const owner = (pid: string) => teams.find((t) => t.players.includes(pid))?.id ?? null;

  let archetype = "Balanced";
  let pitch = "No glaring hole. Small upgrades at your weakest spot are the way to climb.";
  if (top("stars") && low("depth")) {
    archetype = "Top-heavy";
    pitch = nfl
      ? "Real stars, thin depth. Bye weeks and injuries will leave holes in your lineup. Add cheap depth without giving up a star."
      : "Real stars, thin depth. On days your stars sit or get hurt, there's no one good to swap in. Add cheap depth without giving up a star.";
  } else if (top("depth") && !top("stars")) {
    archetype = "Deep, no ceiling";
    pitch = nfl
      ? "Plenty of bodies, not enough difference-makers. Only your starters score, so consolidate: package two pieces for one star."
      : "Plenty of bodies, not enough big games. In a one-game-per-slot league, consolidate: package two pieces for one star.";
  } else if (top("lineup")) {
    archetype = "Contender";
    pitch = nfl
      ? "One of the best starting lineups in the league. Protect it and patch the weak spot."
      : "One of the best starting nines in the league. Protect it and patch the weak spot.";
  } else if (low("lineup")) {
    archetype = "Retooling";
    pitch = nfl
      ? "The starting lineup is near the bottom. Sell depth for upside and hit the waiver wire hard."
      : "The starting nine is near the bottom. Sell depth for upside and hit the waiver wire hard.";
  }

  const strengths = shown.filter((x) => top(x.key)).map((x) => x.label);
  const weaknesses = shown.filter((x) => low(x.key)).map((x) => x.label);
  const advice: Advice[] = [];

  // How much a team's best lineup drops without a player. Lineups change daily, so "on the bench"
  // means nothing; what makes a player gettable is that his team barely misses him.
  const lineupCost = (owner: string, pid: string) => {
    const t = teams.find((x) => x.id === owner)!;
    const base = all.find((p) => p.id === owner)!.lineup.total;
    const without = bestLineup(t.players.filter((x) => x !== pid).map((x) => P[x]).filter(Boolean), slots).total;
    // Daily swaps mean even a player outside the top nine adds something (some days his game is
    // the best one available), so nobody counts as free: at least 15% of his value.
    return Math.max(base - without, P[pid].value * (nfl ? 0.05 : 0.15));
  };

  // Weakest position group -> good players whose teams can spare them.
  const groups: { key: Metric; label: string; pos: string[] }[] = nfl
    ? [
        { key: "qb", label: "quarterback", pos: ["QB"] },
        { key: "rb", label: "running back", pos: ["RB"] },
        { key: "wr", label: "receiver", pos: ["WR"] },
        { key: "te", label: "tight end", pos: ["TE"] },
      ]
    : [
        { key: "guards", label: "guard", pos: ["PG", "SG"] },
        { key: "forwards", label: "forward", pos: ["SF", "PF"] },
        { key: "centers", label: "center", pos: ["C"] },
      ];
  const weakest = [...groups].sort((a, b) => r[b.key] - r[a.key])[0];
  if (r[weakest.key] > n / 2) {
    const surplus = teams
      .filter((t) => t.id !== me.id)
      .flatMap((t) => t.players.map((pid) => ({ pid, owner: t.id })))
      .filter(({ pid }) => P[pid]?.pos.some((x) => weakest.pos.includes(x)) && !P[pid].onIR && P[pid].value >= 30 * k)
      .map((x) => ({ ...x, cost: lineupCost(x.owner, x.pid) }))
      .filter((x) => x.cost <= P[x.pid].value * 0.45)
      .sort((a, b) => P[b.pid].value - 1.5 * b.cost - (P[a.pid].value - 1.5 * a.cost))
      .slice(0, 3);
    advice.push({
      title: `Upgrade at ${weakest.label}`,
      text: `Your ${weakest.label}s rank #${r[weakest.key]} of ${n}. These ${weakest.label}s are good, and their teams are stacked enough to barely miss them, so they're the realistic asks.`,
      targets: surplus.map((s) => ({
        pid: s.pid,
        owner: s.owner,
        why: `their lineup drops only about ${Math.round(s.cost)} a week without him`,
      })),
    });
  }

  if (archetype === "Deep, no ceiling" || (top("depth") && r.stars > n / 2)) {
    const chips = me.lineup.bench.slice(0, 3).map((id) => P[id]).filter(Boolean); // best players outside the top nine
    const needy = all.filter((p) => p.id !== me.id && R[p.id].depth > n / 2);
    const stars = needy
      .flatMap((p) => p.lineup.starters.filter(Boolean).map((pid) => ({ pid: pid as string, owner: p.id })))
      .sort((a, b) => P[b.pid].value - P[a.pid].value)
      .slice(0, 3);
    advice.push({
      title: "Consolidate: two for one",
      text: nfl
        ? `You're deep on the bench (${chips.map((c) => c.name).join(", ")}). Teams with thin depth will pay for it with a star, and only starters score.`
        : `You're deep beyond your top nine (${chips.map((c) => c.name).join(", ")}). Teams with thin depth will pay for it with a star, and in a lock-in league one big game beats two average ones.`,
      targets: stars.map((s) => ({ pid: s.pid, owner: s.owner, why: "their depth is thin" })),
    });
  }

  if (low("depth") || archetype === "Top-heavy") {
    const pickups = free.filter((pid) => !P[pid].injury).slice(0, 3);
    advice.push({
      title: "Add depth off the wire",
      text: nfl
        ? "Your depth is among the thinnest in the league, so bye weeks and injuries leave you starting nobodies. These free agents cost nothing."
        : "Your depth is among the thinnest in the league, so on game days there's often no one good to swap in. These free agents cost nothing.",
      targets: pickups.map((pid) => ({ pid, owner: null, why: `${P[pid].value.toFixed(0)} a week` })),
    });
  }

  const hurt = mine.filter((p) => (p.injury || p.onIR) && p.value >= 20 * k);
  if (hurt.length)
    advice.push({
      title: "Injury watch",
      text: `${hurt.map((p) => `${p.name} (${p.onIR ? "IR" : p.injury})`).join(", ")}. ${full ? "Counted healthy in this view; switch to Right now to see the team without them." : "Their value is discounted until they're back."}`,
    });

  const best = [...mine].sort((a, b) => b.value - a.value);
  const mvp = best[0];
  const deadweight = [...me.lineup.bench].reverse().slice(0, 2).map((id) => P[id]).filter(Boolean);
  // Of your five most valuable players, who is out right now (Out or on IR).
  const out = best.slice(0, 5).filter((p) => p.onIR || p.injury === "Out");
  return { archetype, pitch, strengths, weaknesses, advice, rank: r, mvp, deadweight, ownerOf: owner, out };
}

/** Trade evaluation: how each side's best lineup changes per week, plus raw value in and out. */
export function evaluateTrade(
  give: string[],
  get: string[],
  me: FOTeam,
  them: FOTeam,
  P: Record<string, FOPlayer>,
  slots: string[],
  roster = 15,
  sport: Sport = "nba",
) {
  const k = SCALE[sport];
  // Trades are for the rest of the season, so value players at expected health.
  const before = (t: FOTeam) => bestLineup(t.players.map((id) => P[id]).filter(Boolean), slots, healthy);
  const after = (t: FOTeam, out: string[], inn: string[]) => {
    let ids = t.players.filter((id) => !out.includes(id)).concat(inn);
    // too many players: they'd have to drop the least valuable extras
    const drops: string[] = [];
    while (ids.length > roster) {
      const worst = [...ids].sort((a, b) => healthy(P[a]) - healthy(P[b]))[0];
      drops.push(worst);
      ids = ids.filter((x) => x !== worst);
    }
    return { lu: bestLineup(ids.map((id) => P[id]).filter(Boolean), slots, healthy), drops };
  };
  const meB = before(me);
  const themB = before(them);
  const meA = after(me, give, get);
  const themA = after(them, get, give);
  const sum = (ids: string[]) => ids.reduce((a, id) => a + (P[id]?.value ?? 0), 0);
  const meDelta = meA.lu.total - meB.total;
  const themDelta = themA.lu.total - themB.total;
  const verdict = meDelta >= 12 * k ? "win" : meDelta <= -12 * k ? "lose" : "fair";
  const accept = themDelta >= -8 * k ? "likely" : themDelta >= -25 * k ? "maybe" : "unlikely";
  return {
    meDelta,
    themDelta,
    valueIn: sum(get),
    valueOut: sum(give),
    meDrops: meA.drops,
    themDrops: themA.drops,
    verdict,
    accept,
    meAfter: meA.lu,
    meBefore: meB,
  };
}

/** Same total as bestLineup(...).total, without the lineup itself: fast enough to try hundreds of trades. */
export function lineupTotal(pl: FOPlayer[], slots: string[], worth: (p: FOPlayer) => number = avail) {
  const ps = [...pl].sort((a, b) => worth(b) - worth(a)).slice(0, 16);
  const n = slots.length;
  const size = 1 << n;
  let dp = new Float64Array(size).fill(-1);
  dp[0] = 0;
  for (const p of ps) {
    const v = worth(p);
    const ok = slots.map((s, i) => (SLOT_OK[s]?.some((x) => p.pos.includes(x)) ? i : -1)).filter((i) => i >= 0);
    if (!ok.length) continue;
    const next = dp.slice();
    for (let mask = 0; mask < size; mask++) {
      const cur = dp[mask];
      if (cur < 0) continue;
      for (const i of ok) {
        const bit = 1 << i;
        if (mask & bit) continue;
        if (next[mask | bit] < cur + v) next[mask | bit] = cur + v;
      }
    }
    dp = next;
  }
  let best = 0;
  for (let m = 0; m < size; m++) if (dp[m] > best) best = dp[m];
  return best;
}

/* ── Trade finder ──────────────────────────────────────────── */
export type TradeIdea = {
  partner: string;
  give: string[];
  get: string[];
  meDelta: number;
  themDelta: number;
  valueOut: number;
  valueIn: number;
  meDrops: string[];
  themDrops: string[];
};

/**
 * Realistic trades that make your starting lineup better: 1-for-1, 2-for-1 (consolidate), 1-for-2 and 2-for-2.
 * Realistic means the other manager would say yes too: their best lineup stays about the same or gets
 * better (at most 3 a week worse), you never take more than about 15% extra raw value, and you never
 * pay more than half again what you get. Players are valued rest-of-season (`healthy`);
 * nobody on IR is offered or asked for. Best gain for you first, at most two ideas per team, and
 * each player you'd get appears once.
 */
export function tradeFinder(me: FOTeam, teams: FOTeam[], P: Record<string, FOPlayer>, slots: string[], sport: Sport = "nba", roster = 15): TradeIdea[] {
  const k = SCALE[sport];
  const h = (id: string) => healthy(P[id]);
  const lineupOf = (ids: string[]) => {
    const drops: string[] = [];
    let keep = ids;
    while (keep.length > roster) {
      const worst = [...keep].sort((a, b) => h(a) - h(b))[0];
      drops.push(worst);
      keep = keep.filter((x) => x !== worst);
    }
    return { total: lineupTotal(keep.map((id) => P[id]), slots, healthy), drops };
  };
  const usable = (t: FOTeam) =>
    t.players.filter((id) => P[id] && !P[id].onIR && h(id) >= 8 * k).sort((a, b) => h(b) - h(a)).slice(0, 12);
  const mineIds = me.players.filter((id) => P[id]);
  const myBase = lineupTotal(mineIds.map((id) => P[id]), slots, healthy);
  const mine = usable(me);
  const sum = (ids: string[]) => ids.reduce((a, id) => a + h(id), 0);
  const ideas: TradeIdea[] = [];

  for (const t of teams) {
    if (t.id === me.id) continue;
    const theirIds = t.players.filter((id) => P[id]);
    const theirBase = lineupTotal(theirIds.map((id) => P[id]), slots, healthy);
    const theirs = usable(t);
    const cands: [string[], string[]][] = [];
    // 1-for-1, values within about 15% of each other
    for (const a of mine) for (const b of theirs) if (h(b) <= h(a) * 1.15 && h(b) >= h(a) * 0.8) cands.push([[a], [b]]);
    // 2-for-1: two of yours for one better player (you pay at least what he's worth)
    const pairs = (ids: string[]) => ids.flatMap((x, i) => ids.slice(i + 1).map((y) => [x, y]));
    for (const b of theirs.slice(0, 5)) {
      const fits = pairs(mine.filter((a) => h(a) < h(b)))
        .filter((pr) => sum(pr) >= h(b) * 0.95 && sum(pr) <= h(b) * 1.8)
        .sort((x, y) => Math.abs(sum(x) - h(b) * 1.25) - Math.abs(sum(y) - h(b) * 1.25))
        .slice(0, 8);
      for (const pr of fits) cands.push([pr, [b]]);
    }
    // 1-for-2: one of yours for two of theirs (they consolidate)
    for (const a of mine.slice(0, 5)) {
      const fits = pairs(theirs.filter((b) => h(b) < h(a)))
        .filter((pr) => sum(pr) >= h(a) * 0.95 && sum(pr) <= h(a) * 1.15)
        .sort((x, y) => sum(y) - sum(x))
        .slice(0, 8);
      for (const pr of fits) cands.push([[a], pr]);
    }
    // 2-for-2: too many to try them all, so rank by a quick estimate (each player's own effect on
    // both lineups) and check the most promising exactly.
    const mineP = mineIds.map((id) => P[id]);
    const theirP = theirIds.map((id) => P[id]);
    const add = (base: FOPlayer[], baseTotal: number, id: string) => lineupTotal([...base, P[id]], slots, healthy) - baseTotal;
    const loss = (base: FOPlayer[], baseTotal: number, id: string) => baseTotal - lineupTotal(base.filter((p) => p.pid !== id), slots, healthy);
    const myAdd = new Map(theirs.map((id) => [id, add(mineP, myBase, id)]));
    const myLoss = new Map(mine.map((id) => [id, loss(mineP, myBase, id)]));
    const theirAdd = new Map(mine.map((id) => [id, add(theirP, theirBase, id)]));
    const theirLoss = new Map(theirs.map((id) => [id, loss(theirP, theirBase, id)]));
    const twos: { give: string[]; get: string[]; est: number }[] = [];
    for (const g of pairs(mine))
      for (const t2 of pairs(theirs)) {
        const out = sum(g);
        const inn = sum(t2);
        if (inn > out * 1.15 || out > inn * 1.15) continue;
        const meEst = myAdd.get(t2[0])! + myAdd.get(t2[1])! - myLoss.get(g[0])! - myLoss.get(g[1])!;
        const themEst = theirAdd.get(g[0])! + theirAdd.get(g[1])! - theirLoss.get(t2[0])! - theirLoss.get(t2[1])!;
        if (meEst >= 4 * k && themEst >= -6 * k) twos.push({ give: g, get: t2, est: meEst + 0.5 * themEst });
      }
    twos.sort((a, b) => b.est - a.est);
    for (const x of twos.slice(0, 30)) cands.push([x.give, x.get]);

    for (const [give, get] of cands) {
      const valueOut = sum(give);
      const valueIn = sum(get);
      // Fair on paper both ways: you don't take more than ~15% extra, and don't overpay by half.
      if (valueIn > valueOut * 1.15 || valueOut > valueIn * 1.5) continue;
      const meA = lineupOf(mineIds.filter((id) => !give.includes(id)).concat(get));
      const meDelta = meA.total - myBase;
      if (meDelta < 5 * k) continue;
      const themA = lineupOf(theirIds.filter((id) => !get.includes(id)).concat(give));
      const themDelta = themA.total - theirBase;
      // They'd say yes: their best lineup stays about the same or gets better.
      if (themDelta < -3 * k) continue;
      ideas.push({ partner: t.id, give, get, meDelta, themDelta, valueOut, valueIn, meDrops: meA.drops, themDrops: themA.drops });
    }
  }
  // Your gain first, nudged toward deals that help them too (easier to get done).
  ideas.sort((a, b) => b.meDelta + 0.5 * b.themDelta - (a.meDelta + 0.5 * a.themDelta));
  const out: TradeIdea[] = [];
  const perTeam = new Map<string, number>();
  const gotten = new Set<string>();
  const sent = new Map<string, number>();
  for (const i of ideas) {
    if ((perTeam.get(i.partner) ?? 0) >= 2 || i.get.some((x) => gotten.has(x)) || i.give.some((x) => (sent.get(x) ?? 0) >= 2)) continue;
    out.push(i);
    perTeam.set(i.partner, (perTeam.get(i.partner) ?? 0) + 1);
    i.get.forEach((x) => gotten.add(x));
    i.give.forEach((x) => sent.set(x, (sent.get(x) ?? 0) + 1));
    if (out.length >= 8) break;
  }
  return out;
}

/* ── Buy low / sell high ───────────────────────────────────── */
export type Mover = { pid: string; owner: string | null; gap: number; reasons: string[] };

/**
 * Compares what a player is locking in this season (his weekly best game) with what he should be
 * worth (last season and Sleeper's projection, as a weekly ceiling). Hot well above it: sell high.
 * Healthy and well below it: buy low. Recent games and minutes decide how loud the call is.
 */
export function market(P: Record<string, FOPlayer>, teams: FOTeam[], sport: Sport = "nba") {
  const nfl = sport === "nfl";
  const k = SCALE[sport];
  const owner = (pid: string) => teams.find((t) => t.players.includes(pid))?.id ?? null;
  const n0 = (x: number) => Math.round(x);
  const sell: (Mover & { score: number })[] = [];
  const buy: (Mover & { score: number })[] = [];
  for (const t of teams)
    for (const pid of t.players) {
      const p = P[pid];
      if (!p || p.onIR || p.injury === "Out" || p.weeks < 2 || p.expected < 30 * k) continue;
      const gap = (p.now - p.expected) / p.expected;
      const reasons: string[] = [
        nfl ? `Scoring ${n0(p.now)} a week; expected about ${n0(p.expected)}.` : `Locking in ${n0(p.now)} a week; expected about ${n0(p.expected)}.`,
      ];
      const recentCeil = p.recent * (nfl ? 1 : 1.3); // last 3 games, as a weekly-best estimate
      const minDelta = p.minRecent - p.min;
      if (gap >= 0.15 && p.now >= 35 * k) {
        if (recentCeil < p.now * 0.9) reasons.push(`Already cooling: last 3 games average ${n0(p.recent)}.`);
        if (!nfl && minDelta <= -3) reasons.push(`Minutes slipping (${n0(p.minRecent)} lately vs ${n0(p.min)}).`);
        if (p.prev) reasons.push(`Averaged ${n0(p.prev)} a game last season.`);
        const heat = recentCeil < p.now * 0.9 ? 1.25 : 1;
        sell.push({ pid, owner: owner(pid), gap, reasons, score: gap * p.expected * heat });
      } else if (gap <= -0.15) {
        if (recentCeil > p.now) reasons.push(`Bouncing back: last 3 games average ${n0(p.recent)}.`);
        if (!nfl && minDelta >= 2) reasons.push(`Minutes rising (${n0(p.minRecent)} lately vs ${n0(p.min)}).`);
        else if (!nfl && minDelta > -2) reasons.push("Minutes are steady, so the role is still there.");
        if (p.prev) reasons.push(`Averaged ${n0(p.prev)} a game last season.`);
        const heat = recentCeil > p.now ? 1.25 : 1;
        buy.push({ pid, owner: owner(pid), gap, reasons, score: -gap * p.expected * heat });
      }
    }
  const top = (xs: (Mover & { score: number })[]) => xs.sort((a, b) => b.score - a.score).slice(0, 12).map((m) => ({ pid: m.pid, owner: m.owner, gap: m.gap, reasons: m.reasons }));
  return { sell: top(sell), buy: top(buy) };
}

/**
 * Plain-English pros and cons of a trade for you: which lineup spots get better or worse, who gets
 * the best player, total value in and out, injuries, and roster spots. Built from evaluateTrade's
 * before/after lineups, so every note matches the numbers shown.
 */
export function tradeNotes(
  trade: ReturnType<typeof evaluateTrade>,
  give: string[],
  get: string[],
  P: Record<string, FOPlayer>,
  slots: string[],
  sport: Sport = "nba",
) {
  const k = SCALE[sport];
  const n0 = (x: number) => Math.round(x);
  const name = (id: string | null) => (id ? (P[id]?.name ?? "someone") : "nobody");
  const good: { text: string; w: number }[] = [];
  const bad: { text: string; w: number }[] = [];

  // Who joins and leaves your starting lineup (players sliding between spots aren't news).
  const before = new Set(trade.meBefore.starters.filter(Boolean) as string[]);
  const after = new Set(trade.meAfter.starters.filter(Boolean) as string[]);
  const joins = [...after].filter((id) => !before.has(id));
  const leaves = [...before].filter((id) => !after.has(id));
  for (const id of joins.filter((x) => get.includes(x)))
    good.push({ text: `${name(id)} joins your starting lineup (${n0(healthy(P[id]))} a week).`, w: healthy(P[id]) });
  for (const id of leaves.filter((x) => give.includes(x)))
    bad.push({ text: `${name(id)} leaves your starting lineup (${n0(healthy(P[id]))} a week).`, w: healthy(P[id]) });
  const fill = joins.filter((x) => !get.includes(x));
  if (fill.length)
    bad.push({
      text: `${fill.map(name).join(" and ")} ${fill.length === 1 ? "has" : "have"} to start from your bench to fill the gap (${fill
        .map((id) => n0(healthy(P[id])))
        .join(" and ")} a week).`,
      w: 3 * k,
    });
  const benched = leaves.filter((x) => !give.includes(x));
  if (benched.length)
    good.push({ text: `${benched.map(name).join(" and ")} ${benched.length === 1 ? "moves" : "move"} to your bench as depth.`, w: 2 * k });
  if (slots.length > after.size && after.size < before.size) bad.push({ text: "You'd be left with an empty lineup spot.", w: 20 * k });

  // The best player in the deal.
  const all = [...give, ...get].filter((id) => P[id]);
  const star = [...all].sort((a, b) => P[b].value - P[a].value)[0];
  if (star && all.length > 1) {
    const why = sport === "nfl" ? "Difference-makers are the hardest thing to find." : "One star beats two good players when every spot counts one game.";
    if (get.includes(star)) good.push({ text: `You get the best player in the deal, ${name(star)} (${n0(P[star].value)} a week). ${why}`, w: 30 * k });
    else bad.push({ text: `You give up the best player in the deal, ${name(star)} (${n0(P[star].value)} a week).`, w: 30 * k });
  }

  // Total value, beyond the starters.
  const gap = trade.valueIn - trade.valueOut;
  if (gap <= -15 * k)
    bad.push({ text: `You send more total value than you get (${n0(trade.valueOut)} vs ${n0(trade.valueIn)} a week), so your depth gets thinner.`, w: -gap / 2 });
  else if (gap >= 15 * k) good.push({ text: `You get more total value back (${n0(trade.valueIn)} vs ${n0(trade.valueOut)} a week).`, w: gap / 2 });

  // Injuries on either side.
  const hurt = (id: string) => P[id] && (P[id].onIR || ["Out", "Doubtful"].includes(P[id].injury ?? ""));
  const tag = (id: string) => (P[id].onIR ? "on IR" : (P[id].injury ?? "").toLowerCase());
  for (const id of get.filter(hurt)) bad.push({ text: `${name(id)} is ${tag(id)}: he helps less until he's back.`, w: 10 * k });
  for (const id of give.filter(hurt)) good.push({ text: `You move ${name(id)} while he's ${tag(id)}.`, w: 8 * k });

  // Roster spots.
  if (give.length > get.length) {
    const n = give.length - get.length;
    good.push({ text: `Frees ${n === 1 ? "a roster spot" : `${n} roster spots`} for a waiver pickup.`, w: 5 * k });
  }
  if (trade.meDrops.length) bad.push({ text: `You'd have to drop ${trade.meDrops.map(name).join(", ")} to make room.`, w: 5 * k });

  const top = (xs: { text: string; w: number }[]) => xs.sort((a, b) => b.w - a.w).slice(0, 4).map((x) => x.text);
  return { good: top(good), bad: top(bad) };
}
