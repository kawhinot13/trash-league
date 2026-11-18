import "server-only";
import { cacheLife } from "next/cache";
import { db } from "@/lib/app/db";
import { sleeper, official, type SMatchup, type SRoster } from "@/lib/app/sleeper";
import { familyIdOf, newestSeason, packOf } from "@/lib/app/store";
import { loadPack } from "@/packs";
import { fantasyPoints } from "@/lib/app/replay";
import { playerDirectory, weekStats } from "@/lib/app/sleeper-cache";
import {
  buyCost, COIN_RATE, priceHistory, weeklyBackfill, dividend, payoutPerShare, upset, ownedBefore, isPlayer, playerFair, PLAYER, sellNewestFirst, type Lot, fairValues, hoodiePrice, MAX_QTY, netWorth, sellValue, spot, START_BUCKS, tickers, type TeamRecord,
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

async function leagueInfo(leagueId: string): Promise<{ season?: string; scoring_settings?: Record<string, number>; settings?: { playoff_week_start?: number } } | null> {
  "use cache: remote";
  cacheLife("hours");
  return sleeper(`/v1/league/${leagueId}`);
}

export type PlayerLine = {
  pid: string; name: string; pos: string[]; nba: string; owner: string | null; pts: number; games: number;
  /** Season totals [points, games] after each finished week, for the price chart. */
  weeks: [number, number][];
};

/**
 * Every player who is on a Trash roster or has played this season, with his fantasy points and games,
 * scored with the league's settings from Sleeper's box scores (the real game stats, not its weekly
 * matchup totals). Players who leave a roster stay priced, so their shares can always be sold.
 * Throws rather than return a wrong board, so a bad fetch is never cached or saved as prices.
 */
async function playerBoard(leagueId: string, week: number): Promise<PlayerLine[]> {
  "use cache: remote";
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  const [rs, lg, dir] = await Promise.all([rosters(leagueId), leagueInfo(leagueId), playerDirectory("nba")]);
  if (!lg?.season || !lg.scoring_settings) throw new Error(`league ${leagueId} has no season or scoring`);
  const sc = lg.scoring_settings;
  const owner = new Map<string, string | null>();
  for (const r of rs) for (const pid of r.players ?? []) owner.set(pid, r.owner_id);
  const weeks = await Promise.all(Array.from({ length: week }, (_, i) => weekStats(lg.season!, i + 1, i + 1 < week)));
  const tot = new Map<string, { pts: number; games: number }>();
  const after = new Map<string, [number, number][]>();
  weeks.forEach((rows, i) => {
    for (const row of rows) {
      if (!dir[row.player_id] && !owner.has(row.player_id)) continue;
      const t = tot.get(row.player_id) ?? tot.set(row.player_id, { pts: 0, games: 0 }).get(row.player_id)!;
      t.pts += fantasyPoints(row.stats, sc);
      t.games += 1;
    }
    if (i + 1 < week) for (const pid of new Set([...owner.keys(), ...tot.keys()])) (after.get(pid) ?? after.set(pid, []).get(pid)!).push([tot.get(pid)?.pts ?? 0, tot.get(pid)?.games ?? 0]);
  });
  return [...new Set([...owner.keys(), ...tot.keys()])].map((pid) => ({
    pid, owner: owner.get(pid) ?? null, name: dir[pid]?.[0] ?? pid, pos: dir[pid]?.[1] ?? [], nba: dir[pid]?.[2] ?? "",
    pts: Math.round((tot.get(pid)?.pts ?? 0) * 10) / 10, games: tot.get(pid)?.games ?? 0, weeks: after.get(pid) ?? [],
  }));
}

/** Player asset id -> fair value, for the players on the board. */
const playerValues = (ps: PlayerLine[]) => new Map(ps.map((p) => [PLAYER + p.pid, playerFair(p.pts, p.games)]));
const weekOf = (recs: TeamRecord[]) => Math.max(0, ...recs.map((r) => r.wins + r.losses + r.ties)) + 1;

/** Who played whom in a week (Sleeper's schedule; only the pairings are used, never the scores). */
async function opponents(leagueId: string, week: number): Promise<Map<string, string>> {
  "use cache: remote";
  cacheLife("hours");
  const [ms, rs] = await Promise.all([sleeper<SMatchup[] | null>(`/v1/league/${leagueId}/matchups/${week}`), rosters(leagueId)]);
  const owner = new Map(rs.map((r) => [r.roster_id, r.owner_id]));
  const byMatch = new Map<number, string[]>();
  for (const m of ms ?? []) {
    const o = owner.get(m.roster_id);
    if (o && m.matchup_id != null) (byMatch.get(m.matchup_id) ?? byMatch.set(m.matchup_id, []).get(m.matchup_id)!).push(o);
  }
  const out = new Map<string, string>();
  for (const pair of byMatch.values())
    if (pair.length === 2) {
      out.set(pair[0], pair[1]);
      out.set(pair[1], pair[0]);
    }
  return out;
}

async function records(leagueId: string): Promise<TeamRecord[]> {
  const rs = await rosters(leagueId);
  return rs.flatMap((r) =>
    r.owner_id
      ? [{ team: r.owner_id, wins: r.settings?.wins ?? 0, losses: r.settings?.losses ?? 0, ties: r.settings?.ties ?? 0, pf: official(r.settings ?? {}).pf }]
      : [],
  );
}

const iso = (d: Date | string) => (typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10));

