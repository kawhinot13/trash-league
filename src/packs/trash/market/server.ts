import "server-only";
import { cacheLife } from "next/cache";
import { db } from "@/lib/app/db";
import { sleeper, official, type SRoster } from "@/lib/app/sleeper";
import { familyIdOf, newestSeason, packOf } from "@/lib/app/store";
import { loadPack } from "@/packs";
import {
  buyCost, COIN_RATE, dividend, fairValues, hoodiePrice, MAX_QTY, netWorth, sellValue, spot, START_BUCKS, tickers, type TeamRecord,
} from "@/packs/trash/market/math";

/**
 * The Trash Exchange, server side (Trash pack only). Prices come from Sleeper's official season
 * totals for the current season; every read first settles any new official results (dividends)
 * under a per-league lock, so a payout happens once however many people are looking.
 */
type Sql = Awaited<ReturnType<typeof db>>;

/** The current Trash season for a league id, or null when the league isn't Trash's. */
export async function marketSeason(leagueId: string) {
  const fid = await familyIdOf(leagueId);
  if (!fid || (await packOf(fid)) !== "trash") return null;
  const s = await newestSeason(fid);
  return s ? { familyId: fid, ...s } : null;
}

async function rosters(leagueId: string): Promise<SRoster[]> {
  "use cache: remote";
  cacheLife({ stale: 60, revalidate: 120, expire: 600 });
  return sleeper<SRoster[]>(`/v1/league/${leagueId}/rosters`);
}

async function records(leagueId: string): Promise<TeamRecord[]> {
  const rs = await rosters(leagueId);
  return rs.flatMap((r) =>
    r.owner_id
      ? [{ team: r.owner_id, wins: r.settings?.wins ?? 0, losses: r.settings?.losses ?? 0, ties: r.settings?.ties ?? 0, pf: official(r.settings ?? {}).pf }]
      : [],
  );
}

const todayET = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

async function heldByTeam(tx: Sql, lid: string): Promise<Map<string, number>> {
  const rows = await tx<{ team: string; n: string }[]>`select team, sum(shares)::text as n from market_holdings where league_id = ${lid} group by team`;
  return new Map(rows.map((r) => [r.team, Number(r.n)]));
}

/** Pay dividends for official results since the last check, save today's prices. Call inside a transaction. */
async function settle(tx: Sql, lid: string, recs: TeamRecord[]) {
  await tx`select pg_advisory_xact_lock(hashtext(${"market:" + lid}))`;
  const before = new Map(
    (await tx<{ team: string; wins: number; losses: number; ties: number; pf: string }[]>`
      select team, wins, losses, ties, pf from market_teams where league_id = ${lid}`).map((r) => [r.team, { ...r, pf: Number(r.pf) }]),
  );
  for (const r of recs) {
    const per = dividend(before.get(r.team), r);
    if (per > 0) {
      const holders = await tx<{ manager: string; shares: number }[]>`
        select manager, shares from market_holdings where league_id = ${lid} and team = ${r.team} and shares > 0`;
      for (const h of holders) {
        const amount = per * h.shares;
        await tx`update market_wallets set coins = coins + ${amount} where league_id = ${lid} and manager = ${h.manager}`;
        await tx`insert into market_log (league_id, manager, kind, team, qty, amount) values (${lid}, ${h.manager}, 'dividend', ${r.team}, ${h.shares}, ${amount})`;
      }
    }
    const b = before.get(r.team);
    if (!b || b.wins !== r.wins || b.losses !== r.losses || b.ties !== r.ties || Math.abs(b.pf - r.pf) > 0.001)
      await tx`
        insert into market_teams (league_id, team, wins, losses, ties, pf) values (${lid}, ${r.team}, ${r.wins}, ${r.losses}, ${r.ties}, ${r.pf})
        on conflict (league_id, team) do update set wins = excluded.wins, losses = excluded.losses, ties = excluded.ties, pf = excluded.pf, synced_at = now()`;
  }
  return savePrices(tx, lid, recs);
}

/** Today's closing price for every team (the latest one of the day stands). */
async function savePrices(tx: Sql, lid: string, recs: TeamRecord[]) {
  const fair = fairValues(recs);
  const held = await heldByTeam(tx, lid);
  const day = todayET();
  for (const [team, f] of fair)
    await tx`
      insert into market_prices (league_id, team, day, price) values (${lid}, ${team}, ${day}::date, ${spot(f, held.get(team) ?? 0)})
      on conflict (league_id, team, day) do update set price = excluded.price`;
  return { fair, held };
}

