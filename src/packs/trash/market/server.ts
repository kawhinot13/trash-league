import "server-only";
import { cacheLife } from "next/cache";
import { db } from "@/lib/app/db";
import { sleeper, official, type SMatchup, type SRoster } from "@/lib/app/sleeper";
import { familyIdOf, newestSeason, packOf } from "@/lib/app/store";
import { loadPack } from "@/packs";
import { fantasyPoints } from "@/lib/app/replay";
import { playerDirectory, weekStats } from "@/lib/app/sleeper-cache";
import {
  buyCost, COIN_RATE, COIN_BACK, priceHistory, weeklyBackfill, dividend, payoutPerShare, upset, ownedBefore, isPlayer, formFair, PLAYER, lockedTeams, type NbaGame, STORM, STORM_MEMBERS, stormFair, stormPayout, expectedWins, shortValue, teamShortOpenNow, fillPending, repriceTrades, type PastTrade, sellNewestFirst, type Lot, fairValues, hoodiePrice, MAX_QTY, netWorth, sellValue, spot, START_BUCKS, tickers, TICKERS, type TeamRecord,
} from "@/packs/trash/market/math";

/**
 * The Trash Exchange, server side (Trash pack only). Prices come from Sleeper's official season
 * totals for the current season; every read first settles any new official results (dividends)
 * under a per-league lock, so a payout happens once however many people are looking.
 */
type Sql = Awaited<ReturnType<typeof db>>;

/** The Great Storm's two teams (Sleeper user ids) this season, found by their Sleeper usernames. */
export function stormIds(season: { names: Map<string, string> }): string[] {
  return [...season.names].filter(([, n]) => STORM_MEMBERS.includes((n ?? "").toLowerCase())).map(([id]) => id);
}

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
  /** Every game this season, oldest first: [day, fantasy points]. */
  days: [string, number][];
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
  const byDay = new Map<string, Map<string, number>>();
  for (const rows of weeks)
    for (const row of rows) {
      if (!dir[row.player_id] && !owner.has(row.player_id)) continue;
      const t = tot.get(row.player_id) ?? tot.set(row.player_id, { pts: 0, games: 0 }).get(row.player_id)!;
      const pts = fantasyPoints(row.stats, sc);
      t.pts += pts;
      t.games += 1;
      const m = byDay.get(row.player_id) ?? byDay.set(row.player_id, new Map()).get(row.player_id)!;
      m.set(row.date ?? "", (m.get(row.date ?? "") ?? 0) + pts);
    }
  const days = (pid: string): [string, number][] =>
    [...(byDay.get(pid) ?? [])]
      .filter(([d]) => d)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([d, p]) => [d, Math.round(p * 10) / 10]);
  return [...new Set([...owner.keys(), ...tot.keys()])].map((pid) => ({
    pid, owner: owner.get(pid) ?? null, name: dir[pid]?.[0] ?? pid, pos: dir[pid]?.[1] ?? [], nba: dir[pid]?.[2] ?? "",
    pts: Math.round((tot.get(pid)?.pts ?? 0) * 10) / 10, games: tot.get(pid)?.games ?? 0, days: days(pid),
  }));
}

/** The NBA schedule (dates, status, teams), refreshed every couple of minutes. */
async function nbaGames(season: string): Promise<NbaGame[]> {
  "use cache: remote";
  cacheLife({ stale: 60, revalidate: 120, expire: 600 });
  const raw = (await sleeper<{ date: string; status: string; home?: { team?: string }; away?: { team?: string } }[] | null>(`/schedule/nba/regular/${season}`)) ?? [];
  return raw.map((g) => ({ date: g.date, status: g.status, teams: [g.home?.team, g.away?.team].filter((t): t is string => !!t) }));
}

/** NBA teams whose players can't be traded right now (their game is on, or finished overnight). */
async function locksNow(lid: string): Promise<Set<string>> {
  const season = (await leagueInfo(lid))?.season;
  if (!season) return new Set();
  const now = new Date();
  const et = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d);
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(now));
  return lockedTeams(await nbaGames(season), et(now), et(new Date(now.getTime() - 86_400_000)), hour);
}

/** Player asset id -> fair value, for the players on the board. */
const playerValues = (ps: PlayerLine[]) => new Map(ps.map((p) => [PLAYER + p.pid, formFair(p.days.map((x) => x[1]))]));
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
      ? [{ team: r.owner_id, wins: r.settings?.wins ?? 0, losses: r.settings?.losses ?? 0, ties: r.settings?.ties ?? 0, pf: official(r.settings ?? {}).pf, pa: official(r.settings ?? {}).pa }]
      : [],
  );
}

