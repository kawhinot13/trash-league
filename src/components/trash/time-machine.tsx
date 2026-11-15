"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import type { MachineSeason, Players } from "@/lib/extras";
import type { Manager } from "@/lib/league";
import { Explain } from "./intel";
import { Face, pname } from "./player";
import { MgrPhoto } from "@/components/trash/brand";

type Stop = { si: number; week: number };
type Arrival =
  | { how: "draft"; no?: number }
  | { how: "trade"; from: string; week: number }
  | { how: "wire"; week: number };

const NEW = "#7fd49a";

export function TimeMachine({
  seasons,
  players,
  managers,
}: {
  seasons: MachineSeason[];
  players: Players;
  managers: Manager[];
}) {
  const stops = useMemo<Stop[]>(
    () =>
      seasons.flatMap((s, si) =>
        Array.from({ length: s.weeks + 1 }, (_, week) => ({ si, week })),
      ),
    [seasons],
  );
  // Open on the busiest trade week of the busiest season: the machine should show movement first.
  const start = useMemo(() => {
    let best = 0;
    let n = -1;
    stops.forEach((st, i) => {
      const c = seasons[st.si].trades.filter((t) => t.week === st.week).length;
      if (c > n) {
        n = c;
        best = i;
      }
    });
    return best;
  }, [stops, seasons]);
  const [i, setI] = useState(start);
  const [who, setWho] = useState("RI3O");
  const [playing, setPlaying] = useState(false);
  const reduce = useReducedMotion();
  const nick = (id: string) => managers.find((m) => m.id === id)?.nick ?? id;

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setI((x) => {
        if (x >= stops.length - 1) {
          setPlaying(false);
          return x;
        }
        return x + 1;
      });
    }, 750);
    return () => clearInterval(t);
  }, [playing, stops.length]);

  const { si, week } = stops[i];
  const S = seasons[si];
  const owners = Object.keys(S.rosters["0"]);
  const active = owners.includes(who) ? who : owners[0];
  const roster = S.rosters[String(week)]?.[active] ?? [];
  const prev = week > 0 ? (S.rosters[String(week - 1)]?.[active] ?? []) : roster;
  const weekTrades = S.trades.filter((t) => t.week === week && week > 0);

  const arrival = (pid: string): Arrival => {
    let f = week;
    while (f > 0 && S.rosters[String(f - 1)]?.[active]?.includes(pid)) f--;
    if (f === 0) return { how: "draft", no: S.draft[`${active}|${pid}`] };
    const t = S.trades.find((x) => x.week === f && x.sides[active]?.includes(pid));
    if (t)
      return {
        how: "trade",
        from: Object.keys(t.sides).find((k) => k !== active) ?? "",
        week: f,
      };
    return { how: "wire", week: f };
  };
  const gone = prev
    .filter((p) => !roster.includes(p))
    .map((pid) => {
      const t = weekTrades.find(
        (x) => !x.sides[active]?.includes(pid) && Object.values(x.sides).some((v) => v.includes(pid)),
      );
      const to = t
        ? Object.keys(t.sides).find((k) => t.sides[k].includes(pid))
        : undefined;
      return { pid, to };
    });
  const kept = (m: string) => {
    const d = S.rosters["0"][m] ?? [];
    const now = S.rosters[String(week)]?.[m] ?? [];
    return { n: d.filter((p) => now.includes(p)).length, of: d.length };
  };
  const tickets = seasons.map((s, k) => ({
    s,
    at: stops.findIndex((x) => x.si === k),
  }));

  return (
    <div className="rounded-[28px] border border-white/10 bg-[rgba(16,40,30,0.55)] p-5 md:p-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div aria-live="polite">
          <p className="text-sm text-[var(--muted)]">{S.years}</p>
          <p className="font-display text-[clamp(3rem,8vw,5.5rem)] leading-[0.85] font-black tabular-nums">
            {week === 0 ? "Draft day" : `Week ${week}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!playing && i >= stops.length - 1) setI(0);
            setPlaying((p) => !p);
          }}
          className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-full bg-[var(--paper)] px-6 font-semibold text-[var(--bin)] transition-transform duration-150 active:scale-[0.97]"
        >
          <span aria-hidden className="text-sm">
            {playing ? "❚❚" : "▶"}
          </span>
          {playing ? "Pause" : "Play the seasons"}
        </button>
      </div>

      <div className="mt-6">
        <input
          type="range"
          min={0}
          max={stops.length - 1}
          value={i}
          onChange={(e) => {
            setPlaying(false);
            setI(Number(e.target.value));
          }}
          aria-label="Point in league history"
          aria-valuetext={`${S.years}, ${week === 0 ? "draft day" : `week ${week}`}`}
          className="tm-range h-10 w-full cursor-pointer"
          style={{ ["--p" as string]: `${(i / (stops.length - 1)) * 100}%` }}
        />
        <div className="relative mt-1 h-5 text-xs text-[var(--muted)]">
          {tickets.map(({ s, at }) => (
            <button
              key={s.code}
              type="button"
              onClick={() => {
                setPlaying(false);
                setI(at);
              }}
              className="absolute cursor-pointer whitespace-nowrap hover:text-[var(--paper)]"
              style={{
                left: `${(at / (stops.length - 1)) * 100}%`,
                transform: at > stops.length * 0.9 ? "translateX(-100%)" : undefined,
              }}
            >
              <span className="sm:hidden">S{s.code.slice(1)}</span>
              <span className="hidden sm:inline">{s.years}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Pick a team">
        {owners.map((m) => {
          const on = m === active;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setWho(m)}
              aria-pressed={on}
              title={m}
              aria-label={nick(m)}
              className={`relative size-11 cursor-pointer rounded-full transition-[transform,opacity] duration-200 ${on ? "scale-110" : "opacity-55 hover:opacity-100"}`}
            >
              <MgrPhoto
                id={m}
                alt=""
                width={44}
                height={44}
                className="size-11 rounded-full object-cover"
              />
              {on ? (
                <motion.span
                  layoutId="tm-ring"
                  className="absolute -inset-1 rounded-full ring-2 ring-[var(--paper)]"
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <section aria-label={`${nick(active)} roster`}>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-display text-3xl font-black md:text-4xl">
              {nick(active)}&apos;s locker
            </h3>
            <p className="text-sm text-[var(--muted)] tabular-nums">
              {kept(active).n} of {kept(active).of} draft picks left
            </p>
          </div>
          <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <AnimatePresence mode="popLayout" initial={false}>
              {roster.map((pid) => {
                const a = arrival(pid);
                const fresh = week > 0 && !prev.includes(pid);
                return (
                  <motion.li
                    key={pid}
                    layout={!reduce}
                    initial={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
                    transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                    className="flex items-center gap-3 rounded-2xl border bg-black/20 p-2.5"
                    style={{ borderColor: fresh ? NEW : "rgba(255,255,255,0.08)" }}
                  >
                    <Face pid={pid} players={players} size={38} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {pname(players, pid)}
                        <span className="ml-1.5 font-normal text-[var(--muted)]">
                          {players[pid]?.[1]?.[0] ?? ""}
                        </span>
                      </p>
                      <p
                        className="truncate text-xs"
                        style={{ color: fresh ? NEW : "var(--muted)" }}
                      >
                        {a.how === "draft"
                          ? a.no
                            ? `Drafted #${a.no}`
                            : "Draft day"
                          : a.how === "trade"
                            ? `Trade with ${nick(a.from)}, week ${a.week}`
                            : `Waivers, week ${a.week}`}
                      </p>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
          {gone.length ? (
            <div className="mt-4 rounded-2xl border border-white/8 p-3 text-sm">
              <p className="text-[var(--muted)]">Gone this week</p>
              <ul className="mt-1 space-y-0.5">
                {gone.map((g) => (
                  <li key={g.pid}>
                    <span className="line-through decoration-[var(--ticket)] decoration-2">
                      {pname(players, g.pid)}
                    </span>{" "}
                    <span className="text-[var(--muted)]">
                      {g.to ? `traded to ${nick(g.to)}` : "dropped"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <aside className="space-y-8">
          <section>
            <h3 className="font-display text-2xl font-black">
              Trades this week
            </h3>
            {weekTrades.length ? (
              <ul className="mt-3 space-y-2">
                {weekTrades.map((t, k) => (
                  <li key={k} className="rounded-2xl bg-black/25 p-3 text-sm">
                    {Object.entries(t.sides).map(([m, got]) => (
                      <p key={m} className="mt-0.5 first:mt-0">
                        <button
                          type="button"
                          onClick={() => setWho(m)}
                          className="cursor-pointer font-semibold underline-offset-2 hover:underline"
                        >
                          {nick(m)}
                        </button>{" "}
                        got{" "}
                        <span className="text-[var(--paper)]/80">
                          {got.map((p) => pname(players, p)).join(", ") || "nothing"}
                        </span>
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">
                {week === 0
                  ? "Rosters are fresh off the draft. Scrub forward to watch them change."
                  : "Quiet week. Nobody traded."}
              </p>
            )}
          </section>
          <section>
            <h3 className="font-display text-2xl font-black">
              Draft picks still on the roster
            </h3>
            <ul className="mt-3 space-y-1.5">
              {owners
                .map((m) => ({ m, ...kept(m) }))
                .sort((a, b) => b.n - a.n)
                .map(({ m, n, of }) => (
                  <li key={m}>
                    <button
                      type="button"
                      onClick={() => setWho(m)}
                      className={`grid w-full cursor-pointer grid-cols-[1.5rem_6.5rem_1fr_2rem] items-center gap-2 rounded-lg px-1 py-0.5 text-left text-sm ${m === active ? "bg-white/8" : "hover:bg-white/5"}`}
                    >
                      <MgrPhoto
                        id={m}
                        alt=""
                        width={22}
                        height={22}
                        className="size-[22px] rounded-full"
                      />
                      <span className="truncate">{nick(m)}</span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-white/8">
                        <span
                          className="block h-full rounded-full bg-[var(--paper)] transition-[width] duration-300"
                          style={{ width: `${(n / of) * 100}%` }}
                        />
                      </span>
                      <span className="text-right tabular-nums">{n}</span>
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        </aside>
      </div>

      <Explain>
        <p>
          Every stop on the slider is a team&apos;s roster at the end of that
          week, straight from Sleeper&apos;s weekly lineups, starting from draft
          day. Green cards arrived that week. Each player shows how he got
          there: drafted, traded for, or picked up off waivers.
        </p>
        <p>Regular-season weeks only. Season 4 runs up to the last finished week.</p>
      </Explain>
    </div>
  );
}
