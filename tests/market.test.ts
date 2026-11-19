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

describe("Trash Exchange coin only for shares owned before the week", () => {
  it("counts only shares bought before the week started", async () => {
    const { ownedBefore } = await import("@/packs/trash/market/math");
    const monday = Date.parse("2026-11-16T05:00:00Z");
    const lots = [
      { id: 1, shares: 5, at: monday - 3_600_000 },
      { id: 2, shares: 20, at: monday + 5 * 86_400_000 },
    ];
    expect(ownedBefore(lots, monday)).toBe(5);
    expect(ownedBefore(lots, monday + 7 * 86_400_000)).toBe(25);
  });

  it("selling takes the newest shares first and refuses more than you own", async () => {
    const { sellNewestFirst } = await import("@/packs/trash/market/math");
    const lots = [
      { id: 1, shares: 5, at: 1 },
      { id: 2, shares: 20, at: 2 },
    ];
    expect(sellNewestFirst(lots, 22)).toEqual([{ id: 2, shares: 0 }, { id: 1, shares: 3 }]);
    expect(sellNewestFirst(lots, 4)).toEqual([{ id: 2, shares: 16 }]);
    expect(sellNewestFirst(lots, 26)).toBeNull();
  });
});

describe("Trash Exchange underdogs pay more", () => {
  it("pays opponent value ÷ winner value, between 0.5 and 3", async () => {
    const { upset, payoutPerShare } = await import("@/packs/trash/market/math");
    expect(upset(6_900, 12_400)).toBeCloseTo(1.797, 2); // Rico beats KawhiNot
    expect(upset(12_400, 6_900)).toBeCloseTo(0.556, 2); // KawhiNot beats Rico
    expect(upset(10_000, 10_000)).toBe(1);
    expect(upset(5_000, 40_000)).toBe(3);
    expect(upset(40_000, 5_000)).toBe(0.5);
    const b = rec("r", 0, 3, 300);
    expect(payoutPerShare(b, rec("r", 1, 3, 420), 6_900, 12_400)).toBe(180);
    expect(payoutPerShare(b, rec("r", 0, 3, 300, 1), 6_900, 12_400)).toBe(90); // a tie pays half
    expect(payoutPerShare(b, rec("r", 1, 3, 420))).toBe(100); // opponent unknown: flat
    expect(payoutPerShare(b, rec("r", 2, 3, 520), 6_900, 12_400)).toBe(200); // two results at once: flat
    expect(payoutPerShare(b, rec("r", 0, 4, 400), 6_900, 12_400)).toBe(0);
  });
});

describe("Trash Exchange player stocks", () => {
  it("cost the player's average per game, pulled toward 15 early, never under 1 BB", async () => {
    const { playerFair, isPlayer } = await import("@/packs/trash/market/math");
    expect(playerFair(600, 10)).toBe(6_000); // 60 a game
    expect(playerFair(60, 1)).toBe(2_400); // one 60-point night: (60 + 4 x 15) / 5
    expect(playerFair(0, 0)).toBe(1_500);
    expect(playerFair(1, 10)).toBe(100);
    expect(isPlayer("p:1234")).toBe(true);
    expect(isPlayer("887869267151069184")).toBe(false);
  });
});

describe("Trash Exchange player stocks lock during games", () => {
  it("locks from tip-off (or 7 PM) until 6 AM Eastern the next day", async () => {
    const { lockedTeams } = await import("@/packs/trash/market/math");
    const games = [
      { date: "2026-11-20", status: "pre_game", teams: ["LAL", "GSW"] },
      { date: "2026-11-20", status: "in_progress", teams: ["BOS", "NYK"] },
      { date: "2026-11-19", status: "complete", teams: ["DEN", "PHX"] },
    ];
    expect([...lockedTeams(games, "2026-11-20", "2026-11-19", 15)].sort()).toEqual(["BOS", "NYK"]);
    expect([...lockedTeams(games, "2026-11-20", "2026-11-19", 4)].sort()).toEqual(["BOS", "DEN", "NYK", "PHX"]);
    expect([...lockedTeams(games, "2026-11-20", "2026-11-19", 20)].sort()).toEqual(["BOS", "GSW", "LAL", "NYK"]);
    expect([...lockedTeams(games, "2026-11-21", "2026-11-20", 7)]).toEqual([]);
    expect([...lockedTeams(games, "2026-11-21", "2026-11-20", 2)].sort()).toEqual(["BOS", "GSW", "LAL", "NYK"]);
  });
});

describe("Trash Exchange coin cash-in", () => {
  it("cashing in pays less than buying, and net worth counts coin at the cash-in rate", async () => {
    const { COIN_RATE, COIN_BACK, netWorth } = await import("@/packs/trash/market/math");
    expect(COIN_BACK).toBeLessThan(COIN_RATE);
    expect(netWorth({ bucks: 0, coins: 200 }, [], new Map(), new Map())).toBe(2 * COIN_BACK);
  });
});

describe("The Great Storm", () => {
  it("is worth the average of both teams and pays 1.5x when both win", async () => {
    const { stormFair, stormPayout } = await import("@/packs/trash/market/math");
    expect(stormFair(12_000, 11_000)).toBe(11_500);
    expect(stormPayout(100, 0, false)).toBe(50); // one wins
    expect(stormPayout(90, 110, true)).toBe(150); // Storm week
    expect(stormPayout(0, 0, false)).toBe(0);
  });
});

describe("Expected wins (over/under-performing)", () => {
  it("even points mean half the games; outscoring opponents means more", async () => {
    const { expectedWins } = await import("@/packs/trash/market/math");
    expect(expectedWins(1500, 1500, 4)).toBeCloseTo(2);
    expect(expectedWins(1600, 1400, 4)).toBeGreaterThan(3);
    expect(expectedWins(1400, 1600, 4)).toBeLessThan(1);
    expect(expectedWins(0, 0, 0)).toBe(0);
  });
});

