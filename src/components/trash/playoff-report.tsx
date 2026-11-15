"use client";

import { useState } from "react";
import { MgrPhoto, useBrand } from "@/components/trash/brand";
import { Explain, Segmented } from "@/components/trash/intel";
import type { PlayoffRow } from "@/lib/core/trapezoid";

type Person = { id: string; nick: string };
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");

/** Postseason track record, kept apart from the regular-season trapezoid. */
export function PlayoffReport({ rows, people, years }: { rows: PlayoffRow[]; people: Person[]; years: Record<string, string> }) {
  const brand = useBrand();
  const nick = (id: string) => people.find((p) => p.id === id)?.nick ?? brand.names?.[id] ?? id;
  const [sort, setSort] = useState<"titles" | "rate" | "scoring">("titles");
  if (!rows.some((r) => r.eligible)) return <p className="text-[var(--muted)]">Insufficient data: no finished seasons yet.</p>;
  const sorted = [...rows].sort((a, b) =>
    sort === "rate"
      ? b.apps / (b.eligible || 1) - a.apps / (a.eligible || 1) || b.apps - a.apps
      : sort === "scoring"
        ? (b.lift ?? -Infinity) - (a.lift ?? -Infinity)
        : b.titles.length - a.titles.length || b.finals - a.finals || b.w - a.w,
  );
  const cols = ["Manager", "Playoffs", "Record", "Titles", "Finals", "Semis", "Upsets", "Pts / game (per Sleeper)", "vs regular season (per Sleeper)"];
  return (
    <div>
      <Segmented
        id="po-sort"
        value={sort}
        options={[
          ["titles", "Rings"],
          ["rate", "Playoff rate"],
          ["scoring", "Playoff scoring"],
        ]}
        onChange={setSort}
      />
      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[48rem] text-sm tabular-nums">
          <thead className="text-left text-xs text-[var(--muted)]">
            <tr className="border-b border-white/10">
              {cols.map((h) => (
                <th key={h} scope="col" className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className="border-b border-white/5">
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2 font-semibold">
                    <MgrPhoto id={r.id} alt="" width={24} height={24} className="size-6 shrink-0 rounded-full object-cover" />
                    <span className="break-words">{nick(r.id)}</span>
                  </span>
                </td>
                <td className="px-3 py-2">
                  {r.apps} of {r.eligible} ({pct(r.apps, r.eligible)})
                </td>
                <td className="px-3 py-2">
                  {r.w}–{r.l}
                  {r.w + r.l ? <span className="text-[var(--muted)]"> ({pct(r.w, r.w + r.l)})</span> : null}
                </td>
                <td className={`px-3 py-2 ${r.titles.length ? "font-semibold text-[var(--gold)]" : ""}`}>
                  {r.titles.length ? `${r.titles.length} (${r.titles.map((c) => years[c] ?? c).join(", ")})` : "0"}
                </td>
                <td className="px-3 py-2">{r.finals}</td>
                <td className="px-3 py-2">{r.semis}</td>
                <td className="px-3 py-2">
                  {r.upsetWins} won, {r.upsetLosses} lost
                </td>
                <td className="px-3 py-2">{r.ppm === null ? "Unavailable" : `${r.ppm.toFixed(1)} (${r.ppmGames} game${r.ppmGames === 1 ? "" : "s"})`}</td>
                <td className={`px-3 py-2 ${r.lift !== null && r.lift > 0 ? "text-[#7fd49a]" : ""}`}>
                  {r.lift === null ? "Unavailable" : `${r.lift >= 0 ? "+" : "−"}${Math.abs(r.lift).toFixed(1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Explain title="How the playoff report works">
        <ul className="list-disc space-y-1 pl-5">
          <li>Only finished seasons count, so this season is never a missed playoff.</li>
          <li>Record, titles, finals and semifinals come from the winners bracket.</li>
          <li>Upsets: playoff wins over a better seed, and losses to a worse one.</li>
          <li>
            Points per game are Sleeper&apos;s weekly playoff scores (per Sleeper), with the number of games beside them: one big game
            isn&apos;t a track record.
          </li>
          <li>
            &ldquo;vs regular season&rdquo; compares each playoff game with that manager&apos;s regular-season weekly average from the
            same season, as a share of that season&apos;s league average, so different seasons compare fairly. Both come from the same
            weekly scores. &ldquo;Unavailable&rdquo; means the scores couldn&apos;t be matched to the bracket; nothing is estimated.
          </li>
        </ul>
      </Explain>
    </div>
  );
}
