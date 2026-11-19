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
export const COIN_RATE = 4_000; // 40.00 BB buys 1 Perren Coin
/** Cashing coin back pays less (30 BB), so coin's natural use is hoodies and swaps can't loop for free. */
export const COIN_BACK = 3_000;
export const HOODIE_BASE = 1_000; // 10.00 PC for the first hoodie
export const HOODIE_STEP = 100; // +1.00 PC for every hoodie already sold in the league
export const IMPACT = 0.004; // each share held league-wide adds 0.4% to the price
export const MAX_QTY = 500;

export type TeamRecord = { team: string; wins: number; losses: number; ties: number; pf: number; pa?: number };

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

/**
 * Underdogs pay more. A win pays (opponent's value ÷ the winner's value) coins per share, both as
 * they stood before that week's result, between 0.5 and 3: beating a much better team pays up to
 * 3, beating a much worse one as little as 0.5, an even matchup about 1. Values come only from
 * official totals, so the multiplier is the same however the market traded.
 */
export const UPSET_MIN = 0.5;
export const UPSET_MAX = 3;
export const upset = (own: number, opp: number) => (own > 0 && opp > 0 ? Math.min(UPSET_MAX, Math.max(UPSET_MIN, opp / own)) : 1);

/**
 * Coin per share (hundredths) for one team's new result: the flat dividend, scaled by the upset
 * multiplier when exactly one game was added and the opponent is known; otherwise the flat amount.
 */
export function payoutPerShare(before: TeamRecord | undefined, now: TeamRecord, ownBefore?: number, oppBefore?: number): number {
  const base = dividend(before, now);
  if (!base || !before) return base;
  const games = now.wins + now.losses + now.ties - (before.wins + before.losses + before.ties);
  if (games !== 1 || ownBefore === undefined || oppBefore === undefined) return base;
  return Math.round(base * upset(ownBefore, oppBefore));
}

/** Net worth in Bushy Bucks (hundredths): cash, shares at what selling them all would pay, coin at what cashing it in pays. */
export function netWorth(
  w: { bucks: number; coins: number },
  holdings: { team: string; shares: number }[],
  fair: Map<string, number>,
  held: Map<string, number>,
): number {
  // Coin counts at what cashing it in would pay.
  let total = w.bucks + Math.round((w.coins * COIN_BACK) / 100);
  for (const h of holdings) {
    const f = fair.get(h.team);
    if (f && h.shares > 0) total += sellValue(f, held.get(h.team) ?? h.shares, h.shares);
  }
  return total;
}

/** Short tickers from what the league calls each manager: "Junkyard Dog" -> "JD", "Goodie" -> "GOOD". Unique. */
/** Owner-chosen tickers, by Sleeper username (lower case). Everyone else gets one made from their nickname. */
export const TICKERS: Record<string, string> = {
  junkyarddoggg: "JYD",
  edizzle6: "DILL",
  llazaris7: "LAZ",
  absbrainscells: "JRIV",
  milesbridgessgf: "LINR",
};