/** Whether anything needs writing: new official results, or no prices saved yet today. Reads only. */
async function needsSettle(sql: Sql, lid: string, recs: TeamRecord[]) {
  const rows = await sql<{ team: string; wins: number; losses: number; ties: number; pf: string; priced: boolean }[]>`
    select t.team, t.wins, t.losses, t.ties, t.pf::text,
      exists (select 1 from market_prices p where p.league_id = t.league_id and p.team = t.team and p.day = ${todayET()}::date) as priced
    from market_teams t where t.league_id = ${lid}`;
  const by = new Map(rows.map((r) => [r.team, r]));
  return recs.some((r) => {
    const b = by.get(r.team);
    return !b || !b.priced || b.wins !== r.wins || b.losses !== r.losses || b.ties !== r.ties || Math.abs(Number(b.pf) - r.pf) > 0.001;
  });
}

export type MarketState = Awaited<ReturnType<typeof marketState>>;

/** Everything the board shows, plus the viewer's wallet when they're one of the league's managers. */
export async function marketState(leagueId: string, season: NonNullable<Awaited<ReturnType<typeof marketSeason>>>, manager: string | null) {
  const lid = season.leagueId;
  const recs = await records(lid);
  const sql = await db();
  // Most views write nothing: only new official results (dividends), a new day's prices or a
  // manager's first visit (their desk) open a write.
  if (await needsSettle(sql, lid, recs)) await sql.begin((tx) => settle(tx as unknown as Sql, lid, recs));
  if (manager && season.users.has(manager))
    await sql`insert into market_wallets (league_id, manager, bucks) values (${lid}, ${manager}, ${START_BUCKS}) on conflict do nothing`;
  const fair = fairValues(recs);
  const held = await heldByTeam(sql, lid);
  const pack = await loadPack("trash");
  const nameOf = (id: string) => {
    const dn = season.names.get(id) ?? id;
    return pack?.nicknames[dn] ?? dn;
  };
  const tick = tickers(recs.map((r) => [r.team, nameOf(r.team)]));
  const since = new Date(Date.now() - 45 * 86_400_000).toISOString().slice(0, 10);
  const [prices, wallets, holdings, log] = await Promise.all([
    sql<{ team: string; day: Date; price: string }[]>`select team, day, price::text from market_prices where league_id = ${lid} and day >= ${since}::date order by day`,
    sql<{ manager: string; bucks: string; coins: string; hoodies: number }[]>`select manager, bucks::text, coins::text, hoodies from market_wallets where league_id = ${lid}`,
    sql<{ manager: string; team: string; shares: number }[]>`select manager, team, shares from market_holdings where league_id = ${lid} and shares > 0`,
    sql<{ manager: string; kind: string; team: string | null; qty: number; amount: string; at: Date }[]>`
      select manager, kind, team, qty, amount::text, at from market_log where league_id = ${lid} and kind <> 'dividend' order by at desc limit 12`,
  ]);
  const history = new Map<string, number[]>();
  for (const p of prices) (history.get(p.team) ?? history.set(p.team, []).get(p.team)!).push(Number(p.price));
  const teams = recs
    .map((r) => {
      const f = fair.get(r.team)!;
      const h = held.get(r.team) ?? 0;
      const hist = history.get(r.team) ?? [];
      const price = spot(f, h);
      const weekAgo = hist.length > 7 ? hist[hist.length - 8] : (hist[0] ?? price);
      return {
        id: r.team, ticker: tick.get(r.team)!, name: nameOf(r.team), team: season.teams.get(r.team) ?? null,
        record: `${r.wins}-${r.losses}${r.ties ? `-${r.ties}` : ""}`, pf: Math.round(r.pf),
        fair: f, held: h, price, buy1: buyCost(f, h, 1), sell1: h > 0 ? sellValue(f, h, 1) : 0,
        change: weekAgo ? (price - weekAgo) / weekAgo : 0, history: hist.slice(-30),
      };
    })
    .sort((a, b) => b.price - a.price);
  const hoodiesSold = wallets.reduce((s, w) => s + w.hoodies, 0);
  const holdOf = (m: string) => holdings.filter((h) => h.manager === m).map((h) => ({ team: h.team, shares: h.shares }));
  const standings = wallets
    .map((w) => ({
      manager: w.manager, name: nameOf(w.manager), hoodies: w.hoodies,
      worth: netWorth({ bucks: Number(w.bucks), coins: Number(w.coins) }, holdOf(w.manager), fair, held),
    }))
    .sort((a, b) => b.hoodies - a.hoodies || b.worth - a.worth);
  const mine = manager ? wallets.find((w) => w.manager === manager) : undefined;
  return {
    teams,
    hoodiesSold,
    nextHoodie: hoodiePrice(hoodiesSold),
    coinRate: COIN_RATE,
    standings,
    feed: log.map((l) => ({ name: nameOf(l.manager), kind: l.kind, ticker: l.team ? (tick.get(l.team) ?? null) : null, qty: l.qty, amount: Number(l.amount), at: l.at.toISOString() })),
    wallet: mine
      ? { bucks: Number(mine.bucks), coins: Number(mine.coins), hoodies: mine.hoodies, holdings: holdOf(manager!), worth: standings.find((s) => s.manager === manager)?.worth ?? 0 }
      : null,
    status: season.users.size ? "open" : "closed",
  };
}

