import { describe, expect, it } from "vitest";
import { bestLineup, diagnose, evaluateTrade, fullStrength, healthy, keepsStar, lineupTotal, profile, tradeFinder } from "@/lib/fo-analysis";
import { NBA_SLOTS, NFL_SLOTS, league, player, rng } from "./helpers";

describe("lineup math", () => {
  it("the fast lineup total always equals the full lineup builder", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { P, T } = league(seed);
      for (const t of T) {
        const pl = t.players.map((id) => P[id]);
        expect(lineupTotal(pl, NBA_SLOTS, healthy)).toBeCloseTo(bestLineup(pl, NBA_SLOTS, healthy).total, 9);
      }
    }
  });

  it("works for football slots too", () => {
    const r = rng(7);
    const POS = ["QB", "RB", "WR", "TE", "K", "DEF"];
    const pl = Array.from({ length: 16 }, (_, i) => player(`f${i}`, [POS[i % POS.length]], Math.round(5 + r() * 25)));
    expect(lineupTotal(pl, NFL_SLOTS)).toBeCloseTo(bestLineup(pl, NFL_SLOTS).total, 9);
  });

  it("never starts one player twice or in a slot he can't fill", () => {
    const { P, T } = league(3);
    const lu = bestLineup(T[0].players.map((id) => P[id]), NBA_SLOTS);
    const used = lu.starters.filter(Boolean);
    expect(new Set(used).size).toBe(used.length);
    const ok: Record<string, string[]> = { G: ["PG", "SG"], F: ["SF", "PF"], UTIL: ["PG", "SG", "SF", "PF", "C"] };
    lu.starters.forEach((pid, i) => {
      if (!pid) return;
      const slot = NBA_SLOTS[i];
      expect(P[pid].pos.some((p) => (ok[slot] ?? [slot]).includes(p))).toBe(true);
    });
  });
});

describe("trade finder", () => {
  for (const seed of [11, 12, 13, 14, 15]) {
    it(`only suggests realistic trades (league ${seed})`, () => {
      const { P, T } = league(seed, 8, 14);
      for (const me of T) {
        const ideas = tradeFinder(me, T, P, NBA_SLOTS);
        expect(ideas.length).toBeLessThanOrEqual(8);
        const perTeam = new Map<string, number>();
        const gotten = new Set<string>();
        for (const i of ideas) {
          expect(i.partner).not.toBe(me.id);
          expect(i.meDelta).toBeGreaterThanOrEqual(5);
          expect(i.themDelta).toBeGreaterThanOrEqual(-3);
          expect(i.valueIn).toBeLessThanOrEqual(i.valueOut * 1.15 + 1e-9);
          expect(i.valueOut).toBeLessThanOrEqual(i.valueIn * 1.5 + 1e-9);
          for (const pid of [...i.give, ...i.get]) expect(P[pid].onIR).toBe(false);
          for (const pid of i.give) expect(me.players).toContain(pid);
          for (const pid of i.get) expect(T.find((t) => t.id === i.partner)!.players).toContain(pid);
          for (const pid of i.get) {
            expect(gotten.has(pid)).toBe(false);
            gotten.add(pid);
          }
          perTeam.set(i.partner, (perTeam.get(i.partner) ?? 0) + 1);
          // The trade analyzer agrees with the finder's numbers.
          const ev = evaluateTrade(i.give, i.get, me, T.find((t) => t.id === i.partner)!, P, NBA_SLOTS);
          expect(ev.meDelta).toBeCloseTo(i.meDelta, 6);
          expect(ev.themDelta).toBeCloseTo(i.themDelta, 6);
        }
        for (const n of perTeam.values()) expect(n).toBeLessThanOrEqual(2);
      }
    });
  }
});

describe("team analyzer", () => {
  it("full strength counts injured stars at full value; right now discounts them", () => {
    const pl = [player("a", ["PG"], 70, { injury: "Out" }), player("b", ["C"], 65, { onIR: true }), player("c", ["SF"], 30)];
    const t = { id: "t", team: "T", players: pl.map((p) => p.pid) };
    const P = Object.fromEntries(pl.map((p) => [p.pid, p]));
    const now = profile(t, P, NBA_SLOTS);
    const full = profile(t, P, NBA_SLOTS, "nba", fullStrength);
    expect(full.m.stars).toBe(165);
    expect(now.m.stars).toBeLessThan(full.m.stars);
    // Health measures who's actually available in both views.
    expect(now.m.health).toBe(full.m.health);
    expect(now.m.health).toBeLessThan(1);
  });

  it("full strength never calls Health a strength or a weakness", () => {
    const { P, T } = league(21);
    const all = T.map((t) => profile(t, P, NBA_SLOTS, "nba", fullStrength));
    for (const me of all) {
      const d = diagnose(me, all, P, T, [], NBA_SLOTS, "nba", true);
      expect(d.strengths).not.toContain("Health");
      expect(d.weaknesses).not.toContain("Health");
    }
  });
});

