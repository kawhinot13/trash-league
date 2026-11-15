import { sportOf, type Sport } from "@/lib/core/sport";
import type { Family, SeasonBundle } from "@/lib/app/family";
import { avatarUrl, official, seasonYears, type SBracket } from "@/lib/app/sleeper";

/** Pure derivations from a family's Sleeper data: no I/O, safe on server and client. */

export type Team = {
  rosterId: number;
  ownerId: string | null;
  name: string;
  team: string;
  avatar: string | null;
  w: number;
  l: number;
  t: number;
  pf: number;
  pa: number;
  ppts: number;
  seed: number;
  record: string;
  streak: string;
};
export type Finish = "Champion" | "Runner-up" | "Third" | "Semifinal" | "Playoffs" | null;
export type SeasonView = {
  leagueId: string;
  season: string;
  years: string;
  name: string;
  status: string;
  complete: boolean;
  teams: Team[];
  champion: Team | null;
  runnerUp: Team | null;
  /** Regular-season #1 (by record, then official points for). */
  top: Team | null;
  finish: Map<number, Finish>;
  firstRound: { no: number; pid: string; player: string; team: Team | null }[];
  weeksDone: number;
};

const r1 = (x: number) => Math.round(x * 10) / 10;

function teamsOf(b: SeasonBundle): Team[] {
  const users = new Map(b.users.map((u) => [u.user_id, u]));
  const rows = b.rosters.map((r) => {
    const u = r.owner_id ? users.get(r.owner_id) : undefined;
    const o = official(r.settings ?? {});
    return {
      rosterId: r.roster_id,
      ownerId: r.owner_id ?? null,
      name: u?.display_name ?? "Open team",
      team: u?.metadata?.team_name || u?.display_name || `Team ${r.roster_id}`,
      avatar: avatarUrl(u?.metadata?.avatar || u?.avatar),
      w: r.settings?.wins ?? 0,
      l: r.settings?.losses ?? 0,
      t: r.settings?.ties ?? 0,
      pf: r1(o.pf),
      pa: r1(o.pa),
      ppts: r1(o.ppts),
      seed: 0,
      record: r.metadata?.record ?? "",
      streak: r.metadata?.streak ?? "",
    };
  });
  rows.sort((a, b) => b.w + b.t / 2 - (a.w + a.t / 2) || b.pf - a.pf);
  rows.forEach((r, i) => (r.seed = i + 1));
  return rows;
}

/** Sleeper marks the title game with p: 1 (and third place with p: 3). */
function finishes(winners: SBracket[], complete: boolean): Map<number, Finish> {
  const out = new Map<number, Finish>();
  if (!winners.length) return out;
  const maxR = Math.max(...winners.map((m) => m.r));
  for (const m of winners) for (const t of [m.t1, m.t2]) if (t != null && !out.has(t)) out.set(t, "Playoffs");
  for (const m of winners)
    // Semifinals feed the title game: winners of earlier games (consolation games come from losers).
    if (m.r === maxR - 1 && (m.r === 1 || m.t1_from?.w != null)) for (const t of [m.t1, m.t2]) if (t != null) out.set(t, "Semifinal");
  if (!complete) return out;
  const title = winners.find((m) => m.p === 1);
  const third = winners.find((m) => m.p === 3);
  if (third?.w) out.set(third.w, "Third");
  if (title?.w) out.set(title.w, "Champion");
  if (title?.l) out.set(title.l, "Runner-up");
  return out;
}