const todayET = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

async function heldByTeam(tx: Sql, lid: string): Promise<Map<string, number>> {
  const rows = await tx<{ team: string; n: string }[]>`select team, sum(shares)::text as n from market_holdings where league_id = ${lid} group by team`;
  return new Map(rows.map((r) => [r.team, Number(r.n)]));
}

/** Monday 12am Eastern of the current week (Trash's weeks run Monday to Sunday). */
async function weekStart(tx: Sql): Promise<Date> {
  const [r] = await tx<{ at: Date }[]>`select date_trunc('week', now() at time zone 'America/New_York') at time zone 'America/New_York' as at`;
  return r.at;
}

/**
 * Holdings from before purchase lots existed: rebuild the lots from the order log (sells take the
 * newest first). If that doesn't add up to what's held, the shares count as bought now.
 */
async function ensureLots(tx: Sql, lid: string) {
  const [has] = await tx<{ n: number }[]>`select count(*)::int as n from market_lots where league_id = ${lid}`;
  if (has.n) return;
  const held = await tx<{ manager: string; team: string; shares: number }[]>`
    select manager, team, shares from market_holdings where league_id = ${lid} and shares > 0`;
  if (!held.length) return;
  const log = await tx<{ manager: string; team: string; kind: string; qty: number; at: Date }[]>`
    select manager, team, kind, qty, at from market_log where league_id = ${lid} and kind in ('buy', 'sell') order by id`;
  for (const h of held) {
    let lots: Lot[] = [];
    let id = 0;
    for (const e of log.filter((x) => x.manager === h.manager && x.team === h.team)) {
      if (e.kind === "buy") lots.push({ id: ++id, shares: e.qty, at: e.at.getTime() });
      else {
        const next = sellNewestFirst(lots, e.qty);
        if (next) lots = lots.map((l) => ({ ...l, shares: next.find((n) => n.id === l.id)?.shares ?? l.shares }));
      }
    }
    lots = lots.filter((l) => l.shares > 0);
    if (lots.reduce((n, l) => n + l.shares, 0) !== h.shares) lots = [{ id: 1, shares: h.shares, at: Date.now() }];
    for (const l of lots)
      await tx`insert into market_lots (league_id, manager, team, shares, bought_at) values (${lid}, ${h.manager}, ${h.team}, ${l.shares}, ${new Date(l.at)})`;
  }
}

