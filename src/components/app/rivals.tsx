"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/app/avatar";
import type { Game } from "@/lib/app/analysis";

type M = { id: string; name: string; avatar: string | null };
const fmt = (x: number) => x.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Pick any two managers and see every meeting, per Sleeper's weekly matchup scores. */
export function Rivals({ leagueId, managers, games, a0, b0 }: { leagueId: string; managers: M[]; games: Game[]; a0: string; b0: string }) {
  const router = useRouter();
  const [a, setA] = useState(a0);
  const [b, setB] = useState(b0);
  const byId = new Map(managers.map((m) => [m.id, m]));

  const set = (na: string, nb: string) => {
    setA(na);
    setB(nb);
    router.replace(`/l/${leagueId}/rivals?a=${na}&b=${nb}`, { scroll: false });
  };

  const meetings = useMemo(
    () =>
      games
        .filter((g) => (g.a === a && g.b === b) || (g.a === b && g.b === a))
        .map((g) => ({ ...g, me: g.a === a ? g.pa : g.pb, them: g.a === a ? g.pb : g.pa }))
        .sort((x, y) => y.season.localeCompare(x.season) || y.week - x.week),
    [games, a, b],
  );
  const w = meetings.filter((m) => m.me > m.them).length;
  const l = meetings.filter((m) => m.me < m.them).length;
  const t = meetings.length - w - l;
  const pf = meetings.reduce((s, m) => s + m.me, 0);
  const pa = meetings.reduce((s, m) => s + m.them, 0);
  const po = meetings.filter((m) => m.playoff);
  const bigA = [...meetings].sort((x, y) => y.me - y.them - (x.me - x.them))[0];
  const bigB = [...meetings].sort((x, y) => y.them - y.me - (x.them - x.me))[0];
  const A = byId.get(a);
  const B = byId.get(b);

  const pickers = (
    <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
      <Picker label="Manager" value={a} onChange={(v) => set(v, v === b ? a : b)} managers={managers} />
      <button
        type="button"
        onClick={() => set(b, a)}
        aria-label="Swap managers"
        className="mb-1 flex size-11 items-center justify-center rounded-full border border-[var(--line)] text-lg transition-transform duration-150 hover:border-[var(--muted)] active:scale-[0.95]"
      >
        ⇄
      </button>
      <Picker label="Opponent" value={b} onChange={(v) => set(v === a ? b : a, v)} managers={managers} />
    </div>
  );

  return (
    <div>
      {pickers}
      {A && B ? (
        <div className="mt-10">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <Side m={A} big={w} />
            <p className="font-display text-2xl font-black text-[var(--muted)]">{t ? `${t} tied` : "vs"}</p>
            <Side m={B} big={l} right />
          </div>
          {meetings.length ? (
            <>
              <p className="mt-6 text-center text-[var(--muted)]">
                {meetings.length} meeting{meetings.length === 1 ? "" : "s"}
                {po.length ? `, ${po.length} in the playoffs` : ""}. Points {fmt(pf)} to {fmt(pa)}.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {bigA && bigA.me > bigA.them ? <Big title={`${A.name}'s biggest win`} g={bigA} me={bigA.me} them={bigA.them} /> : null}
                {bigB && bigB.them > bigB.me ? <Big title={`${B.name}'s biggest win`} g={bigB} me={bigB.them} them={bigB.me} /> : null}
              </div>
              <ol className="mt-8 divide-y divide-[var(--line)] border-y border-[var(--line)]">
                {meetings.map((m) => (
                  <li key={`${m.season}-${m.week}`} className="flex items-center justify-between gap-3 py-3 text-sm tabular-nums">
                    <span className="text-[var(--muted)]">
                      {m.years}, week {m.week}
                      {m.playoff ? <span className="ml-2 font-semibold text-[var(--wood)]">Playoffs</span> : null}
                    </span>
                    <span>
                      <span className={m.me > m.them ? "font-semibold" : "text-[var(--muted)]"}>{fmt(m.me)}</span>
                      <span className="text-[var(--muted)]"> – </span>
                      <span className={m.them > m.me ? "font-semibold" : "text-[var(--muted)]"}>{fmt(m.them)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="mt-8 text-center text-[var(--muted)]">These two have never played each other.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Picker({ label, value, onChange, managers }: { label: string; value: string; onChange: (v: string) => void; managers: M[] }) {
  return (
    <label className="block min-w-0">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-12 w-full truncate rounded-full border border-[var(--line)] bg-[var(--bin-2)] px-4 font-semibold focus:border-[var(--wood)] focus:outline-none"
      >
        {managers.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function Side({ m, big, right }: { m: M; big: number; right?: boolean }) {
  return (
    <div className={`flex min-w-0 flex-col gap-2 ${right ? "items-end text-right" : ""}`}>
      <Avatar src={m.avatar} name={m.name} size={48} />
      <p className="w-full truncate font-semibold">{m.name}</p>
      <p className="font-display text-7xl leading-none font-black tabular-nums md:text-8xl">{big}</p>
    </div>
  );
}

function Big({ title, g, me, them }: { title: string; g: Game; me: number; them: number }) {
  return (
    <div className="rounded-xl border border-[var(--line)] p-4">
      <p className="text-sm text-[var(--muted)]">{title}</p>
      <p className="mt-1 font-semibold tabular-nums">
        {fmt(me)} to {fmt(them)}, by {fmt(me - them)}
      </p>
      <p className="text-sm text-[var(--muted)]">
        {g.years}, week {g.week}
      </p>
    </div>
  );
}
