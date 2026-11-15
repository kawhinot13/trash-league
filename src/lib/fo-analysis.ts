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

export function profile(t: FOTeam, P: Record<string, FOPlayer>, slots: string[], sport: Sport = "nba") {
  const pl = t.players.map((id) => P[id]).filter(Boolean);
  const lu = bestLineup(pl, slots);
  const group = (pos: string[], n: number) => topN(pl.filter((p) => p.pos.some((x) => pos.includes(x))).map(avail), n);
  const full = topN(pl.map((p) => p.value), 9);
  const m: Record<Metric, number> = {
    stars: topN(pl.map(avail), 3),
    lineup: lu.total,
    depth: lu.bench.slice(0, 5).reduce((a, id) => a + avail(P[id]), 0),
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
) {
  const nfl = sport === "nfl";
  const k = SCALE[sport];
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

  const strengths = metricsFor(sport).filter((x) => top(x.key)).map((x) => x.label);
  const weaknesses = metricsFor(sport).filter((x) => low(x.key)).map((x) => x.label);
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
      text: `${hurt.map((p) => `${p.name} (${p.onIR ? "IR" : p.injury})`).join(", ")}. Their value is discounted until they're back.`,
    });

  const best = [...mine].sort((a, b) => b.value - a.value);
  const mvp = best[0];
  const deadweight = [...me.lineup.bench].reverse().slice(0, 2).map((id) => P[id]).filter(Boolean);
  return { archetype, pitch, strengths, weaknesses, advice, rank: r, mvp, deadweight, ownerOf: owner };
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