/** Pay dividends for official results since the last check, save today's prices. Call inside a transaction. */
async function settle(tx: Sql, lid: string, recs: TeamRecord[], fair: Map<string, number>, save = true) {
  await tx`select pg_advisory_xact_lock(hashtext(${"market:" + lid}))`;
  await ensureLots(tx, lid);
  // Results arrive once a week is final, so the week being paid began a week before this one.
  const paidWeek = new Date((await weekStart(tx)).getTime() - 7 * 86_400_000);
  const before = new Map(
    (await tx<{ team: string; wins: number; losses: number; ties: number; pf: string }[]>`
      select team, wins, losses, ties, pf from market_teams where league_id = ${lid}`).map((r) => [r.team, { ...r, pf: Number(r.pf) }]),
  );
  // Values before this result (official totals as last seen), to tell favourites from underdogs.
  const valueBefore = before.size === recs.length ? fairValues([...before.values()]) : new Map<string, number>();
  for (const r of recs) {
    const base = dividend(before.get(r.team), r);
    let per = base;
    let note: string | null = null;
    if (base > 0) {
      const b = before.get(r.team)!;
      const week = r.wins + r.losses + r.ties;
      const opp = (await opponents(lid, week).catch(() => new Map<string, string>())).get(r.team);
      per = payoutPerShare(b, r, valueBefore.get(r.team), opp ? valueBefore.get(opp) : undefined);
      // Saved as "<opponent id>|<multiplier>"; the ledger shows it as "beat JD ×1.80".
      if (opp && per !== base) note = `${opp}|${(per / base).toFixed(2)}`;
    }
    if (per > 0) {
      // Only shares owned since before that week began.
      const holders = await tx<{ manager: string; shares: number }[]>`
        select manager, sum(shares)::int as shares from market_lots
        where league_id = ${lid} and team = ${r.team} and shares > 0 and bought_at < ${paidWeek}
        group by manager`;
      for (const h of holders.filter((x) => x.shares > 0)) {
        const amount = per * h.shares;
        await tx`update market_wallets set coins = coins + ${amount} where league_id = ${lid} and manager = ${h.manager}`;
        await tx`insert into market_log (league_id, manager, kind, team, qty, amount, note) values (${lid}, ${h.manager}, 'dividend', ${r.team}, ${h.shares}, ${amount}, ${note})`;
      }
    }
    const b = before.get(r.team);
    if (!b || b.wins !== r.wins || b.losses !== r.losses || b.ties !== r.ties || Math.abs(b.pf - r.pf) > 0.001)
      await tx`
        insert into market_teams (league_id, team, wins, losses, ties, pf) values (${lid}, ${r.team}, ${r.wins}, ${r.losses}, ${r.ties}, ${r.pf})
        on conflict (league_id, team) do update set wins = excluded.wins, losses = excluded.losses, ties = excluded.ties, pf = excluded.pf, synced_at = now()`;
  }
  return save ? savePrices(tx, lid, fair) : { fair, held: await heldByTeam(tx, lid) };
}

/** Today's closing price for every team (the latest one of the day stands). */
async function savePrices(tx: Sql, lid: string, fair: Map<string, number>, only?: string[]) {
  const held = await heldByTeam(tx, lid);
  const day = todayET();
  const rows = [...fair].filter(([team]) => !only || only.includes(team)).map(([team, f]) => ({ league_id: lid, team, day, price: spot(f, held.get(team) ?? 0) }));
  if (rows.length)
    await tx`
      insert into market_prices ${tx(rows, "league_id", "team", "day", "price")}
      on conflict (league_id, team, day) do update set price = excluded.price`;
  return { fair, held };
}