const nextDay = (d: string) => new Date(Date.parse(`${d}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
const iso = (d: Date | string) => (typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10));

const todayET = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

async function heldByTeam(tx: Sql, lid: string): Promise<Map<string, number>> {
  const rows = await tx<{ team: string; n: string }[]>`select team, sum(shares)::text as n from market_holdings where league_id = ${lid} group by team`;
  return new Map(rows.map((r) => [r.team, Number(r.n)]));
}

/** Team trading closes, and a week's coin starts counting, at Monday 7 PM Eastern (19 h after the week starts). */
const GAME_TIME_MS = 19 * 3_600_000;

/**
 * One-time (owner's call 2026-11-19, when team stocks went Monday-only): team shares bought and team
 * shorts placed during the week of Nov 16 are treated as if they happened that Monday before games, so
 * they count for that week. Waiting team shorts open at the value they were placed at.
 */
async function refundWaitingOnce(tx: Sql, lid: string) {
  const done = await tx`insert into market_meta (league_id, key) values (${lid}, 'no-waiting-orders-2026-11-19') on conflict do nothing returning key`;
  if (!done.length) return;
  // Owner's call: no waiting orders. Everything set aside goes back to its owner.
  for (const r of await tx<{ manager: string; n: string }[]>`
    select manager, sum(reserved)::text as n from (
      select manager, reserved from market_orders where league_id = ${lid}
      union all select manager, reserved from market_shorts where league_id = ${lid} and pending) x group by manager`)
    await tx`update market_wallets set bucks = bucks + ${Number(r.n)} where league_id = ${lid} and manager = ${r.manager}`;
  await tx`delete from market_orders where league_id = ${lid}`;
  await tx`delete from market_shorts where league_id = ${lid} and pending`;
}

/**
 * One-time (owner's call 2026-11-19): every player trade before the formula settled (60% last 5 games)
 * is re-priced as if today's formula had always been in place, using his box scores before that day
 * and the league's holdings at the time. Each manager gets back, or gives back, the difference; open
 * player shorts get their entry reset the same way. Anyone who'd owe more than their cash gives back
 * shares of their players at today's value instead, so nobody goes negative.
 */
async function repriceOnce(tx: Sql, lid: string, board: PlayerLine[], fair: Map<string, number>) {
  await tx`select pg_advisory_xact_lock(hashtext(${"market:" + lid}))`;
  const done = await tx`insert into market_meta (league_id, key) values (${lid}, 'reprice-players-last5') on conflict do nothing returning key`;
  if (!done.length) return;
  const etDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d);
  const games = new Map(board.map((p) => [PLAYER + p.pid, p.days]));
  const fairAt = (asset: string, day: string) => formFair((games.get(asset) ?? []).filter((g) => g[0] < day).map((g) => g[1]));
  const rows = await tx<{ id: string; manager: string; team: string; kind: "buy" | "sell"; qty: number; amount: string; at: Date }[]>`
    select id::text, manager, team, kind, qty, amount::text, at from market_log
    where league_id = ${lid} and kind in ('buy', 'sell') and team like 'p:%' order by id`;
  const trades: PastTrade[] = rows.map((r) => ({ id: r.id, manager: r.manager, asset: r.team, kind: r.kind, qty: r.qty, amount: Number(r.amount), day: etDay(r.at) }));
  const { amounts, owed } = repriceTrades(trades, fairAt);
  for (const t of trades) if (amounts.get(t.id) !== t.amount) await tx`update market_log set amount = ${amounts.get(t.id)!} where id = ${t.id}`;
  // Open player shorts: collateral at the re-priced entry.
  for (const sh of await tx<{ id: string; manager: string; asset: string; shares: number; entry: string; opened_at: Date }[]>`
    select id::text, manager, asset, shares, entry::text, opened_at from market_shorts where league_id = ${lid} and asset like 'p:%' and not pending`) {
    const e = fairAt(sh.asset, etDay(sh.opened_at));
    owed.set(sh.manager, (owed.get(sh.manager) ?? 0) + (Number(sh.entry) - e) * sh.shares);
    await tx`update market_shorts set entry = ${e} where id = ${sh.id}`;
  }
  for (const [manager, diff] of owed) {
    if (!diff) continue;
    const [w] = await tx<{ bucks: string }[]>`select bucks::text from market_wallets where league_id = ${lid} and manager = ${manager} for update`;
    let bucks = Number(w?.bucks ?? 0) + diff;
    // Short of cash: give back player shares at today's value until it's covered.
    if (bucks < 0) {
      const hs = await tx<{ team: string; shares: number }[]>`
        select team, shares from market_holdings where league_id = ${lid} and manager = ${manager} and team like 'p:%' and shares > 0 order by shares desc`;
      for (const h of hs) {
        if (bucks >= 0) break;
        const f = fair.get(h.team) ?? 0;
        if (!f) continue;
        const n = Math.min(h.shares, Math.ceil(-bucks / f));
        bucks += n * f;
        await tx`update market_holdings set shares = shares - ${n} where league_id = ${lid} and manager = ${manager} and team = ${h.team}`;
        const lots = await tx<{ id: string; shares: number; bought_at: Date }[]>`
          select id::text, shares, bought_at from market_lots where league_id = ${lid} and manager = ${manager} and team = ${h.team} and shares > 0 for update`;
        for (const c of sellNewestFirst(lots.map((l) => ({ id: Number(l.id), shares: l.shares, at: l.bought_at.getTime() })), n) ?? [])
          if (c.shares > 0) await tx`update market_lots set shares = ${c.shares} where id = ${c.id}`;
          else await tx`delete from market_lots where id = ${c.id}`;
      }
      bucks = Math.max(0, bucks);
    }
    await tx`update market_wallets set bucks = ${bucks} where league_id = ${lid} and manager = ${manager}`;
    await tx`insert into market_log (league_id, manager, kind, qty, amount, note) values (${lid}, ${manager}, 'reprice', 0, ${Math.abs(diff)}, ${diff > 0 ? "+" : "-"})`;
  }
}

async function backdateOnce(tx: Sql, lid: string) {
  const done = await tx`insert into market_meta (league_id, key) values (${lid}, 'monday-only-2026-11-16') on conflict do nothing returning key`;
  if (!done.length) return;
  const monday = new Date("2026-11-16T23:59:00Z"); // 6:59 PM Eastern, Monday Nov 16
  await tx`update market_lots set bought_at = ${monday} where league_id = ${lid} and team not like 'p:%' and bought_at > ${monday}`;
  await tx`
    update market_shorts set pending = false, entry = reserved / shares, reserved = 0, opened_at = ${monday}
    where league_id = ${lid} and pending and asset not like 'p:%' and shares > 0`;
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
async function settle(tx: Sql, lid: string, recs: TeamRecord[], fair: Map<string, number>, save = true, storm: string[] = []) {
  await tx`select pg_advisory_xact_lock(hashtext(${"market:" + lid}))`;
  await ensureLots(tx, lid);
  // Results arrive once a week is final, so the week being paid began a week before this one.
  // A week's coin counts shares owned before that week's games: Monday 7 PM Eastern (the end of the trading window).
  const paidWeek = new Date((await weekStart(tx)).getTime() - 7 * 86_400_000 + GAME_TIME_MS);
  await backdateOnce(tx, lid);
  await refundWaitingOnce(tx, lid);
  const before = new Map(
    (await tx<{ team: string; wins: number; losses: number; ties: number; pf: string }[]>`
      select team, wins, losses, ties, pf from market_teams where league_id = ${lid}`).map((r) => [r.team, { ...r, pf: Number(r.pf) }]),
  );
  // Values before this result (official totals as last seen), to tell favourites from underdogs.
  const valueBefore = before.size === recs.length ? fairValues([...before.values()]) : new Map<string, number>();
  // For The Great Storm: each member's payout per share this time, and whether he won.
  const paid = new Map<string, { per: number; won: boolean; played: boolean }>();
  const pay = async (asset: string, per: number, note: string | null) => {
    // Only shares owned since before that week began.
    const holders = await tx<{ manager: string; shares: number }[]>`
      select manager, sum(shares)::int as shares from market_lots
      where league_id = ${lid} and team = ${asset} and shares > 0 and bought_at < ${paidWeek}
      group by manager`;
    for (const h of holders.filter((x) => x.shares > 0)) {
      const amount = per * h.shares;
      await tx`update market_wallets set coins = coins + ${amount} where league_id = ${lid} and manager = ${h.manager}`;
      await tx`insert into market_log (league_id, manager, kind, team, qty, amount, note) values (${lid}, ${h.manager}, 'dividend', ${asset}, ${h.shares}, ${amount}, ${note})`;
    }
  };
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
    if (per > 0) await pay(r.team, per, note);
    const b = before.get(r.team);
    if (b) paid.set(r.team, { per, won: r.wins > b.wins, played: r.wins + r.losses + r.ties > b.wins + b.losses + b.ties });
    if (!b || b.wins !== r.wins || b.losses !== r.losses || b.ties !== r.ties || Math.abs(b.pf - r.pf) > 0.001)
      await tx`
        insert into market_teams (league_id, team, wins, losses, ties, pf) values (${lid}, ${r.team}, ${r.wins}, ${r.losses}, ${r.ties}, ${r.pf})
        on conflict (league_id, team) do update set wins = excluded.wins, losses = excluded.losses, ties = excluded.ties, pf = excluded.pf, synced_at = now(),
          result_at = case when market_teams.wins + market_teams.losses + market_teams.ties <> excluded.wins + excluded.losses + excluded.ties
            then now() else market_teams.result_at end`;
    // A new weekly result: team shorts that were waiting open now, at the new value.
    const f = fair.get(r.team);
    if (b && f && r.wins + r.losses + r.ties > b.wins + b.losses + b.ties) {
      const waiting = await tx<{ id: string; manager: string; shares: number; reserved: string }[]>`
        select id::text, manager, shares, reserved::text from market_shorts
        where league_id = ${lid} and asset = ${r.team} and pending for update`;
      for (const w of waiting) {
        const { shares, refund } = fillPending(w.shares, Number(w.reserved), f);
        if (refund) await tx`update market_wallets set bucks = bucks + ${refund} where league_id = ${lid} and manager = ${w.manager}`;
        if (shares) {
          await tx`update market_shorts set pending = false, shares = ${shares}, entry = ${f}, reserved = 0, opened_at = now() where id = ${w.id}`;
          await tx`insert into market_log (league_id, manager, kind, team, qty, amount) values (${lid}, ${w.manager}, 'short', ${r.team}, ${shares}, ${shares * f})`;
        } else await tx`delete from market_shorts where id = ${w.id}`;
      }
    }
  }
  // Monday's open: a new weekly result means waiting team orders go through now, at the new prices.
  if ([...paid.values()].some((x) => x.played)) await fillOrders(tx, { lid, fair, held: await heldByTeam(tx, lid), board: [], storm });
  // The Great Storm pays once both members' results are in: the average, 1.5x in a Storm week.
  if (storm.length === 2) {
    const [a, b] = storm.map((id) => paid.get(id));
    if (a?.played && b?.played) {
      const per = stormPayout(a.per, b.per, a.won && b.won);
      if (per > 0) await pay(STORM, per, a.won && b.won ? "storm" : null);
    }
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
async function allValues(lid: string, recs: TeamRecord[], storm: string[]) {
  const board = await playerBoard(lid, weekOf(recs));
  const teams = fairValues(recs);
  const fair = new Map([...teams, ...playerValues(board)]);
  if (storm.length === 2 && teams.has(storm[0]) && teams.has(storm[1])) fair.set(STORM, stormFair(teams.get(storm[0])!, teams.get(storm[1])!));
  return { board, fair };
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
  const storm = stormIds(season);
  const { board, fair } = await allValues(lid, recs, storm);
  const [repriced] = await sql`select 1 as x from market_meta where league_id = ${lid} and key = 'reprice-players-last5'`;
  if (!repriced) await sql.begin((tx) => repriceOnce(tx as unknown as Sql, lid, board, fair));
  if (await needsSettle(sql, lid, recs)) await sql.begin((tx) => settle(tx as unknown as Sql, lid, recs, fair, true, storm));
  if (manager && season.users.has(manager))
    await sql`insert into market_wallets (league_id, manager, bucks) values (${lid}, ${manager}, ${START_BUCKS}) on conflict do nothing`;
  const held = await heldByTeam(sql, lid);
  const pack = await loadPack("trash");
  const nameOf = (id: string) => {
    const dn = season.names.get(id) ?? id;
    return pack?.nicknames[dn] ?? dn;
  };
  const fixedTickers = new Map(
    recs.flatMap((r) => {
      const t = TICKERS[(season.names.get(r.team) ?? "").toLowerCase()];
      return t ? [[r.team, t] as [string, string]] : [];
    }),
  );
  const tick = tickers(recs.map((r) => [r.team, nameOf(r.team)]), fixedTickers);
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
  const since = thisWeek.getTime() + GAME_TIME_MS;
  const lotsOf = (team: string) => lots.filter((l) => l.team === team).map((l) => ({ id: Number(l.id), shares: l.shares, at: l.bought_at.getTime() }));
  const counting = (team: string, shares: number) => (lots.some((l) => l.team === team) ? ownedBefore(lotsOf(team), since) : shares);
  const saved = snaps.flatMap((r) => (r.team ? [{ day: iso(r.day), team: r.team, wins: r.wins, losses: r.losses, ties: r.ties, pf: Number(r.pf), wd: r.weeks_done }] : []));
  const history = priceHistory(
    prices.map((p) => ({ day: iso(p.day), team: p.team, price: Number(p.price) })),
    [...(await backfill(lid, saved).catch(() => [])), ...saved],
  );
  // Team shorts open right away only in the Monday window (see teamShortOpenNow); otherwise they wait.
  const posted = new Map(
    (await sql<{ team: string; posted: boolean }[]>`
      select team, coalesce(result_at >= ${thisWeek}, false) as posted from market_teams where league_id = ${lid}`).map((r) => [r.team, r.posted]),
  );
  const nowET = new Date();
  const dayET = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(nowET));
  const hourET = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(nowET));
  const teamOpen = teamShortOpenNow(dayET, hourET, [...posted.values()].some(Boolean));
  const teams = recs
    .map((r) => {
      const f = fair.get(r.team)!;
      const h = held.get(r.team) ?? 0;
      const price = spot(f, h);
      // The chart always ends on today's live price.
      const today = todayET();
      const hist = (history.get(r.team) ?? []).filter((x) => x.d !== today).concat({ d: today, p: price });
      // Change over the last 7 days (or since the first price, when the history is shorter).
      const cut = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
      const weekAgo = [...hist].reverse().find((h) => h.d <= cut)?.p ?? hist[0]?.p ?? price;
      return {
        id: r.team, ticker: tick.get(r.team)!, name: nameOf(r.team), team: season.teams.get(r.team) ?? null,
        record: `${r.wins}-${r.losses}${r.ties ? `-${r.ties}` : ""}`, pf: Math.round(r.pf),
        // Over/under-performing: actual wins against what official points for and against suggest.
        xw: Math.round(expectedWins(r.pf, r.pa ?? 0, r.wins + r.losses + r.ties) * 10) / 10,
        luck: Math.round((r.wins + r.ties / 2 - expectedWins(r.pf, r.pa ?? 0, r.wins + r.losses + r.ties)) * 10) / 10,
        fair: f, held: h, price, buy1: buyCost(f, h, 1), sell1: h > 0 ? sellValue(f, h, 1) : 0,
        change: weekAgo ? (price - weekAgo) / weekAgo : 0, history: hist.slice(-120),
        shortNow: teamOpen,
        vs: vsNow.has(r.team) ? { id: vsNow.get(r.team)!, ticker: tick.get(vsNow.get(r.team)!) ?? null, winPays: Math.round(100 * upset(f, fair.get(vsNow.get(r.team)!) ?? f)) } : null,
      };
    })
    .sort((a, b) => b.price - a.price);
  // The Great Storm: Junkyard Dog + KawhiNot as one stock (before it traded: the average of the two).
  const stormStock = (() => {
    const f = fair.get(STORM);
    if (!f || storm.length !== 2) return null;
    const h = held.get(STORM) ?? 0;
    const price = spot(f, h);
    const [ha, hb] = storm.map((id) => new Map((history.get(id) ?? []).map((x) => [x.d, x.p])));
    const own = new Map((history.get(STORM) ?? []).map((x) => [x.d, x.p]));
    const today = todayET();
    const days = [...new Set([...ha.keys(), ...own.keys()])].filter((d) => d !== today && (own.has(d) || hb.has(d))).sort();
    const hist = days.map((d) => ({ d, p: own.get(d) ?? stormFair(ha.get(d)!, hb.get(d)!) })).concat({ d: today, p: price });
    const cut = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    const weekAgo = [...hist].reverse().find((x) => x.d <= cut)?.p ?? hist[0]?.p ?? price;
    const members = storm.map((id) => ({ id, ticker: tick.get(id) ?? "", name: nameOf(id), record: teams.find((t) => t.id === id)?.record ?? "" }));
    // This week's payout if both win (each member's "a win pays", averaged, x1.5).
    const pays = storm.map((id) => teams.find((t) => t.id === id)?.vs?.winPays ?? 0);
    return {
      id: STORM, ticker: "STORM", name: "The Great Storm", members, fair: f, held: h, price,
      change: weekAgo ? (price - weekAgo) / weekAgo : 0, history: hist.slice(-120),
      stormWeekPays: pays.every((x) => x > 0) ? stormPayout(pays[0], pays[1], true) : null,
    };
  })();
  tick.set(STORM, "STORM");
  // Player stocks: everyone on a Trash roster now (no coin; the price follows how he plays).
  const cut = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const playerName = new Map(board.map((p) => [PLAYER + p.pid, p.name]));
  const locks = await locksNow(lid).catch(() => new Set<string>());
  const today = todayET();
  const players = board
    .filter((p) => p.owner || (held.get(PLAYER + p.pid) ?? 0) > 0)
    .map((p) => {
      const id = PLAYER + p.pid;
      const f = fair.get(id)!;
      const h = held.get(id) ?? 0;
      // Every day of the season: his value after each day's games (box scores), carried over days he
      // didn't play; the market's own closing prices once it has them; and today's live price last.
      // Every past day is redrawn with today's formula from his box scores (saved closing prices used
      // whatever formula was live then, which made fake dips when it changed); today is the live price.
      const first = "9999";
      const built: { d: string; p: number }[] = [];
      if (p.days.length) {
        let i = 0;
        // From his 5th game (before that the price is held near 15, which isn't him).
        const start = (p.days[4] ?? p.days[p.days.length - 1])[0];
        for (let d = start; d < first && d <= today; d = nextDay(d)) {
          while (i < p.days.length && p.days[i][0] <= d) i++;
          built.push({ d, p: formFair(p.days.slice(0, i).map((x) => x[1])) });
        }
      }
      const live = spot(f, h);
      const hist = built.filter((x) => x.d !== today).concat({ d: today, p: live });
      const price = spot(f, h);
      const weekAgo = [...hist].reverse().find((x) => x.d <= cut)?.p ?? hist[0]?.p ?? price;
      return {
        id, name: p.name, pos: p.pos, nba: p.nba, owner: p.owner ? nameOf(p.owner) : null, ownerId: p.owner,
        avg: p.games ? Math.round((p.pts / p.games) * 10) / 10 : 0, games: p.games,
        last5: p.days.length ? Math.round((p.days.slice(-5).reduce((t, x) => t + x[1], 0) / Math.min(5, p.days.length)) * 10) / 10 : 0, locked: !!p.nba && locks.has(p.nba),
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
  // Open shorts, valued at what closing them now would pay (stats-only value).
  const allShorts = await sql<{ manager: string; asset: string; shares: number; entry: string; pending: boolean; reserved: string }[]>`
    select manager, asset, shares, entry::text, pending, reserved::text from market_shorts where league_id = ${lid} and shares > 0`;
  const shortRows = allShorts.filter((r) => !r.pending);
  const waitingOf = (m: string) => allShorts.filter((r) => r.pending && r.manager === m);
  const shortWorth = (m: string) =>
    shortRows.filter((r) => r.manager === m).reduce((t, r) => t + (fair.has(r.asset) ? shortValue(Number(r.entry), fair.get(r.asset)!, r.shares) : Number(r.entry) * r.shares), 0);
  // Bucks set aside for Monday orders still belong to their owner.
  const setAside = new Map(
    (await sql<{ manager: string; n: string }[]>`select manager, sum(reserved)::text as n from market_orders where league_id = ${lid} group by manager`).map((r) => [r.manager, Number(r.n)]),
  );
  for (const st of standings) st.worth += shortWorth(st.manager) + waitingOf(st.manager).reduce((t, r) => t + Number(r.reserved), 0) + (setAside.get(st.manager) ?? 0);
  standings.sort((a, b) => b.hoodies - a.hoodies || b.worth - a.worth);
  const mine = manager ? wallets.find((w) => w.manager === manager) : undefined;
  // The viewer's team orders waiting for Monday.
  const myOrders = manager
    ? (await sql<{ kind: string; asset: string; qty: number; reserved: string }[]>`
        select kind, asset, qty, reserved::text from market_orders where league_id = ${lid} and manager = ${manager} order by created_at`).map((r) => ({ kind: r.kind, asset: r.asset, qty: r.qty, reserved: Number(r.reserved) }))
    : [];
  const assetName = (id: string) => (isPlayer(id) ? (playerName.get(id) ?? "Player") : id === STORM ? "STORM · The Great Storm" : `${tick.get(id) ?? ""} · ${nameOf(id)}`);
  const myShorts = manager
    ? [...new Set(allShorts.filter((r) => r.manager === manager).map((r) => r.asset))].map((asset) => {
        const rows = shortRows.filter((r) => r.manager === manager && r.asset === asset);
        const wait = waitingOf(manager).filter((r) => r.asset === asset);
        const f = fair.get(asset);
        return {
          asset, name: assetName(asset), kind: isPlayer(asset) ? ("player" as const) : ("team" as const),
          shares: rows.reduce((n, r) => n + r.shares, 0),
          put: rows.reduce((n, r) => n + Number(r.entry) * r.shares, 0),
          value: rows.reduce((n, r) => n + (f ? shortValue(Number(r.entry), f, r.shares) : Number(r.entry) * r.shares), 0),
          waiting: wait.reduce((n, r) => n + r.shares, 0),
          waitingPut: wait.reduce((n, r) => n + Number(r.reserved), 0),
        };
      })
    : [];
  // What each manager has put into each holding: bucks spent buying minus bucks back from selling.
  const putIn = new Map<string, number>();
  for (const r of await sql<{ manager: string; team: string; n: string }[]>`
    select manager, team, sum(case when kind = 'buy' then amount else -amount end)::text as n from market_log
    where league_id = ${lid} and kind in ('buy', 'sell') and team is not null group by manager, team`)
    putIn.set(`${r.manager}|${r.team}`, Number(r.n));
  // Everyone's portfolio is public (like the ledger): cash, coin, hoodies, holdings and shorts at today's values.
  const portfolios = Object.fromEntries(
    wallets.map((w) => [
      w.manager,
      {
        bucks: Number(w.bucks), coins: Number(w.coins), hoodies: w.hoodies,
        worth: standings.find((x) => x.manager === w.manager)?.worth ?? 0,
        holdings: holdOf(w.manager)
          .map((h) => {
            const value = fair.has(h.team) ? sellValue(fair.get(h.team)!, held.get(h.team) ?? h.shares, h.shares) : 0;
            return { asset: h.team, name: assetName(h.team), shares: h.shares, value, gain: value - (putIn.get(`${w.manager}|${h.team}`) ?? value) };
          })
          .sort((a, b) => b.value - a.value),
        // One line per stock shorted: total shares and what closing them all would pay.
        shorts: [...new Set(shortRows.filter((r) => r.manager === w.manager).map((r) => r.asset))].map((asset) => {
          const rows = shortRows.filter((r) => r.manager === w.manager && r.asset === asset);
          const f = fair.get(asset);
          const value = rows.reduce((n, r) => n + (f ? shortValue(Number(r.entry), f, r.shares) : Number(r.entry) * r.shares), 0);
          return {
            asset, name: assetName(asset), shares: rows.reduce((n, r) => n + r.shares, 0), value,
            gain: value - rows.reduce((n, r) => n + Number(r.entry) * r.shares, 0),
          };
        }),
      },
    ]),
  );
  // What the viewer has put into each holding: bucks spent buying minus bucks back from selling.
  const invested = new Map<string, number>();
  if (mine)
    for (const r of await sql<{ team: string; n: string }[]>`
      select team, sum(case when kind = 'buy' then amount else -amount end)::text as n from market_log
      where league_id = ${lid} and manager = ${manager} and kind in ('buy', 'sell') and team is not null group by team`)
      invested.set(r.team, Number(r.n));
  return {
    teams,
    storm: stormStock,
    players,
    hoodiesSold,
    nextHoodie: hoodiePrice(hoodiesSold),
    coinRate: COIN_RATE,
    coinBack: COIN_BACK,
    standings,
    portfolios,
    teamWindow: teamOpen,
    feed: log.map((l) => {
      const [opp, x] = l.note?.split("|") ?? [];
      return {
        name: nameOf(l.manager), manager: l.manager, kind: l.kind, ticker: l.team ? (tick.get(l.team) ?? playerName.get(l.team) ?? null) : null, qty: l.qty, amount: Number(l.amount), at: l.at.toISOString(),
        upset: opp && x ? { vs: tick.get(opp) ?? null, x: Number(x) } : null,
        stormWeek: l.note === "storm",
        sign: l.note === "+" ? 1 : l.note === "-" ? -1 : 0,
      };
    }),
    wallet: mine
      ? { bucks: Number(mine.bucks), coins: Number(mine.coins), hoodies: mine.hoodies, holdings: holdOf(manager!).map((h) => {
          const f = fair.get(h.team);
          const value = f ? sellValue(f, held.get(h.team) ?? h.shares, h.shares) : 0;
          return {
            ...h, counting: counting(h.team, h.shares),
            name: isPlayer(h.team) ? (playerName.get(h.team) ?? "Player") : h.team === STORM ? "STORM · The Great Storm" : `${tick.get(h.team) ?? ""} · ${nameOf(h.team)}`,
            kind: isPlayer(h.team) ? ("player" as const) : h.team === STORM ? ("storm" as const) : ("team" as const),
            value, invested: invested.get(h.team) ?? 0,
          };
        }), worth: standings.find((s) => s.manager === manager)?.worth ?? 0, shorts: myShorts, orders: myOrders }
      : null,
    status: season.users.size ? "open" : "closed",
  };
}

export type Order = { kind: "buy" | "sell" | "short" | "cover" | "cancel"; team: string; qty: number } | { kind: "coin" | "uncoin"; qty: number } | { kind: "hoodie"; qty: number };

/** One order for one manager, all or nothing. Returns a plain message on refusal. */
export async function placeOrder(season: NonNullable<Awaited<ReturnType<typeof marketSeason>>>, manager: string, o: Order): Promise<{ ok: true } | { ok: false; error: string }> {
  const lid = season.leagueId;
  if (!Number.isInteger(o.qty) || o.qty < 1 || o.qty > MAX_QTY) return { ok: false, error: "Pick an amount between 1 and 500." };
  const recs = await records(lid);
  const storm = stormIds(season);
  const { board, fair: values } = await allValues(lid, recs, storm);
  if (isPlayer("team" in o ? o.team : "")) {
    const nba = board.find((p) => PLAYER + p.pid === (o as { team: string }).team)?.nba;
    // Fail closed: if the schedule can't be read, player trades wait.
    const locks = await locksNow(lid).catch(() => null);
    if (!locks) return { ok: false, error: "Player trading is paused for a minute. Try again shortly." };
    if (nba && locks.has(nba)) return { ok: false, error: "His game is on. Trading on him reopens at 6 AM Eastern." };
  }
  const sql = await db();
  return sql.begin(async (t) => {
    const tx = t as unknown as Sql;
    // Every order settles new results first; the full day's prices are written only when they're due.
    await repriceOnce(tx, lid, board, values);
    const { fair, held } = await settle(tx, lid, recs, values, await needsSettle(tx, lid, recs), storm);
    await tx`insert into market_wallets (league_id, manager, bucks) values (${lid}, ${manager}, ${START_BUCKS}) on conflict do nothing`;
    const [recent] = await tx<{ n: number }[]>`
      select count(*)::int as n from market_log where league_id = ${lid} and manager = ${manager} and kind <> 'dividend' and at > now() - interval '1 minute'`;
    if (recent.n >= 30) return { ok: false as const, error: "Easy, trader. Too many orders in a minute; try again shortly." };
    const ctx: Ctx = { lid, fair, held, board, storm };
    // Team stocks trade on Mondays only (see teamWindowOpen); the rest of the week they're closed.
    if ("team" in o && !isPlayer(o.team) && o.kind !== "cancel" && !(await teamWindowOpen(tx, lid)))
      return { ok: false as const, error: "Team stocks trade on Mondays before 7 PM Eastern, once last week's results are in." };
    return execute(tx, ctx, manager, o);
  });
}

type Ctx = { lid: string; fair: Map<string, number>; held: Map<string, number>; board: PlayerLine[]; storm: string[] };

/** Monday before 7 PM Eastern, once last week's results have posted: team orders go through right away. */
async function teamWindowOpen(tx: Sql, lid: string): Promise<boolean> {
  const [{ posted }] = await tx<{ posted: boolean }[]>`
    select coalesce(max(result_at) >= ${await weekStart(tx)}, false) as posted from market_teams where league_id = ${lid}`;
  const now = new Date();
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(now));
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(now));
  return teamShortOpenNow(day, hour, posted);
}

/** Monday's open: every waiting team order goes through at the new prices, oldest first. */
async function fillOrders(tx: Sql, ctx: Ctx) {
  const orders = await tx<{ id: string; manager: string; kind: "buy" | "sell" | "cover"; asset: string; qty: number; reserved: string }[]>`
    select id::text, manager, kind, asset, qty, reserved::text from market_orders where league_id = ${ctx.lid} order by created_at, id for update`;
  for (const od of orders) {
    await tx`delete from market_orders where id = ${od.id}`;
    const f = ctx.fair.get(od.asset);
    let qty = od.qty;
    if (od.kind === "buy") {
      // Give the set-aside bucks back, then buy as many as they cover at Monday's price (up to the order).
      await tx`update market_wallets set bucks = bucks + ${Number(od.reserved)} where league_id = ${ctx.lid} and manager = ${od.manager}`;
      if (!f) continue;
      const h = ctx.held.get(od.asset) ?? 0;
      while (qty > 0 && buyCost(f, h, qty) > Number(od.reserved)) qty--;
    } else if (od.kind === "sell") {
      const [mine] = await tx<{ shares: number }[]>`select shares from market_holdings where league_id = ${ctx.lid} and manager = ${od.manager} and team = ${od.asset}`;
      qty = Math.min(qty, mine?.shares ?? 0);
    } else {
      const [mine] = await tx<{ n: number }[]>`
        select coalesce(sum(shares), 0)::int as n from market_shorts where league_id = ${ctx.lid} and manager = ${od.manager} and asset = ${od.asset} and not pending`;
      qty = Math.min(qty, mine.n);
    }
    if (qty > 0) await execute(tx, ctx, od.manager, { kind: od.kind, team: od.asset, qty });
  }
}

/** Carry out one order now (inside the per-league lock). */
async function execute(tx: Sql, ctx: Ctx, manager: string, o: Order): Promise<{ ok: true } | { ok: false; error: string }> {
  const { lid, fair, held, board, storm } = ctx;
  {
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
        if (o.team === STORM && storm.includes(manager)) return { ok: false as const, error: "You're part of The Great Storm, so you can't buy it." };
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
    } else if (o.kind === "cancel") {
      // Cancel everything waiting on this stock: Monday orders and waiting shorts.
      const waiting = await tx<{ id: string; reserved: string }[]>`
        select id::text, reserved::text from market_shorts where league_id = ${lid} and manager = ${manager} and asset = ${o.team} and pending for update`;
      const orders = await tx<{ reserved: string }[]>`
        delete from market_orders where league_id = ${lid} and manager = ${manager} and asset = ${o.team} returning reserved::text`;
      if (!waiting.length && !orders.length) return { ok: false as const, error: "Nothing waiting to cancel." };
      const back = waiting.reduce((t, w) => t + Number(w.reserved), 0) + orders.reduce((t, w) => t + Number(w.reserved), 0);
      await tx`delete from market_shorts where league_id = ${lid} and manager = ${manager} and asset = ${o.team} and pending`;
      await tx`update market_wallets set bucks = bucks + ${back} where league_id = ${lid} and manager = ${manager}`;
      await tx`insert into market_log (league_id, manager, kind, team, qty, amount) values (${lid}, ${manager}, 'cancel', ${o.team}, ${waiting.length + orders.length}, ${back})`;
    } else if (o.kind === "short" || o.kind === "cover") {
      // Shorts work off the stats-only value (no buying demand), pay no coin, and can't lose more than was put up.
      const f = fair.get(o.team);
      // Opening needs a value; closing one whose value is gone returns the collateral (no gain or loss).
      if (!f && o.kind === "short") return { ok: false as const, error: "That isn't on the board." };
      if (o.team === STORM) return { ok: false as const, error: "The Great Storm can't be shorted." };
      if (o.kind === "short") {
        if (o.team === manager) return { ok: false as const, error: "You can't short your own team." };
        if (isPlayer(o.team) && board.some((p) => PLAYER + p.pid === o.team && p.owner === manager))
          return { ok: false as const, error: "You can't short a player on your own roster." };
        const put = f! * o.qty;
        if (put > bucks) return { ok: false as const, error: "Not enough Bushy Bucks to put up for that short." };
        await tx`update market_wallets set bucks = bucks - ${put} where league_id = ${lid} and manager = ${manager}`;
        await tx`insert into market_shorts (league_id, manager, asset, shares, entry) values (${lid}, ${manager}, ${o.team}, ${o.qty}, ${f!})`;
        await tx`insert into market_log (league_id, manager, kind, team, qty, amount) values (${lid}, ${manager}, 'short', ${o.team}, ${o.qty}, ${put})`;
      } else {
        const lots = await tx<{ id: string; shares: number; entry: string }[]>`
          select id::text, shares, entry::text from market_shorts where league_id = ${lid} and manager = ${manager} and asset = ${o.team} and shares > 0 and not pending
          order by opened_at, id for update`;
        if (lots.reduce((n, l) => n + l.shares, 0) < o.qty) return { ok: false as const, error: "You aren't short that many shares." };
        let left = o.qty;
        let back = 0;
        for (const l of lots) {
          if (!left) break;
          const take = Math.min(left, l.shares);
          back += shortValue(Number(l.entry), f ?? Number(l.entry), take);
          if (take === l.shares) await tx`delete from market_shorts where id = ${l.id}`;
          else await tx`update market_shorts set shares = shares - ${take} where id = ${l.id}`;
          left -= take;
        }
        await tx`update market_wallets set bucks = bucks + ${back} where league_id = ${lid} and manager = ${manager}`;
        await tx`insert into market_log (league_id, manager, kind, team, qty, amount) values (${lid}, ${manager}, 'cover', ${o.team}, ${o.qty}, ${back})`;
      }
    } else if (o.kind === "coin") {
      const cost = COIN_RATE * o.qty;
      if (cost > bucks) return { ok: false as const, error: "Not enough Bushy Bucks for that much Perren Coin." };
      await tx`update market_wallets set bucks = bucks - ${cost}, coins = coins + ${o.qty * 100} where league_id = ${lid} and manager = ${manager}`;
      await tx`insert into market_log (league_id, manager, kind, qty, amount) values (${lid}, ${manager}, 'coin', ${o.qty}, ${cost})`;
    } else if (o.kind === "uncoin") {
      // Cash coin back into bucks at the lower cash-in rate (whole coins).
      if (o.qty * 100 > coins) return { ok: false as const, error: "You don't have that much Perren Coin." };
      const pay = COIN_BACK * o.qty;
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
    if (o.kind === "buy" || o.kind === "sell") {
      held.set(o.team, (held.get(o.team) ?? 0) + (o.kind === "buy" ? o.qty : -o.qty));
      await savePrices(tx, lid, fair, [o.team]);
    }
    return { ok: true as const };
  }
}
