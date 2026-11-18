/**
 * The Trash Exchange: a play-money stock market on Trash's own teams (Trash pack only).
 *
 * Three currencies, none of them real:
 *  - Bushy Bucks (BB): cash. Everyone starts with START_BUCKS and buys and sells team shares with it.
 *  - Perren Coin (PC): dividends. Every official win pays one coin per share held (half for a tie).
 *    Bushy Bucks can also be swapped into coin at a fixed rate, one way.
 *  - Xan Purple Hoodies: bought with Perren Coin, never sold. Each one sold in the league makes the
 *    next one dearer. The standings rank hoodies first, then net worth.
 *
 * A team's value comes only from Sleeper's official season totals (points for and record), never
 * weekly matchup scores. Buying pushes the price up and selling brings it back down along the same
 * line, so a buy followed by a sell at the same value returns exactly what it cost (no free money).
 * All money is kept in hundredths (integers) so nothing drifts.
 */
export const START_BUCKS = 100_000; // 1,000.00 BB, in hundredths
export const COIN_RATE = 4_000; // 40.00 BB for 1 Perren Coin
export const HOODIE_BASE = 1_000; // 10.00 PC for the first hoodie
export const HOODIE_STEP = 100; // +1.00 PC for every hoodie already sold in the league
export const IMPACT = 0.004; // each share held league-wide adds 0.4% to the price
export const MAX_QTY = 500;

export type TeamRecord = { team: string; wins: number; losses: number; ties: number; pf: number };

/**
 * Fair value of every team in Bushy Bucks (hundredths), from official totals.
 * 100 BB is an average team. Points for against the league average count most (squared, so the
 * best teams stand out), the record scales it, and early in the season everything sits near 100
 * until there are games to go on.
 */
export function fairValues(teams: TeamRecord[]): Map<string, number> {
  const out = new Map<string, number>();
  const avg = teams.length ? teams.reduce((s, t) => s + t.pf, 0) / teams.length : 0;
  for (const t of teams) {
    const gp = t.wins + t.losses + t.ties;
    const pct = gp ? (t.wins + t.ties / 2) / gp : 0.5;
    const ratio = avg > 0 ? t.pf / avg : 1;
    const raw = 100 * ratio * ratio * (0.6 + 0.8 * pct);
    const w = gp / (gp + 4);
    const v = 100 + w * (raw - 100);
    out.set(t.team, Math.max(500, Math.round(v * 100)));
  }
  return out;
}

/** Price of the next share with `held` shares already owned league-wide. */
export const spot = (fair: number, held: number) => Math.round(fair * (1 + IMPACT * held));

/** Area under fair × (1 + IMPACT × x) from a to b, in hundredths. */
const area = (fair: number, a: number, b: number) => fair * ((b - a) + (IMPACT * (b * b - a * a)) / 2);

/** What `n` new shares cost when `held` are already owned. */
export const buyCost = (fair: number, held: number, n: number) => Math.round(area(fair, held, held + n));

/** What selling `n` shares pays when `held` are owned (n <= held). */
export const sellValue = (fair: number, held: number, n: number) => Math.round(area(fair, held - n, held));

/** The next hoodie's price in Perren Coin (hundredths). */
export const hoodiePrice = (sold: number) => HOODIE_BASE + HOODIE_STEP * sold;

/** Perren Coin per share (hundredths) that a team pays for the results since the last check. */
export function dividend(before: TeamRecord | undefined, now: TeamRecord): number {
  if (!before) return 0;
  const wins = Math.max(0, now.wins - before.wins);
  const ties = Math.max(0, now.ties - before.ties);
  // A season rollover or a corrected record (fewer games than before) pays nothing.
  if (now.wins + now.losses + now.ties < before.wins + before.losses + before.ties) return 0;
  return wins * 100 + ties * 50;
}

/** Net worth in Bushy Bucks (hundredths): cash, shares at what selling them all would pay, coin at the swap rate. */
export function netWorth(
  w: { bucks: number; coins: number },
  holdings: { team: string; shares: number }[],
  fair: Map<string, number>,
  held: Map<string, number>,
): number {
  let total = w.bucks + Math.round((w.coins * COIN_RATE) / 100);
  for (const h of holdings) {
    const f = fair.get(h.team);
    if (f && h.shares > 0) total += sellValue(f, held.get(h.team) ?? h.shares, h.shares);
  }
  return total;
}

/** Short tickers from what the league calls each manager: "Junkyard Dog" -> "JD", "Goodie" -> "GOOD". Unique. */
export function tickers(names: [string, string][]): Map<string, string> {
  const out = new Map<string, string>();
  const used = new Set<string>();
  for (const [id, name] of names) {
    const words = name.replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/).filter(Boolean);
    let t = words.length > 1 ? words.map((w) => w[0]).join("").slice(0, 4) : (words[0] ?? "TEAM").slice(0, 4);
    t = t.toUpperCase();
    if (t.length < 2) t = (words.join("") + "XX").slice(0, 3).toUpperCase();
    let u = t;
    for (let i = 2; used.has(u); i++) u = `${t.slice(0, 3)}${i}`;
    used.add(u);
    out.set(id, u);
  }
  return out;
}

/**
 * Daily price history per team: the market's own closing prices where it has them, and before
 * that the fair value from each night's saved official totals (a day counts only when every team
 * was saved, so values are compared like for like). Oldest first.
 */
export function priceHistory(
  prices: { day: string; team: string; price: number }[],
  snaps: (TeamRecord & { day: string })[],
): Map<string, { d: string; p: number }[]> {
  const byDay = new Map<string, Map<string, number>>();
  const teams = new Set(snaps.map((s) => s.team));
  const snapDays = new Map<string, TeamRecord[]>();
  for (const s of snaps) (snapDays.get(s.day) ?? snapDays.set(s.day, []).get(s.day)!).push(s);
  for (const [day, recs] of snapDays) {
    if (recs.length < teams.size) continue;
    byDay.set(day, fairValues(recs));
  }
  for (const p of prices) (byDay.get(p.day) ?? byDay.set(p.day, new Map()).get(p.day)!).set(p.team, p.price);
  const out = new Map<string, { d: string; p: number }[]>();
  for (const day of [...byDay.keys()].sort())
    for (const [team, p] of byDay.get(day)!) (out.get(team) ?? out.set(team, []).get(team)!).push({ d: day, p });
  return out;
}