describe("stars over depth", () => {
  it("nobody gives the deal's best player for two lesser ones, even for more total value", () => {
    const v: Record<string, number> = { star: 70, a: 40, b: 40, c: 40, near: 65 };
    const w = (id: string) => v[id];
    expect(keepsStar(["star"], ["a", "b", "c"], w)).toBe(false); // 70 for three 40s: no
    expect(keepsStar(["star"], ["near", "a"], w)).toBe(true); // 70 for 65 + 40: someone close comes back
    expect(keepsStar(["a", "b"], ["star"], w)).toBe(true); // the side getting the star is fine
  });
  for (const seed of [11, 12, 13, 14, 15, 21, 22]) {
    it(`the finder never suggests giving up a team's best player for less (league ${seed})`, () => {
      const { P, T } = league(seed, 8, 14);
      const h = (id: string) => healthy(P[id]);
      for (const me of T)
        for (const i of tradeFinder(me, T, P, NBA_SLOTS)) {
          expect(keepsStar(i.get, i.give, h)).toBe(true);
          expect(keepsStar(i.give, i.get, h)).toBe(true);
        }
    });
  }
  it("the analyzer calls it a no when they'd lose the best player in the deal", () => {
    const pl = [player("s", ["PG"], 70), player("x", ["SF"], 40), player("y", ["C"], 40), player("z", ["PF"], 38)];
    const P = Object.fromEntries(pl.map((p) => [p.pid, p]));
    const me = { id: "me", team: "Me", players: ["x", "y"] };
    const them = { id: "th", team: "Them", players: ["s", "z"] };
    const r = evaluateTrade(["x", "y"], ["s"], me, them, P, NBA_SLOTS);
    expect(r.starLoss).toBe(true);
    expect(r.accept).toBe("unlikely");
  });
});

describe("trade analyzer health views", () => {
  it("fully healthy counts an injured player at full value; right now barely counts him", async () => {
    const { avail } = await import("@/lib/fo-analysis");
    const pl = [player("hurt", ["PG"], 70, { injury: "Out" }), player("x", ["SF"], 50), player("y", ["C"], 30), player("z", ["PF"], 30)];
    const P = Object.fromEntries(pl.map((p) => [p.pid, p]));
    const me = { id: "me", team: "Me", players: ["x", "y"] };
    const them = { id: "th", team: "Them", players: ["hurt", "z"] };
    const now = evaluateTrade(["x"], ["hurt"], me, them, P, NBA_SLOTS, 15, "nba", avail);
    const full = evaluateTrade(["x"], ["hurt"], me, them, P, NBA_SLOTS, 15, "nba", fullStrength);
    expect(full.meDelta).toBeGreaterThan(now.meDelta);
    expect(full.meDelta).toBeCloseTo(20, 5); // 70 in for 50 out
  });
});

describe("team analyzer labels", () => {
  it("a team with a top-third starting nine is never called 'Deep, no ceiling'", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { P, T } = league(seed);
      for (const worth of [undefined, fullStrength]) {
        const all = T.map((t) => profile(t, P, NBA_SLOTS, "nba", worth));
        for (const me of all) {
          const d = diagnose(me, all, P, T, [], NBA_SLOTS, "nba", !!worth);
          if (d.strengths.includes("Starting nine")) expect(d.archetype).not.toBe("Deep, no ceiling");
        }
      }
    }
  });
});

describe("power rankings momentum", () => {
  it("weights the last three results 3, 2, 1, newest first", async () => {
    const { momentumOf } = await import("@/lib/core/power");
    expect(momentumOf(undefined)).toBeNull();
    expect(momentumOf("")).toBeNull();
    expect(momentumOf("LLLWWW")).toBe(1);
    expect(momentumOf("WWWLLL")).toBe(0);
    expect(momentumOf("LLW")).toBeCloseTo(3 / 6);
    expect(momentumOf("WWL")).toBeCloseTo(3 / 6);
    expect(momentumOf("LWW")).toBeCloseTo(5 / 6);
    expect(momentumOf("W")).toBe(1);
    expect(momentumOf("WT")).toBeCloseTo((3 * 0.5 + 2) / 5);
  });
});
