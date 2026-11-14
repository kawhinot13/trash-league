import { lockIn, machine, myGuys, players, redrafts } from "@/lib/extras";
import { league } from "@/lib/league";

/**
 * Dumpster Dive: a daily five-question league quiz. The server builds a big, fixed pool of
 * questions from league history; each browser picks the day's five with a date-seeded RNG,
 * so everyone in the league gets the same questions on the same day.
 */
export type Option = { label: string; mgr?: string; pid?: string };
export type Question = {
  kind: string;
  prompt: string;
  /** Optional player headshots shown with the prompt (locker questions). */
  show?: string[];
  options: Option[]; // options[0] is the answer; the client shuffles
  reveal: string;
};

// Deterministic RNG so the pool is identical on every build.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}
const R = rng(20231024);
const pick = <T,>(xs: T[], n: number, not: (x: T) => boolean = () => false) => {
  const pool = xs.filter((x) => !not(x));
  const out: T[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(R() * pool.length), 1)[0]);
  return out;
};
const nick = (id: string) => league.managers.find((m) => m.id === id)?.nick ?? id;
const name = (pid: string) => players[pid]?.[0] ?? pid;
const mgrOpt = (id: string): Option => ({ label: nick(id), mgr: id });
const plOpt = (pid: string): Option => ({ label: name(pid), pid });

export function divePool(): Question[] {
  const qs: Question[] = [];
  const active = new Set(league.seasons.find((s) => s.code === "s4")!.standings.map((r) => r.manager));
  const years = Object.fromEntries(league.seasons.map((s) => [s.code, s.years]));
  const seasons = machine();

  // Trades: who received this player?
  for (const s of seasons)
    for (const t of s.trades) {
      const sides = Object.keys(t.sides);
      for (const who of sides) {
        const got = t.sides[who].filter((p) => !p.startsWith("pick:"));
        if (!got.length) continue;
        const star = got[0];
        const from = sides.find((x) => x !== who)!;
        const others = pick(Object.keys(s.rosters["0"]), 3, (x) => x === who);
        qs.push({
          kind: "Trade log",
          prompt: `${years[s.code]}, week ${t.week}: who traded for ${name(star)}?`,
          show: [star],
          options: [mgrOpt(who), ...others.map(mgrOpt)],
          reveal: `${nick(who)} got ${got.map(name).join(", ")} from ${nick(from)}.`,
        });
      }
    }

  // Draft: who took this first-rounder?
  for (const d of redrafts())
    for (const p of d.picks) {
      const others = pick(d.picks.map((x) => x.by), 3, (x) => x === p.by);
      qs.push({
        kind: "Draft night",
        prompt: `Who took ${name(p.took.pid)} in the first round of the ${d.years} draft?`,
        show: [p.took.pid],
        options: [mgrOpt(p.by), ...others.map(mgrOpt)],
        reveal: `${nick(p.by)}, pick #${p.slot}. Re-drafted: #${p.took.redo}.`,
      });
    }

  // Whose locker: four players from one roster, one week.
  for (const s of seasons) {
    const weeks = Object.keys(s.rosters).map(Number).filter((w) => w > 0);
    for (const w of pick(weeks, 5)) {
      for (const who of pick(Object.keys(s.rosters[String(w)]), 3)) {
        const ros = s.rosters[String(w)][who].filter((p) => players[p]?.[3]);
        if (ros.length < 4) continue;
        const show = pick(ros, 4);
        const others = pick(Object.keys(s.rosters[String(w)]), 3, (x) => x === who);
        qs.push({
          kind: "Whose locker?",
          prompt: `${years[s.code]}, week ${w}. Whose roster had all four of these guys?`,
          show,
          options: [mgrOpt(who), ...others.map(mgrOpt)],
          reveal: `${nick(who)}'s locker that week.`,
        });
      }
    }
  }

  // My guys: who has done the most for this manager?
  const guys = myGuys();
  for (const g of guys.filter((x) => active.has(x.id))) {
    const top = g.best[0];
    const others = pick(
      guys.flatMap((x) => x.best.slice(0, 2).map((y) => y.pid)),
      3,
      (p) => g.best.some((y) => y.pid === p),
    );
    if (others.length < 3) continue;
    qs.push({
      kind: "My guys",
      prompt: `Which player has scored the most points ever for ${nick(g.id)}?`,
      show: [],
      options: [plOpt(top.pid), ...others.map(plOpt)],
      reveal: `${name(top.pid)}: ${Math.round(top.pts).toLocaleString()} locked-in points over ${top.weeks} weeks.`,
    });
  }

  // Bench crimes: who left this many points sitting?
  const { rows, crimes } = lockIn();
  for (const c of crimes) {
    const others = pick(rows.map((r) => r.id), 3, (x) => x === c.id);
    qs.push({
      kind: "Bench crimes",
      prompt: `${c.years}, week ${c.week}: who left ${Math.round(c.opt - c.act)} points on the bench?`,
      options: [mgrOpt(c.id), ...others.map(mgrOpt)],
      reveal: `${nick(c.id)} scored ${Math.round(c.act)} with ${Math.round(c.opt)} available.`,
    });
  }

  // Lock-in head to head: who set better lineups that season?
  for (const s of league.seasons) {
    const effs = rows
      .map((r) => ({ id: r.id, e: r.seasons.find((x) => x.code === s.code)?.eff }))
      .filter((x): x is { id: string; e: number } => x.e !== undefined);
    for (let k = 0; k < 4; k++) {
      const [a, b] = pick(effs, 2);
      if (!a || !b || Math.abs(a.e - b.e) < 0.01) continue;
      const [w, l] = a.e > b.e ? [a, b] : [b, a];
      qs.push({
        kind: "Lock-in",
        prompt: `${s.years}: who set the better lineups?`,
        options: [mgrOpt(w.id), mgrOpt(l.id)],
        reveal: `${nick(w.id)} ${(w.e * 100).toFixed(1)}% vs ${nick(l.id)} ${(l.e * 100).toFixed(1)}%.`,
      });
    }
  }

  // Finishes: where did this manager end up?
  const FIN = ["Champion", "Runner-up", "Semifinal", "Quarterfinal", "Missed playoffs"];
  for (const m of league.managers.filter((x) => active.has(x.id)))
    for (const s of m.seasons.filter((x) => FIN.includes(x.finish))) {
      const others = pick(FIN, 3, (f) => f === s.finish);
      qs.push({
        kind: "Final table",
        prompt: `How did ${nick(m.id)}'s ${years[s.code]} season end?`,
        options: [{ label: s.finish }, ...others.map((f) => ({ label: f }))],
        reveal: `${s.finish}, after going ${s.w}–${s.l} as the #${s.seed} seed.`,
      });
    }

  // Re-draft steals.
  for (const d of redrafts().filter((x) => !x.live)) {
    const others = pick(
      d.picks.map((p) => p.took.pid),
      3,
      (p) => p === d.steal.pid,
    );
    qs.push({
      kind: "Re-draft",
      prompt: `Who was the steal of the ${d.years} draft?`,
      options: [plOpt(d.steal.pid), ...others.map(plOpt)],
      reveal: `${name(d.steal.pid)}: taken #${d.steal.no}, would go #${d.steal.redo} in a re-draft.`,
    });
  }
  return qs.filter((q) => q.options.length >= 2);
}
