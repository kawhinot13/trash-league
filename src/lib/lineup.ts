import data from "@/data/extras.json";
import { players } from "@/lib/extras";
import { league } from "@/lib/league";

/**
 * The Lineup: identify today's mystery player. Every guess is compared on a mix of NBA bio
 * and Trash history, so knowing the league matters as much as knowing basketball.
 */
export type Suspect = {
  pid: string;
  name: string;
  team: string;
  conf: "East" | "West" | "";
  pos: string[];
  height: number;
  /** Total weeks on any Trash roster. */
  weeks: number;
  /** Manager who rostered him the longest. */
  owner: string;
  /** Every manager who ever rostered him. */
  owners: string[];
  /** First Trash season he was on a roster, 1-4. */
  first: number;
};

const EAST = new Set(["ATL", "BOS", "BKN", "CHA", "CHI", "CLE", "DET", "IND", "MIA", "MIL", "NYK", "ORL", "PHI", "TOR", "WAS"]);
type Raw = { seasons: { code: string; guys: Record<string, Record<string, [number, number, number]>> }[] };
const raw = data as unknown as Raw;

export function lineup(): { suspects: Suspect[]; answers: string[]; nicks: Record<string, string> } {
  const by = new Map<string, Map<string, number>>();
  const first = new Map<string, number>();
  raw.seasons.forEach((s, si) => {
    for (const [m, ps] of Object.entries(s.guys))
      for (const [pid, [w]] of Object.entries(ps)) {
        if (!w) continue;
        const b = by.get(pid) ?? new Map<string, number>();
        b.set(m, (b.get(m) ?? 0) + w);
        by.set(pid, b);
        if (!first.has(pid) || first.get(pid)! > si + 1) first.set(pid, si + 1);
      }
  });
  const suspects: Suspect[] = [];
  for (const [pid, p] of Object.entries(players)) {
    const b = by.get(pid);
    if (!b || !p[4]) continue;
    const owners = [...b.entries()].sort((x, y) => y[1] - x[1]);
    suspects.push({
      pid,
      name: p[0],
      team: p[2] || "FA",
      conf: p[2] ? (EAST.has(p[2]) ? "East" : "West") : "",
      pos: p[1],
      height: p[4],
      weeks: owners.reduce((t, [, w]) => t + w, 0),
      owner: owners[0][0],
      owners: owners.map(([m]) => m),
      first: first.get(pid) ?? 1,
    });
  }
  suspects.sort((a, b) => a.name.localeCompare(b.name));
  const answers = suspects.filter((s) => s.weeks >= 20 && players[s.pid][3]).map((s) => s.pid);
  const nicks = Object.fromEntries(league.managers.map((m) => [m.id, m.nick]));
  return { suspects, answers, nicks };
}
