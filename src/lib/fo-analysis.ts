import type { FOPlayer, FOTeam } from "@/lib/front-office";

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
};

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

export type Metric = "stars" | "lineup" | "depth" | "guards" | "forwards" | "centers" | "health";
export const METRICS: { key: Metric; label: string; info: string }[] = [
  { key: "stars", label: "Star power", info: "Your three best players' weekly value. Stars win this format: every slot only counts one game." },
  { key: "lineup", label: "Starting nine", info: "Your best legal lineup's weekly value, the number that actually wins matchups." },
  { key: "depth", label: "Depth", info: "Your best five bench players. Covers injuries and lets you lock in more big games." },
  { key: "guards", label: "Guards", info: "Your best three PG/SG-eligible players." },
  { key: "forwards", label: "Forwards", info: "Your best three SF/PF-eligible players." },
  { key: "centers", label: "Centers", info: "Your best two C-eligible players." },
  { key: "health", label: "Health", info: "How much of your rotation is available right now (injuries and IR count against it)." },
];

const topN = (xs: number[], n: number) => [...xs].sort((a, b) => b - a).slice(0, n).reduce((a, x) => a + x, 0);

export function profile(t: FOTeam, P: Record<string, FOPlayer>, slots: string[]) {
  const pl = t.players.map((id) => P[id]).filter(Boolean);
  const lu = bestLineup(pl, slots);
  const group = (pos: string[], n: number) => topN(pl.filter((p) => p.pos.some((x) => pos.includes(x))).map(avail), n);
  const full = topN(pl.map((p) => p.value), 9);
  const m: Record<Metric, number> = {
    stars: topN(pl.map(avail), 3),
    lineup: lu.total,
    depth: lu.bench.slice(0, 5).reduce((a, id) => a + avail(P[id]), 0),
    guards: group(["PG", "SG"], 3),
    forwards: group(["SF", "PF"], 3),
    centers: group(["C"], 2),
    health: full ? topN(pl.map(avail), 9) / full : 1,
  };
  return { id: t.id, lineup: lu, m };
}

export type Profile = ReturnType<typeof profile>;

/** League rank (1 = best) of each team on each metric. */
export function ranks(all: Profile[]) {
  const r: Record<string, Record<Metric, number>> = {};
  for (const { key } of METRICS) {
    const sorted = [...all].sort((a, b) => b.m[key] - a.m[key]);
    sorted.forEach((p, i) => ((r[p.id] ??= {} as Record<Metric, number>)[key] = i + 1));
  }
  return r;
}

export type Advice = { title: string; text: string; targets?: { pid: string; owner: string | null; why: string }[] };

/** Plain-English diagnosis: what kind of team this is, what it's good at, what it's missing, and what to do. */
export function diagnose(me: Profile, all: Profile[], P: Record<string, FOPlayer>, teams: FOTeam[], free: string[]) {
  const R = ranks(all);
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
    pitch = "Real stars, thin bench. One injury and your lineup has holes. Add cheap depth without giving up a star.";
  } else if (top("depth") && !top("stars")) {
    archetype = "Deep, no ceiling";
    pitch = "Plenty of bodies, not enough big games. In a one-game-per-slot league, consolidate: package two pieces for one star.";
  } else if (top("lineup")) {
    archetype = "Contender";
    pitch = "One of the best starting nines in the league. Protect it and patch the weak spot.";
  } else if (low("lineup")) {
    archetype = "Retooling";
    pitch = "The starting nine is near the bottom. Sell depth for upside and hit the waiver wire hard.";
  }

  const strengths = METRICS.filter((x) => top(x.key)).map((x) => x.label);
  const weaknesses = METRICS.filter((x) => low(x.key)).map((x) => x.label);
  const advice: Advice[] = [];

  // Weakest position group -> trade targets who are surplus on their own team.
  const groups: { key: Metric; label: string; pos: string[] }[] = [
    { key: "guards", label: "guard", pos: ["PG", "SG"] },
    { key: "forwards", label: "forward", pos: ["SF", "PF"] },
    { key: "centers", label: "center", pos: ["C"] },
  ];
  const weakest = [...groups].sort((a, b) => r[b.key] - r[a.key])[0];
  if (r[weakest.key] > n / 2) {
    const surplus = all
      .filter((p) => p.id !== me.id)
      .flatMap((p) => p.lineup.bench.slice(0, 4).map((pid) => ({ pid, owner: p.id })))
      .filter(({ pid }) => P[pid]?.pos.some((x) => weakest.pos.includes(x)) && !P[pid].onIR)
      .sort((a, b) => P[b.pid].value - P[a.pid].value)
      .slice(0, 3);
    advice.push({
      title: `Upgrade at ${weakest.label}`,
      text: `Your ${weakest.label}s rank #${r[weakest.key]} of ${n}. These ${weakest.label}s are sitting on other teams' benches, so their managers may sell.`,
      targets: surplus.map((s) => ({ pid: s.pid, owner: s.owner, why: `Bench piece for ${s.owner}` })),
    });
  }

  if (archetype === "Deep, no ceiling" || (top("depth") && r.stars > n / 2)) {
    const chips = me.lineup.bench.slice(0, 3).map((id) => P[id]).filter(Boolean);
    const needy = all.filter((p) => p.id !== me.id && R[p.id].depth > n / 2);
    const stars = needy
      .flatMap((p) => p.lineup.starters.filter(Boolean).map((pid) => ({ pid: pid as string, owner: p.id })))
      .sort((a, b) => P[b.pid].value - P[a.pid].value)
      .slice(0, 3);
    advice.push({
      title: "Consolidate: two for one",
      text: `Your bench is deep (${chips.map((c) => c.name).join(", ")}). Teams with thin benches will pay for depth with a star.`,
      targets: stars.map((s) => ({ pid: s.pid, owner: s.owner, why: `${s.owner} needs depth` })),
    });
  }

  if (low("depth") || archetype === "Top-heavy") {
    const pickups = free.filter((pid) => !P[pid].injury).slice(0, 3);
    advice.push({
      title: "Add depth off the wire",
      text: "Your bench is among the thinnest in the league. These free agents cost nothing.",
      targets: pickups.map((pid) => ({ pid, owner: null, why: `${P[pid].value.toFixed(0)} a week` })),
    });
  }

  const hurt = mine.filter((p) => (p.injury || p.onIR) && p.value >= 20);
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
) {
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
  const verdict = meDelta >= 12 ? "win" : meDelta <= -12 ? "lose" : "fair";
  const accept = themDelta >= -8 ? "likely" : themDelta >= -25 ? "maybe" : "unlikely";
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