export type Order = { kind: "buy" | "sell"; team: string; qty: number } | { kind: "coin"; qty: number } | { kind: "hoodie"; qty: number };

/** One order for one manager, all or nothing. Returns a plain message on refusal. */
export async function placeOrder(season: NonNullable<Awaited<ReturnType<typeof marketSeason>>>, manager: string, o: Order): Promise<{ ok: true } | { ok: false; error: string }> {
  const lid = season.leagueId;
  if (!Number.isInteger(o.qty) || o.qty < 1 || o.qty > MAX_QTY) return { ok: false, error: "Pick an amount between 1 and 500." };
  const recs = await records(lid);
  const sql = await db();
  return sql.begin(async (t) => {
    const tx = t as unknown as Sql;
    const { fair, held } = await settle(tx, lid, recs);
    await tx`insert into market_wallets (league_id, manager, bucks) values (${lid}, ${manager}, ${START_BUCKS}) on conflict do nothing`;
    const [recent] = await tx<{ n: number }[]>`
      select count(*)::int as n from market_log where league_id = ${lid} and manager = ${manager} and kind <> 'dividend' and at > now() - interval '1 minute'`;
    if (recent.n >= 30) return { ok: false as const, error: "Easy, trader. Too many orders in a minute; try again shortly." };
    const [w] = await tx<{ bucks: string; coins: string; hoodies: number }[]>`
      select bucks::text, coins::text, hoodies from market_wallets where league_id = ${lid} and manager = ${manager} for update`;
    const bucks = Number(w.bucks);
    const coins = Number(w.coins);
    if (o.kind === "buy" || o.kind === "sell") {
      const f = fair.get(o.team);
      if (!f) return { ok: false as const, error: "That team isn't on the board." };
      const h = held.get(o.team) ?? 0;
      if (o.kind === "buy") {
        const cost = buyCost(f, h, o.qty);
        if (cost > bucks) return { ok: false as const, error: "Not enough Bushy Bucks for that." };
        await tx`update market_wallets set bucks = bucks - ${cost} where league_id = ${lid} and manager = ${manager}`;
        await tx`
          insert into market_holdings (league_id, manager, team, shares) values (${lid}, ${manager}, ${o.team}, ${o.qty})
          on conflict (league_id, manager, team) do update set shares = market_holdings.shares + excluded.shares`;
        await tx`insert into market_log (league_id, manager, kind, team, qty, amount) values (${lid}, ${manager}, 'buy', ${o.team}, ${o.qty}, ${cost})`;
      } else {
        const [mine] = await tx<{ shares: number }[]>`
          select shares from market_holdings where league_id = ${lid} and manager = ${manager} and team = ${o.team} for update`;
        if (!mine || mine.shares < o.qty) return { ok: false as const, error: "You don't have that many shares." };
        const pay = sellValue(f, h, o.qty);
        await tx`update market_wallets set bucks = bucks + ${pay} where league_id = ${lid} and manager = ${manager}`;
        await tx`update market_holdings set shares = shares - ${o.qty} where league_id = ${lid} and manager = ${manager} and team = ${o.team}`;
        await tx`insert into market_log (league_id, manager, kind, team, qty, amount) values (${lid}, ${manager}, 'sell', ${o.team}, ${o.qty}, ${pay})`;
      }
    } else if (o.kind === "coin") {
      const cost = COIN_RATE * o.qty;
      if (cost > bucks) return { ok: false as const, error: "Not enough Bushy Bucks for that much Perren Coin." };
      await tx`update market_wallets set bucks = bucks - ${cost}, coins = coins + ${o.qty * 100} where league_id = ${lid} and manager = ${manager}`;
      await tx`insert into market_log (league_id, manager, kind, qty, amount) values (${lid}, ${manager}, 'coin', ${o.qty}, ${cost})`;
    } else {
      const [{ sold }] = await tx<{ sold: number }[]>`select coalesce(sum(hoodies), 0)::int as sold from market_wallets where league_id = ${lid}`;
      let cost = 0;
      for (let i = 0; i < o.qty; i++) cost += hoodiePrice(sold + i);
      if (cost > coins) return { ok: false as const, error: "Not enough Perren Coin for that." };
      await tx`update market_wallets set coins = coins - ${cost}, hoodies = hoodies + ${o.qty} where league_id = ${lid} and manager = ${manager}`;
      await tx`insert into market_log (league_id, manager, kind, qty, amount) values (${lid}, ${manager}, 'hoodie', ${o.qty}, ${cost})`;
    }
    // The day's price follows the order (demand moves it).
    await savePrices(tx, lid, recs);
    return { ok: true as const };
  });
}