export function tickers(names: [string, string][], fixed: Map<string, string> = new Map()): Map<string, string> {
  const out = new Map<string, string>();
  const used = new Set<string>(fixed.values());
  for (const [id, t] of fixed) out.set(id, t);
  for (const [id, name] of names) {
    if (out.has(id)) continue;
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
 * Price history per team, oldest first: the market's own closing prices where it has them, and
 * before that the fair value from each night's saved official totals (a night counts only when
 * every team was saved). Points carrying `w` are week ends rebuilt by weeklyBackfill.
 */
export function priceHistory(
  prices: { day: string; team: string; price: number }[],
  snaps: (TeamRecord & { day: string; w?: number })[],
): Map<string, { d: string; p: number; w?: number }[]> {
  const byDay = new Map<string, Map<string, number>>();
  const weekOf = new Map<string, number>();
  const teams = new Set(snaps.map((s) => s.team));
  const snapDays = new Map<string, TeamRecord[]>();
  for (const s of snaps) {
    (snapDays.get(s.day) ?? snapDays.set(s.day, []).get(s.day)!).push(s);
    if (s.w !== undefined) weekOf.set(s.day, s.w);
  }
  for (const [day, recs] of snapDays) {
    if (recs.length < teams.size) continue;
    byDay.set(day, fairValues(recs));
  }
  for (const p of prices) (byDay.get(p.day) ?? byDay.set(p.day, new Map()).get(p.day)!).set(p.team, p.price);
  const out = new Map<string, { d: string; p: number; w?: number }[]>();
  for (const day of [...byDay.keys()].sort())
    for (const [team, p] of byDay.get(day)!) {
      const w = weekOf.get(day);
      (out.get(team) ?? out.set(team, []).get(team)!).push(w === undefined ? { d: day, p } : { d: day, p, w });
    }
  return out;
}

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * The season before the nightly saves began, one point per finished week from week 0 (everyone
 * 0-0, 100 BB), but only when it can be checked: records are official (Sleeper's week-by-week
 * record string, "WLWW"), and the weekly scores (Sleeper's matchups) must add up, for every team, to
 * the official total saved on the first night (`officialAt`, after `weeksAtFirst` weeks). If any
 * team's don't, nothing is rebuilt and the history starts at that first saved night. Weeks end on
 * Sundays; the Sunday before the first saved night ends week `weeksAtFirst`.
 */
export function weeklyBackfill(
  teams: { team: string; record: string }[],
  weekPts: Map<string, number[]>,
  firstDay: string,
  weeksAtFirst: number,
  officialAt: Map<string, number>,
): (TeamRecord & { day: string; w: number })[] {
  if (!teams.length || weeksAtFirst < 1) return [];
  for (const t of teams) {
    const pts = weekPts.get(t.team) ?? [];
    if (t.record.length < weeksAtFirst) return [];
    let sum = 0;
    for (let j = 0; j < weeksAtFirst; j++) {
      if (typeof pts[j] !== "number") return [];
      sum += pts[j];
    }
    const off = officialAt.get(t.team);
    if (off === undefined || Math.abs(sum - off) >= 0.06) return [];
  }
  let end = addDays(firstDay, -1);
  while (new Date(`${end}T12:00:00Z`).getUTCDay() !== 0) end = addDays(end, -1);
  const out: (TeamRecord & { day: string; w: number })[] = [];
  for (const t of teams) {
    const pts = weekPts.get(t.team)!;
    let pf = 0;
    let wins = 0;
    let losses = 0;
    let ties = 0;
    // Week `weeksAtFirst` itself is the first saved night's value; rebuild the weeks before it.
    for (let j = 0; j < weeksAtFirst; j++) {
      if (j > 0) {
        pf += pts[j - 1];
        const r = t.record[j - 1];
        if (r === "W") wins++;
        else if (r === "L") losses++;
        else if (r === "T") ties++;
      }
      out.push({ team: t.team, day: addDays(end, -7 * (weeksAtFirst - j)), w: j, wins, losses, ties, pf: Math.round(pf * 100) / 100 });
    }
  }
  return out;
}

/**
 * Shares are kept as purchase lots (when they were bought). A week's coin goes only to shares
 * owned since before that week started, so buying once a win looks certain earns nothing that week.
 */
export type Lot = { id: number; shares: number; at: number };

/** Shares in these lots that were owned before `since` (ms). */
export const ownedBefore = (lots: Lot[], since: number) => lots.reduce((n, l) => n + (l.at < since ? l.shares : 0), 0);

/** Selling `qty` takes the newest shares first. Returns each lot's new size (0 = gone), or null if there aren't enough. */
export function sellNewestFirst(lots: Lot[], qty: number): { id: number; shares: number }[] | null {
  if (lots.reduce((n, l) => n + l.shares, 0) < qty) return null;
  const out: { id: number; shares: number }[] = [];
  let left = qty;
  for (const l of [...lots].sort((a, b) => b.at - a.at || b.id - a.id)) {
    if (!left) break;
    const take = Math.min(left, l.shares);
    out.push({ id: l.id, shares: l.shares - take });
    left -= take;
  }
  return out;
}

/**
 * Player stocks (Trash only). A share costs what the player averages in fantasy points per game this
 * season, in Bushy Bucks, scored with the league's own settings from real box scores. Early in the
 * season (under 5 games) the price is pulled toward 15 so one big night can't make it. Player stocks
 * pay no coin: they only rise and fall with how he plays.
 */
export const PLAYER = "p:";
export const isPlayer = (id: string) => id.startsWith(PLAYER);
export function playerFair(pts: number, games: number): number {
  const avg = games ? pts / games : 0;
  const v = games >= 5 ? avg : (games * avg + (5 - games) * 15) / 5;
  return Math.max(100, Math.round(v * 100));
}

/**
 * Player stocks lock while his team plays, so nobody trades on a game in progress before the price
 * catches up: from tip-off (or 7 PM Eastern on a game day, in case the game isn't marked started yet)
 * until 6 AM Eastern the next day, when the final box score is in.
 */
export type NbaGame = { date: string; status: string; teams: string[] };
export function lockedTeams(games: NbaGame[], today: string, yesterday: string, hourET: number): Set<string> {
  const out = new Set<string>();
  for (const g of games) {
    const live = g.date === today && (g.status !== "pre_game" || hourET >= 19);
    const overnight = g.date === yesterday && hourET < 6;
    if (live || overnight) for (const t of g.teams) out.add(t);
  }
  return out;
}

/**
 * The Great Storm (STORM): one stock for Junkyard Dog and KawhiNot together, the two teams that
 * warned the league before Season 4 that they were coming for the top. Its value is the average of
 * the two team values; each week it pays the average of what their shares pay, and 1.5 times that
 * in a Storm week (both of them win).
 */
export const STORM = "storm";
export const STORM_MEMBERS = ["junkyarddoggg", "kawhinot13"];
export const stormFair = (a: number, b: number) => Math.round((a + b) / 2);
export const stormPayout = (a: number, b: number, bothWon: boolean) => Math.round(((a + b) / 2) * (bothWon ? 1.5 : 1));

/**
 * Expected wins from official points for and against (basketball's Pythagorean expectation,
 * exponent 14): how many games a team "should" have won given what it scored and allowed. Actual
 * minus expected is luck: positive = over-performing its points, negative = under-performing.
 */
export function expectedWins(pf: number, pa: number, games: number): number {
  if (!games || pf <= 0 || pa <= 0) return games / 2;
  const a = Math.pow(pf, 14);
  return (games * a) / (a + Math.pow(pa, 14));
}

/**
 * Shorts (owner's call 2026-11-19). Opening puts up the stats-only value per share as collateral;
 * closing pays back 2 x that value minus the value then, never below 0 or above 2 x. So you gain what
 * the price fell, lose what it rose, and can't lose more than you put up. Shorts use the value without
 * buying demand (so pumping a stock can't set up a short) and earn or pay no coin.
 */
export const shortValue = (entry: number, now: number, shares: number) => shares * Math.max(0, Math.min(2 * entry, 2 * entry - now));

/**
 * Player price from recent form (owner's call 2026-11-19, last 5 from 11-20): 60% his average over his last 5 games
 * plus 40% his season average, so hot streaks and slumps move it within a week or two while one wild
 * night doesn't. Until he has 5 games it starts from last season's level (his average per game, if he
 * played PRIOR_GAMES+ games then), or 15 with no history (rookies), each game moving it a fifth of the
 * way to his own numbers (owner's call 2026-11-19); never under 1 BB. A player who isn't playing
 * (injured) adds no games, so his price holds where it was.
 */
/** How many recent games count for 60% of a player's price. */
export const RECENT_GAMES = 5;

/** Games last season needed for it to count as his starting level. */
export const PRIOR_GAMES = 10;

export function formFair(points: number[], prior?: number | null): number {
  const base = prior ?? 15;
  const n = points.length;
  if (!n) return Math.max(100, Math.round(base * 100));
  const season = points.reduce((a, b) => a + b, 0) / n;
  const recent = points.slice(-RECENT_GAMES);
  const last = recent.reduce((a, b) => a + b, 0) / recent.length;
  const avg = 0.6 * last + 0.4 * season;
  const v = n >= 5 ? avg : (n * avg + (5 - n) * base) / 5;
  return Math.max(100, Math.round(v * 100));
}

/**
 * Team shorts follow the weekly schedule (owner's call 2026-11-19): they open right away only on Monday
 * (Eastern) after last week's result has posted and before 7 PM game time. Otherwise they wait and open
 * at the price after the next result, so knowing who's winning late in a week is worth nothing.
 */
export const teamShortOpenNow = (weekdayET: number, hourET: number, resultPostedThisWeek: boolean) =>
  weekdayET === 1 && hourET < 19 && resultPostedThisWeek;

/** Filling a pending short at the new value: as many shares as the set-aside bucks cover (up to the order). */
export function fillPending(qty: number, reserved: number, value: number): { shares: number; refund: number } {
  const shares = value > 0 ? Math.min(qty, Math.floor(reserved / value)) : 0;
  return { shares, refund: reserved - shares * value };
}

/**
 * Re-pricing past player trades under the current formula (owner's call 2026-11-19, after the price
 * formula changed twice): replay each player's trades in order, with the league's holdings at the time,
 * and price each one from `fairAt` (his value that day under today's formula). Returns each trade's new
 * amount and, per manager, what they're owed (+) or owe (-).
 */
export type PastTrade = { id: string; manager: string; asset: string; kind: "buy" | "sell"; qty: number; amount: number; day: string };
export function repriceTrades(trades: PastTrade[], fairAt: (asset: string, day: string) => number) {
  const held = new Map<string, number>();
  const amounts = new Map<string, number>();
  const owed = new Map<string, number>();
  for (const t of trades) {
    const h = held.get(t.asset) ?? 0;
    const f = fairAt(t.asset, t.day);
    const now = t.kind === "buy" ? buyCost(f, h, t.qty) : sellValue(f, h, t.qty);
    amounts.set(t.id, now);
    // A cheaper buy (or a richer sell) is owed back to them; a dearer buy (or poorer sell) they owe.
    const diff = t.kind === "buy" ? t.amount - now : now - t.amount;
    owed.set(t.manager, (owed.get(t.manager) ?? 0) + diff);
    held.set(t.asset, Math.max(0, h + (t.kind === "buy" ? t.qty : -t.qty)));
  }
  return { amounts, owed };
}
