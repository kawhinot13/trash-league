import { describe, expect, it } from "vitest";
import { buyCost, dividend, fairValues, hoodiePrice, netWorth, sellValue, spot, tickers, START_BUCKS } from "@/packs/trash/market/math";

const rec = (team: string, wins: number, losses: number, pf: number, ties = 0) => ({ team, wins, losses, ties, pf });

describe("Trash Exchange", () => {
  it("an average team is worth 100 BB, and values sit at 100 before any games", () => {
    const pre = fairValues([rec("a", 0, 0, 0), rec("b", 0, 0, 0)]);
    expect(pre.get("a")).toBe(10_000);
    const mid = fairValues([rec("a", 5, 5, 1000), rec("b", 5, 5, 1000)]);
    expect(mid.get("a")).toBe(10_000);
  });

  it("better teams are worth more, and the record matters", () => {
    const v = fairValues([rec("good", 8, 2, 1150), rec("avg", 5, 5, 1000), rec("bad", 2, 8, 850)]);
    expect(v.get("good")!).toBeGreaterThan(v.get("avg")!);
    expect(v.get("avg")!).toBeGreaterThan(v.get("bad")!);
    const luck = fairValues([rec("lucky", 8, 2, 1000), rec("unlucky", 2, 8, 1000)]);
    expect(luck.get("lucky")!).toBeGreaterThan(luck.get("unlucky")!);
  });

  it("a buy then a sell at the same value gives back exactly what it cost", () => {
    for (const [fair, held, n] of [[10_000, 0, 7], [13_377, 25, 40], [6_100, 3, 1]]) {
      const cost = buyCost(fair, held, n);
      expect(sellValue(fair, held + n, n)).toBe(cost);
    }
  });

  it("buying pushes the price up; splitting an order costs the same as one order", () => {
    expect(spot(10_000, 50)).toBeGreaterThan(spot(10_000, 0));
    const one = buyCost(10_000, 0, 10);
    const two = buyCost(10_000, 0, 4) + buyCost(10_000, 4, 6);
    expect(Math.abs(one - two)).toBeLessThanOrEqual(1);
    expect(buyCost(10_000, 0, 1)).toBeGreaterThanOrEqual(10_000);
  });

  it("wins pay one Perren Coin per share, ties half, and a reset pays nothing", () => {
    expect(dividend(undefined, rec("a", 3, 0, 0))).toBe(0);
    expect(dividend(rec("a", 3, 2, 0), rec("a", 4, 2, 0))).toBe(100);
    expect(dividend(rec("a", 3, 2, 0), rec("a", 3, 3, 0))).toBe(0);
    expect(dividend(rec("a", 3, 2, 0), rec("a", 3, 2, 0, 1))).toBe(50);
    expect(dividend(rec("a", 9, 9, 0), rec("a", 0, 0, 0))).toBe(0);
  });

  it("each hoodie sold makes the next one dearer", () => {
    expect(hoodiePrice(0)).toBe(1_000);
    expect(hoodiePrice(5)).toBe(1_500);
  });

  it("net worth counts cash, shares at their sell value and coin", () => {
    const fair = new Map([["a", 10_000]]);
    const held = new Map([["a", 10]]);
    const w = netWorth({ bucks: START_BUCKS - buyCost(10_000, 0, 10), coins: 0 }, [{ team: "a", shares: 10 }], fair, held);
    expect(w).toBe(START_BUCKS);
  });

  it("tickers are short, upper case and unique", () => {
    const t = tickers([["1", "Junkyard Dog"], ["2", "Goodie"], ["3", "Good Guy"], ["4", "Goodies"]]);
    expect(t.get("1")).toBe("JD");
    expect(t.get("2")).toBe("GOOD");
    expect(new Set(t.values()).size).toBe(4);
    for (const v of t.values()) expect(v).toMatch(/^[A-Z0-9]{2,4}$/);
  });
});

describe("Trash Exchange history", () => {
  it("fills days before the market from saved official totals; market prices win where both exist", async () => {
    const { priceHistory } = await import("@/packs/trash/market/math");
    const snaps = [
      { day: "2026-11-01", ...rec("a", 1, 0, 120) }, { day: "2026-11-01", ...rec("b", 0, 1, 80) },
      { day: "2026-11-02", ...rec("a", 1, 0, 120) }, // b missing that night: day skipped
      { day: "2026-11-03", ...rec("a", 1, 1, 200) }, { day: "2026-11-03", ...rec("b", 1, 1, 200) },
    ];
    const h = priceHistory([{ day: "2026-11-03", team: "a", price: 12_345 }], snaps);
    expect(h.get("a")!.map((x) => x.d)).toEqual(["2026-11-01", "2026-11-03"]);
    expect(h.get("a")![0].p).toBeGreaterThan(h.get("b")![0].p);
    expect(h.get("a")![1].p).toBe(12_345);
    expect(h.get("b")![1].p).toBe(10_000);
  });
});

describe("Trash Exchange week-by-week backfill", () => {
  const teams = [
    { team: "a", record: "WWLW" },
    { team: "b", record: "LLWL" },
  ];
  const pts = new Map([["a", [100, 110, 120, 999]], ["b", [90, 80, 70, 999]]]);

  it("rebuilds week 0 up to the first saved night when the weekly scores add up to the official totals", async () => {
    const { weeklyBackfill } = await import("@/packs/trash/market/math");
    // First saved night: Wed 2026-11-11 with 3 weeks done -> week 3 ended Sun 2026-11-08.
    const out = weeklyBackfill(teams, pts, "2026-11-11", 3, new Map([["a", 330], ["b", 240]]));
    const a = out.filter((x) => x.team === "a");
    expect(a.map((x) => x.w)).toEqual([0, 1, 2]);
    expect(a.map((x) => x.day)).toEqual(["2026-10-18", "2026-10-25", "2026-11-01"]);
    expect(a[0]).toMatchObject({ wins: 0, losses: 0, pf: 0 });
    expect(a[2]).toMatchObject({ wins: 2, losses: 0, pf: 210 });
  });

  it("rebuilds nothing when any team's weekly scores miss its official total", async () => {
    const { weeklyBackfill } = await import("@/packs/trash/market/math");
    expect(weeklyBackfill(teams, pts, "2026-11-11", 3, new Map([["a", 330], ["b", 241.5]]))).toEqual([]);
    expect(weeklyBackfill(teams, new Map([["a", [100, 110, 120]], ["b", [90, 80]]]), "2026-11-11", 3, new Map([["a", 330], ["b", 240]]))).toEqual([]);
  });
});