describe("Trash Exchange shorts", () => {
  it("gain what the price fell, lose what it rose, never below 0 or above double", async () => {
    const { shortValue } = await import("@/packs/trash/market/math");
    expect(shortValue(5_000, 5_000, 2)).toBe(10_000); // unchanged: get your collateral back
    expect(shortValue(5_000, 4_000, 1)).toBe(6_000); // fell 10: +10
    expect(shortValue(5_000, 6_000, 1)).toBe(4_000); // rose 10: -10
    expect(shortValue(5_000, 12_000, 1)).toBe(0); // more than doubled: lose the collateral, no more
    expect(shortValue(5_000, 0, 1)).toBe(10_000); // to zero: double your money
  });
});

describe("Player prices follow recent form", () => {
  it("only the last 5 games count as recent", async () => {
    const { formFair } = await import("@/packs/trash/market/math");
    // 15 games of 40, then 5 at 70: season 47.5, last 5 = 70 -> 0.6*70 + 0.4*47.5 = 61
    expect(formFair([...Array(15).fill(40), ...Array(5).fill(70)])).toBe(6_100);
  });
  it("weights recent games 60/40 against the season, pulled toward 15 early", async () => {
    const { formFair } = await import("@/packs/trash/market/math");
    expect(formFair([])).toBe(1_500);
    expect(formFair(Array(20).fill(40))).toBe(4_000); // steady player: his average
    // 10 games of 30 then a 10-game hot streak at 60: season 45, last 10 = 60 -> 54
    expect(formFair([...Array(10).fill(30), ...Array(10).fill(60)])).toBe(5_400);
    // a slump moves it the other way
    expect(formFair([...Array(10).fill(60), ...Array(10).fill(30)])).toBe(3_600);
    expect(formFair([60])).toBe(2_400); // one big night early: (60 + 4 x 15) / 5
    expect(formFair([0.5, 0.5, 0.5, 0.5, 0.5, 0.5])).toBe(100); // never under 1 BB
  });
  it("starts a returning player from last season's level, a rookie from 15", async () => {
    const { formFair } = await import("@/packs/trash/market/math");
    expect(formFair([], 70)).toBe(7_000); // opening night: last season's average
    expect(formFair([], null)).toBe(1_500); // no history
    expect(formFair([40], 70)).toBe(6_400); // (40 + 4 x 70) / 5
    expect(formFair(Array(5).fill(40), 70)).toBe(4_000); // 5 games in: only this season counts
    expect(formFair(Array(20).fill(40), 70)).toBe(formFair(Array(20).fill(40)));
  });
});

describe("Team shorts follow the weekly schedule", () => {
  it("open now only on Monday before 7 PM ET once the result is in; pending ones fill at the new price", async () => {
    const { teamShortOpenNow, fillPending } = await import("@/packs/trash/market/math");
    expect(teamShortOpenNow(1, 10, true)).toBe(true);
    expect(teamShortOpenNow(1, 10, false)).toBe(false); // result not posted yet
    expect(teamShortOpenNow(1, 19, true)).toBe(false); // game time
    expect(teamShortOpenNow(6, 12, true)).toBe(false); // Saturday
    expect(fillPending(2, 24_000, 11_000)).toEqual({ shares: 2, refund: 2_000 }); // price fell: refund the rest
    expect(fillPending(2, 24_000, 13_000)).toEqual({ shares: 1, refund: 11_000 }); // price rose: fewer shares
    expect(fillPending(2, 24_000, 30_000)).toEqual({ shares: 0, refund: 24_000 });
  });
});

describe("Owner-chosen tickers", () => {
  it("win over made-up ones and stay unique", async () => {
    const { tickers } = await import("@/packs/trash/market/math");
    const t = tickers([["1", "Junkyard Dog"], ["2", "Jydd"], ["3", "Edizzle"]], new Map([["1", "JYD"], ["3", "DILL"]]));
    expect(t.get("1")).toBe("JYD");
    expect(t.get("3")).toBe("DILL");
    expect(t.get("2")).not.toBe("JYD");
    expect(new Set(t.values()).size).toBe(3);
  });
});

describe("Re-pricing past player trades", () => {
  it("prices each trade at that day's value with the league's holdings then, and settles the difference", async () => {
    const { repriceTrades, buyCost, sellValue } = await import("@/packs/trash/market/math");
    const fair = (_a: string, d: string) => (d === "2026-11-17" ? 3_000 : 2_500);
    const trades = [
      { id: "1", manager: "a", asset: "p:1", kind: "buy" as const, qty: 2, amount: 4_000, day: "2026-11-17" },
      { id: "2", manager: "b", asset: "p:1", kind: "buy" as const, qty: 1, amount: 2_200, day: "2026-11-18" },
      { id: "3", manager: "a", asset: "p:1", kind: "sell" as const, qty: 1, amount: 2_300, day: "2026-11-18" },
    ];
    const { amounts, owed } = repriceTrades(trades, fair);
    expect(amounts.get("1")).toBe(buyCost(3_000, 0, 2));
    expect(amounts.get("2")).toBe(buyCost(2_500, 2, 1));
    expect(amounts.get("3")).toBe(sellValue(2_500, 3, 1));
    expect(owed.get("a")).toBe(4_000 - buyCost(3_000, 0, 2) + (sellValue(2_500, 3, 1) - 2_300));
    expect(owed.get("b")).toBe(2_200 - buyCost(2_500, 2, 1));
  });
});
