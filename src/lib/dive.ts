import data from "@/data/extras.json";
import { players } from "@/lib/extras";
import { league } from "@/lib/league";

/**
 * Dumpster Dive: five "name a player who…" prompts a day where the more niche your
 * correct answer, the more it scores. Obscurity is measured from league history: how many
 * total weeks a player has spent on any Trash roster, ever. The deepest valid answer is
 * worth 100, the most obvious one 0, everything else in between by rank.
 */
export type Prompt = {
  kind: string;
  prompt: string;
  /** [pid, niche score 0-100] for every valid answer */
  answers: [string, number][];
};

type Raw = {
  seasons: {
    code: string;
    status: string;
    draft: { pid: string; by: string; round: number }[];
    trades: { sides: Record<string, string[]> }[];
    playoffs: { starters: [string, number][] }[];
    guys: Record<string, Record<string, [number, number, number]>>;
  }[];
};
const raw = data as unknown as Raw;

const nick = (id: string) => league.managers.find((m) => m.id === id)?.nick ?? id;

/** Total weeks on any Trash roster, all seasons, all managers. */
function fame() {
  const f = new Map<string, number>();
  for (const s of raw.seasons)
    for (const ps of Object.values(s.guys))
      for (const [pid, [weeks]] of Object.entries(ps)) f.set(pid, (f.get(pid) ?? 0) + weeks);
  return f;
}

function score(pids: Iterable<string>, f: Map<string, number>): [string, number][] {
  const list = [...new Set(pids)].filter((p) => players[p]?.[0]);
  const n = list.length;
  return list
    .map((p) => {
      const mine = f.get(p) ?? 0;
      const less = list.filter((q) => (f.get(q) ?? 0) > mine).length; // more famous than me
      return [p, Math.round((100 * less) / Math.max(1, n - 1))] as [string, number];
    })
    .sort((a, b) => b[1] - a[1]);
}

export function divePool(): Prompt[] {
  const f = fame();
  const years = Object.fromEntries(league.seasons.map((s) => [s.code, s.years]));
  const active = league.seasons.find((s) => s.code === "s4")!.standings.map((r) => r.manager);
  const out: Prompt[] = [];
  const add = (kind: string, prompt: string, pids: Iterable<string>) => {
    const answers = score(pids, f);
    if (answers.length >= 8) out.push({ kind, prompt, answers });
  };

  for (const m of active) {
    const started = raw.seasons.flatMap((s) =>
      Object.entries(s.guys[m] ?? {})
        .filter(([, v]) => v[1] > 0)
        .map(([p]) => p),
    );
    add("Starters", `Name a player ${nick(m)} has started.`, started);
    add(
      "Draft night",
      `Name a player ${nick(m)} has drafted.`,
      raw.seasons.flatMap((s) => s.draft.filter((d) => d.by === m).map((d) => d.pid)),
    );
    for (const s of raw.seasons.filter((x) => x.status === "complete"))
      add("Locker room", `Name a player who was on ${nick(m)}'s roster in ${years[s.code]}.`, Object.keys(s.guys[m] ?? {}));
  }
  for (const s of raw.seasons) {
    const traded = s.trades.flatMap((t) => Object.values(t.sides).flat()).filter((p) => !p.startsWith("pick:"));
    add("Trade log", `Name a player who was traded in ${years[s.code]}.`, traded);
    if (s.playoffs.length)
      add(
        "Playoffs",
        `Name a player who started a playoff game in ${years[s.code]}.`,
        s.playoffs.flatMap((g) => g.starters.map(([p]) => p)),
      );
  }
  const managersOf = new Map<string, Set<string>>();
  for (const s of raw.seasons)
    for (const [m, ps] of Object.entries(s.guys))
      for (const p of Object.keys(ps)) (managersOf.get(p) ?? managersOf.set(p, new Set()).get(p)!).add(m);
  add(
    "Journeymen",
    "Name a player who has been on at least three different Trash rosters.",
    [...managersOf].filter(([, ms]) => ms.size >= 3).map(([p]) => p),
  );
  add(
    "First round",
    "Name a player taken in the first round of any Trash draft.",
    raw.seasons.flatMap((s) => s.draft.filter((d) => d.round === 1).map((d) => d.pid)),
  );
  return out;
}
