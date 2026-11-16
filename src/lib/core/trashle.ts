import type { Dataset } from "@/lib/core/types";
import { poolFor, withPool } from "@/lib/core/daily-pool";

/**
 * Trashle: a daily Wordle where the answer is the last name of a player with real history
 * on Trash rosters. Guesses must be the last name of any player who has ever been in the
 * league's data, so every guess is on-theme.
 */
export type TrashleWord = {
  word: string;
  pid: string;
  pos: string;
  team: string;
  /** Manager who rostered him the longest, and for how many weeks. */
  owner: string;
  weeks: number;
};

const SUFFIX = /\b(jr|sr|ii|iii|iv|v)\b\.?/gi;
export const lastWord = (name: string) => {
  const parts = name.replace(SUFFIX, "").trim().split(/\s+/);
  const last = parts.length > 1 ? parts.slice(1).join("") : parts[0];
  return last
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase();
};

export function trashle(d: Dataset): { answers: TrashleWord[]; valid: string[]; shared: TrashleWord[] } {
  const raw = d.extras;
  const players = withPool(d.extras.players, d.sport);
  const league = d.league;
  const weeks = new Map<string, Map<string, number>>();
  for (const s of raw.seasons)
    for (const [m, ps] of Object.entries(s.guys))
      for (const [pid, [w]] of Object.entries(ps)) {
        const by = weeks.get(pid) ?? new Map<string, number>();
        by.set(m, (by.get(m) ?? 0) + w);
        weeks.set(pid, by);
      }
  const nick = (id: string) => league.managers.find((m) => m.id === id)?.nick ?? id;
  const valid = new Set<string>();
  const answers: TrashleWord[] = [];
  const seen = new Set<string>();
  for (const [pid, p] of Object.entries(players)) {
    const w = lastWord(p[0]);
    if (w.length < 4 || w.length > 7) continue;
    valid.add(w);
    const by = weeks.get(pid);
    const total = by ? [...by.values()].reduce((a, b) => a + b, 0) : 0;
    // Answers: players the league actually knows (20+ weeks rostered), one per surname.
    if (total < 20 || seen.has(w) || !p[3]) continue;
    seen.add(w);
    const [owner, ow] = [...by!.entries()].sort((a, b) => b[1] - a[1])[0];
    answers.push({ word: w, pid, pos: p[1].join("/"), team: p[2], owner: nick(owner), weeks: ow });
  }
  answers.sort((a, b) => a.word.localeCompare(b.word));
  // The shared daily list: the sport's pool in its fixed order, with this league's history for each
  // (owner "" and 0 weeks when nobody here ever rostered him).
  const shared: TrashleWord[] = [];
  for (const [pid, name, pos, team] of poolFor(d.sport)) {
    const w = lastWord(name);
    if (w.length < 4 || w.length > 7) continue;
    const by = weeks.get(pid);
    const top = by ? [...by.entries()].sort((a, b) => b[1] - a[1])[0] : null;
    shared.push({ word: w, pid, pos: pos.join("/"), team, owner: top ? nick(top[0]) : "", weeks: top ? top[1] : 0 });
  }
  return { answers, valid: [...valid].sort(), shared };
}