/** Fair value of every asset: teams from official totals, players from box scores (computed outside any transaction). */
async function allValues(lid: string, recs: TeamRecord[]) {
  const board = await playerBoard(lid, weekOf(recs));
  return { board, fair: new Map([...fairValues(recs), ...playerValues(board)]) };
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

/**
 * Week-by-week history back to week 0, before the first saved night, only when it checks out against
 * that night's official totals (see weeklyBackfill). Weekly scores come from the stored lineup replay;
 * no extra Sleeper calls beyond the cached rosters.
 */
async function backfill(lid: string, saved: { day: string; team: string; pf: number; wd: number }[]) {
  if (!saved.length) return [];
  const firstDay = saved.reduce((a, b) => (b.day < a.day ? b : a)).day;
  const night = saved.filter((x) => x.day === firstDay);
  const rs = await rosters(lid);
  const owner = new Map(rs.flatMap((r) => (r.owner_id ? [[r.roster_id, r.owner_id] as [number, string]] : [])));
  const teams = rs.flatMap((r) => (r.owner_id ? [{ team: r.owner_id, record: r.metadata?.record ?? "" }] : []));
  const sql = await db();
  const rows = await sql<{ week: number; teams: { rid: number; pts: number }[] }[]>`
    select week, data->'teams' as teams from league_weeks where league_id = ${lid} order by week`;
  const weekPts = new Map<string, number[]>();
  for (const r of rows)
    for (const t of r.teams ?? []) {
      const o = owner.get(t.rid);
      if (o && r.week >= 1) (weekPts.get(o) ?? weekPts.set(o, []).get(o)!)[r.week - 1] = t.pts;
    }
  return weeklyBackfill(teams, weekPts, firstDay, Math.min(...night.map((x) => x.wd)), new Map(night.map((x) => [x.team, x.pf])));
}

export type MarketState = Awaited<ReturnType<typeof marketState>>;

/** Everything the board shows, plus the viewer's wallet when they're one of the league's managers. */
export async function marketState(leagueId: string, season: NonNullable<Awaited<ReturnType<typeof marketSeason>>>, manager: string | null) {
  const lid = season.leagueId;
  const recs = await records(lid);
  const sql = await db();
  // Most views write nothing: only new official results (dividends), a new day's prices or a
  // manager's first visit (their desk) open a write.
  const { board, fair } = await allValues(lid, recs);
  if (await needsSettle(sql, lid, recs)) await sql.begin((tx) => settle(tx as unknown as Sql, lid, recs, fair));
  if (manager && season.users.has(manager))
    await sql`insert into market_wallets (league_id, manager, bucks) values (${lid}, ${manager}, ${START_BUCKS}) on conflict do nothing`;
  const held = await heldByTeam(sql, lid);
  const pack = await loadPack("trash");
  const nameOf = (id: string) => {
    const dn = season.names.get(id) ?? id;
    return pack?.nicknames[dn] ?? dn;
  };
  const tick = tickers(recs.map((r) => [r.team, nameOf(r.team)]));
  const thisWeek = await weekStart(sql);
  // This week's matchups, so each team shows what a win would pay per share (regular season only).
  const week = Math.max(0, ...recs.map((r) => r.wins + r.losses + r.ties)) + 1;
  const playoffs = (await leagueInfo(lid).catch(() => null))?.settings?.playoff_week_start ?? 99;
  const vsNow = week < playoffs ? await opponents(lid, week).catch(() => new Map<string, string>()) : new Map<string, string>();
  const [prices, snaps, wallets, holdings, log, lots] = await Promise.all([
    sql<{ team: string; day: Date; price: string }[]>`select team, day, price::text from market_prices where league_id = ${lid} order by day`,
    // The nightly official totals, so the charts go back before the market opened (fair value, no demand yet).
    sql<{ day: Date; team: string | null; wins: number; losses: number; ties: number; pf: string; weeks_done: number }[]>`
      select taken_on as day, owner_id as team, wins, losses, ties, pf::text, weeks_done from pf_snapshots where league_id = ${lid} order by taken_on`,
    sql<{ manager: string; bucks: string; coins: string; hoodies: number }[]>`select manager, bucks::text, coins::text, hoodies from market_wallets where league_id = ${lid}`,
    sql<{ manager: string; team: string; shares: number }[]>`select manager, team, shares from market_holdings where league_id = ${lid} and shares > 0`,
    sql<{ manager: string; kind: string; team: string | null; qty: number; amount: string; at: Date; note: string | null }[]>`
      select manager, kind, team, qty, amount::text, at, note from market_log where league_id = ${lid} order by at desc, id desc limit 1000`,
    manager
      ? sql<{ id: string; team: string; shares: number; bought_at: Date }[]>`
          select id::text, team, shares, bought_at from market_lots where league_id = ${lid} and manager = ${manager} and shares > 0`
      : Promise.resolve([]),
  ]);
  // Your shares bought this week: they start earning coin next week.
  const since = thisWeek.getTime();
  const lotsOf = (team: string) => lots.filter((l) => l.team === team).map((l) => ({ id: Number(l.id), shares: l.shares, at: l.bought_at.getTime() }));
  const counting = (team: string, shares: number) => (lots.some((l) => l.team === team) ? ownedBefore(lotsOf(team), since) : shares);
  const saved = snaps.flatMap((r) => (r.team ? [{ day: iso(r.day), team: r.team, wins: r.wins, losses: r.losses, ties: r.ties, pf: Number(r.pf), wd: r.weeks_done }] : []));
  const history = priceHistory(
    prices.map((p) => ({ day: iso(p.day), team: p.team, price: Number(p.price) })),
    [...(await backfill(lid, saved).catch(() => [])), ...saved],
  );
  const teams = recs
    .map((r) => {
      const f = fair.get(r.team)!;
      const h = held.get(r.team) ?? 0;
      const hist = history.get(r.team) ?? [];
      const price = spot(f, h);
      // Change over the last 7 days (or since the first price, when the history is shorter).
      const cut = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
      const weekAgo = [...hist].reverse().find((h) => h.d <= cut)?.p ?? hist[0]?.p ?? price;
      return {
        id: r.team, ticker: tick.get(r.team)!, name: nameOf(r.team), team: season.teams.get(r.team) ?? null,
        record: `${r.wins}-${r.losses}${r.ties ? `-${r.ties}` : ""}`, pf: Math.round(r.pf),
        fair: f, held: h, price, buy1: buyCost(f, h, 1), sell1: h > 0 ? sellValue(f, h, 1) : 0,
        change: weekAgo ? (price - weekAgo) / weekAgo : 0, history: hist.slice(-120),
        vs: vsNow.has(r.team) ? { id: vsNow.get(r.team)!, ticker: tick.get(vsNow.get(r.team)!) ?? null, winPays: Math.round(100 * upset(f, fair.get(vsNow.get(r.team)!) ?? f)) } : null,
      };
    })
    .sort((a, b) => b.price - a.price);
  // Player stocks: everyone on a Trash roster now (no coin; the price follows how he plays).
  const cut = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const playerName = new Map(board.map((p) => [PLAYER + p.pid, p.name]));
  const players = board
    .filter((p) => p.owner || (held.get(PLAYER + p.pid) ?? 0) > 0)
    .map((p) => {
      const id = PLAYER + p.pid;
      const f = fair.get(id)!;
      const h = held.get(id) ?? 0;
      // Before the market's own prices: his value at the end of each finished week, from box scores.
      const market = history.get(id) ?? [];
      const first = market[0]?.d ?? "9999";
      const monday = thisWeek.getTime();
      const wk = (k: number) => new Date(monday - (7 * (p.weeks.length - k) + 1) * 86_400_000).toISOString().slice(0, 10);
      const built = [...p.weeks.map(([pts, g], i) => ({ d: wk(i + 1), p: playerFair(pts, g), w: i + 1 }))].filter((x) => x.d < first);
      const hist = [...built, ...market];
      const price = spot(f, h);
      const weekAgo = [...hist].reverse().find((x) => x.d <= cut)?.p ?? hist[0]?.p ?? price;
      return {
        id, name: p.name, pos: p.pos, nba: p.nba, owner: p.owner ? nameOf(p.owner) : null, ownerId: p.owner,
        avg: p.games ? Math.round((p.pts / p.games) * 10) / 10 : 0, games: p.games,
        fair: f, held: h, price, change: weekAgo ? (price - weekAgo) / weekAgo : 0, history: hist.slice(-60),
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
    players,
    hoodiesSold,
    nextHoodie: hoodiePrice(hoodiesSold),
    coinRate: COIN_RATE,
    standings,
    feed: log.map((l) => {
      const [opp, x] = l.note?.split("|") ?? [];
      return {
        name: nameOf(l.manager), kind: l.kind, ticker: l.team ? (tick.get(l.team) ?? playerName.get(l.team) ?? null) : null, qty: l.qty, amount: Number(l.amount), at: l.at.toISOString(),
        upset: opp && x ? { vs: tick.get(opp) ?? null, x: Number(x) } : null,
      };
    }),
    wallet: mine
      ? { bucks: Number(mine.bucks), coins: Number(mine.coins), hoodies: mine.hoodies, holdings: holdOf(manager!).map((h) => ({ ...h, counting: counting(h.team, h.shares) })), worth: standings.find((s) => s.manager === manager)?.worth ?? 0 }
      : null,
    status: season.users.size ? "open" : "closed",
  };
}

export type Order = { kind: "buy" | "sell"; team: string; qty: number } | { kind: "coin" | "uncoin"; qty: number } | { kind: "hoodie"; qty: number };

/** One order for one manager, all or nothing. Returns a plain message on refusal. */
export async function placeOrder(season: NonNullable<Awaited<ReturnType<typeof marketSeason>>>, manager: string, o: Order): Promise<{ ok: true } | { ok: false; error: string }> {
  const lid = season.leagueId;
  if (!Number.isInteger(o.qty) || o.qty < 1 || o.qty > MAX_QTY) return { ok: false, error: "Pick an amount between 1 and 500." };
  const recs = await records(lid);
  const { board, fair: values } = await allValues(lid, recs);
  const sql = await db();
  return sql.begin(async (t) => {
    const tx = t as unknown as Sql;
    // Every order settles new results first; the full day's prices are written only when they're due.
    const { fair, held } = await settle(tx, lid, recs, values, await needsSettle(tx, lid, recs));
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
        // Nobody invests in themselves: you can't buy your own team (you can still sell shares you have).
        if (o.team === manager) return { ok: false as const, error: "You can't buy your own team." };
        // Player stocks: not players on your own roster either (you set their lineup).
        if (isPlayer(o.team) && board.some((p) => PLAYER + p.pid === o.team && p.owner === manager))
          return { ok: false as const, error: "You can't buy players on your own roster." };
        const cost = buyCost(f, h, o.qty);
        if (cost > bucks) return { ok: false as const, error: "Not enough Bushy Bucks for that." };
        await tx`update market_wallets set bucks = bucks - ${cost} where league_id = ${lid} and manager = ${manager}`;
        await tx`
          insert into market_holdings (league_id, manager, team, shares) values (${lid}, ${manager}, ${o.team}, ${o.qty})
          on conflict (league_id, manager, team) do update set shares = market_holdings.shares + excluded.shares`;
        await tx`insert into market_lots (league_id, manager, team, shares) values (${lid}, ${manager}, ${o.team}, ${o.qty})`;
        await tx`insert into market_log (league_id, manager, kind, team, qty, amount) values (${lid}, ${manager}, 'buy', ${o.team}, ${o.qty}, ${cost})`;
      } else {
        const [mine] = await tx<{ shares: number }[]>`
          select shares from market_holdings where league_id = ${lid} and manager = ${manager} and team = ${o.team} for update`;
        if (!mine || mine.shares < o.qty) return { ok: false as const, error: "You don't have that many shares." };
        const pay = sellValue(f, h, o.qty);
        await tx`update market_wallets set bucks = bucks + ${pay} where league_id = ${lid} and manager = ${manager}`;
        await tx`update market_holdings set shares = shares - ${o.qty} where league_id = ${lid} and manager = ${manager} and team = ${o.team}`;
        // The newest shares go first, so shares that already count for this week's coin are kept.
        const lots = await tx<{ id: string; shares: number; bought_at: Date }[]>`
          select id::text, shares, bought_at from market_lots where league_id = ${lid} and manager = ${manager} and team = ${o.team} and shares > 0 for update`;
        for (const c of sellNewestFirst(lots.map((l) => ({ id: Number(l.id), shares: l.shares, at: l.bought_at.getTime() })), o.qty) ?? [])
          if (c.shares > 0) await tx`update market_lots set shares = ${c.shares} where id = ${c.id}`;
          else await tx`delete from market_lots where id = ${c.id}`;
        await tx`insert into market_log (league_id, manager, kind, team, qty, amount) values (${lid}, ${manager}, 'sell', ${o.team}, ${o.qty}, ${pay})`;
      }
    } else if (o.kind === "coin") {
      const cost = COIN_RATE * o.qty;
      if (cost > bucks) return { ok: false as const, error: "Not enough Bushy Bucks for that much Perren Coin." };
      await tx`update market_wallets set bucks = bucks - ${cost}, coins = coins + ${o.qty * 100} where league_id = ${lid} and manager = ${manager}`;
      await tx`insert into market_log (league_id, manager, kind, qty, amount) values (${lid}, ${manager}, 'coin', ${o.qty}, ${cost})`;
    } else if (o.kind === "uncoin") {
      // Cash coin back into bucks at the same rate (whole coins).
      if (o.qty * 100 > coins) return { ok: false as const, error: "You don't have that much Perren Coin." };
      const pay = COIN_RATE * o.qty;
      await tx`update market_wallets set coins = coins - ${o.qty * 100}, bucks = bucks + ${pay} where league_id = ${lid} and manager = ${manager}`;
      await tx`insert into market_log (league_id, manager, kind, qty, amount) values (${lid}, ${manager}, 'uncoin', ${o.qty}, ${pay})`;
    } else {
      const [{ sold }] = await tx<{ sold: number }[]>`select coalesce(sum(hoodies), 0)::int as sold from market_wallets where league_id = ${lid}`;
      let cost = 0;
      for (let i = 0; i < o.qty; i++) cost += hoodiePrice(sold + i);
      if (cost > coins) return { ok: false as const, error: "Not enough Perren Coin for that." };
      await tx`update market_wallets set coins = coins - ${cost}, hoodies = hoodies + ${o.qty} where league_id = ${lid} and manager = ${manager}`;
      await tx`insert into market_log (league_id, manager, kind, qty, amount) values (${lid}, ${manager}, 'hoodie', ${o.qty}, ${cost})`;
    }
    // The day's price of what was traded follows the order (demand moves it).
    if (o.kind === "buy" || o.kind === "sell") await savePrices(tx, lid, fair, [o.team]);
    return { ok: true as const };
  });
}