export function seasonView(b: SeasonBundle): SeasonView {
  const teams = teamsOf(b);
  const byRoster = new Map(teams.map((t) => [t.rosterId, t]));
  const complete = b.league.status === "complete";
  const fin = finishes(b.winners, complete);
  const title = complete ? b.winners.find((m) => m.p === 1) : undefined;
  const n = b.league.total_rosters || teams.length;
  const firstRound = [...b.picks]
    .sort((a, c) => a.pick_no - c.pick_no)
    .slice(0, n)
    .map((p) => ({
      no: p.pick_no,
      pid: p.player_id,
      player: `${p.metadata?.first_name ?? ""} ${p.metadata?.last_name ?? ""}`.trim() || p.player_id,
      team: byRoster.get(p.roster_id) ?? null,
    }));
  return {
    leagueId: b.league.league_id,
    season: b.league.season,
    years: seasonYears(b.league.season, sportOf(b.league)),
    name: b.league.name,
    status: b.league.status,
    complete,
    teams,
    champion: title?.w ? (byRoster.get(title.w) ?? null) : null,
    runnerUp: title?.l ? (byRoster.get(title.l) ?? null) : null,
    top: teams[0] && teams.some((t) => t.w + t.l + t.t > 0) ? teams[0] : null,
    finish: fin,
    firstRound,
    weeksDone: Math.max(0, ...b.rosters.map((r) => (r.metadata?.record ?? "").length)),
  };
}

export type Career = {
  ownerId: string;
  name: string;
  team: string;
  avatar: string | null;
  seasons: number;
  w: number;
  l: number;
  t: number;
  pct: number;
  pf: number;
  titles: string[];
  finals: number;
  playoffs: number;
  best: Finish;
  /** Most recent season played. */
  last: string;
};

const RANK: Record<string, number> = { Champion: 5, "Runner-up": 4, Third: 3, Semifinal: 2, Playoffs: 1 };

/** Every manager across every season, keyed by Sleeper user id (stable across renewals). */
export function careers(seasons: SeasonView[]): Career[] {
  const by = new Map<string, Career>();
  for (const s of seasons)
    for (const t of s.teams) {
      if (!t.ownerId) continue;
      const c =
        by.get(t.ownerId) ??
        ({ ownerId: t.ownerId, name: t.name, team: t.team, avatar: t.avatar, seasons: 0, w: 0, l: 0, t: 0, pct: 0, pf: 0, titles: [], finals: 0, playoffs: 0, best: null, last: s.season } as Career);
      c.seasons += 1;
      c.w += t.w;
      c.l += t.l;
      c.t += t.t;
      c.pf = r1(c.pf + t.pf);
      // Names and avatars follow the most recent season.
      if (s.season >= c.last) Object.assign(c, { name: t.name, team: t.team, avatar: t.avatar, last: s.season });
      const f = s.finish.get(t.rosterId) ?? null;
      if (f) c.playoffs += 1;
      if (f === "Champion") c.titles.push(s.years);
      if (f === "Champion" || f === "Runner-up") c.finals += 1;
      if (f && (RANK[f] ?? 0) > (RANK[c.best ?? ""] ?? 0)) c.best = f;
      by.set(t.ownerId, c);
    }
  const out = [...by.values()].map((c) => {
    const gp = c.w + c.l + c.t;
    return { ...c, pct: gp ? (c.w + c.t / 2) / gp : 0 };
  });
  return out.sort((a, b) => b.titles.length - a.titles.length || b.finals - a.finals || b.pct - a.pct);
}

export type FamilyView = {
  id: string;
  name: string;
  seasons: SeasonView[];
  current: SeasonView;
  careers: Career[];
  avatar: string | null;
  /** Basketball or football (from the newest season). */
  sport: Sport;
};

export function familyView(f: Family): FamilyView {
  const seasons = f.seasons.map(seasonView);
  const current = seasons[seasons.length - 1];
  return {
    id: f.id,
    name: current.name,
    seasons,
    current,
    careers: careers(seasons),
    avatar: avatarUrl(f.seasons[f.seasons.length - 1].league.avatar),
    sport: sportOf(f.seasons[f.seasons.length - 1].league),
  };
}

export const recordStr = (x: { w: number; l: number; t: number }) => `${x.w}–${x.l}${x.t ? `–${x.t}` : ""}`;
