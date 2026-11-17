import type { FOPlayer, FOTeam } from "@/lib/core/front-office";

/** Small seeded random numbers, so every run sees the same "random" leagues. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export const NBA_SLOTS = ["PG", "SG", "G", "SF", "PF", "F", "C", "UTIL", "UTIL"];
export const NFL_SLOTS = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DEF"];

export function player(pid: string, pos: string[], value: number, extra: Partial<FOPlayer> = {}): FOPlayer {
  return {
    pid,
    name: `Player ${pid}`,
    team: "XXX",
    pos,
    injury: null,
    value,
    ppg: value / 2,
    gp: 10,
    prev: value / 2,
    onIR: false,
    now: value,
    weeks: 5,
    expected: value,
    recent: value / 2,
    min: 30,
    minRecent: 30,
    ...extra,
  };
}

/** A made-up basketball league: `teams` rosters of `size`, values 10-70, a few injuries. */
export function league(seed: number, teams = 6, size = 13) {
  const r = rng(seed);
  const POS = [["PG"], ["SG"], ["PG", "SG"], ["SF"], ["PF"], ["SF", "PF"], ["C"], ["PF", "C"]];
  const P: Record<string, FOPlayer> = {};
  const T: FOTeam[] = [];
  let n = 0;
  for (let t = 0; t < teams; t++) {
    const ids: string[] = [];
    for (let i = 0; i < size; i++) {
      const pid = `p${n++}`;
      const roll = r();
      P[pid] = player(pid, POS[Math.floor(r() * POS.length)], Math.round(10 + r() * 60), {
        injury: roll < 0.06 ? "Out" : roll < 0.1 ? "Questionable" : null,
        onIR: roll > 0.97,
      });
      ids.push(pid);
    }
    T.push({ id: `team${t}`, team: `Team ${t}`, players: ids });
  }
  return { P, T };
}
