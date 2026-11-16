"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { RLoader } from "@/components/app/mark";
import { USE_ACK_KEY, USE_ACK_TEXT, USE_ACK_VERSION } from "@/lib/app/use-ack";

const post = (body: object) =>
  fetch("/api/yahoo/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => ({
    ok: r.ok,
    j: ((await r.json().catch(() => ({}))) ?? {}) as { error?: string; id?: string; done?: number; total?: number; ready?: boolean },
  }));

/** Runs a league's import one season at a time, then reloads into the league. */
export function YahooImport({ id, name, failed }: { id: string; name: string; failed?: boolean }) {
  const router = useRouter();
  const [p, setP] = useState<{ done: number; total: number } | null>(null);
  const [err, setErr] = useState<string | null>(failed ? "The last import didn't finish." : null);
  const running = useRef(false);
  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setErr(null);
    for (let i = 0; i < 40; i++) {
      const { ok, j } = await post({ step: id });
      if (!ok) {
        setErr(j.error ?? "Yahoo didn't answer. Try again in a moment.");
        break;
      }
      setP({ done: j.done ?? 0, total: j.total ?? 1 });
      if (j.ready) {
        router.refresh();
        break;
      }
    }
    running.current = false;
  }, [id, router]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!failed) void run();
  }, [failed, run]);
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-xl flex-col items-center justify-center px-5 pt-28 text-center" aria-busy={!err}>
      {err ? (
        <>
          <h1 className="font-display text-4xl font-black md:text-5xl">Couldn&apos;t finish loading {name}</h1>
          <p className="mt-3 text-[var(--muted)]">{err}</p>
          <button type="button" onClick={() => void run()} className="mt-6 h-12 rounded-full bg-[var(--paper)] px-7 font-semibold text-[var(--bin)]">
            Try again
          </button>
        </>
      ) : (
        <>
          <RLoader label="Importing from Yahoo" className="size-24" />
          <h1 className="font-display mt-8 text-4xl font-black md:text-5xl">Bringing in {name}</h1>
          <p className="mt-3 text-[var(--muted)]">
            {p ? `Season ${Math.min(p.done + 1, p.total)} of ${p.total}.` : "Finding every season."} Each season takes a few seconds; keep this page
            open.
          </p>
        </>
      )}
    </main>
  );
}

/** In season: once in a while, fetch the newest week from Yahoo and regrade (nobody waits). */
export function YahooRefresh({ id, updatedAt }: { id: string; updatedAt: string }) {
  const router = useRouter();
  useEffect(() => {
    // At most every 6 hours, and only while the season is going.
    if (Date.now() - Date.parse(updatedAt) < 6 * 3600_000) return;
    void post({ refresh: id }).then(({ ok }) => ok && router.refresh());
  }, [id, updatedAt, router]);
  return null;
}

type Leagues = {
  configured: boolean;
  signedIn?: boolean;
  connected?: boolean;
  expired?: boolean;
  error?: string;
  leagues?: { key: string; name: string; season: string; teams: number; supported: boolean; status: string | null }[];
};

/** /l/yahoo: connect Yahoo, pick a league, import it. */
export function YahooHub() {
  const router = useRouter();
  const [s, setS] = useState<Leagues | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [acked, setAcked] = useState(false);
  const load = useCallback(() => {
    void fetch("/api/yahoo/leagues", { cache: "no-store" })
      .then((r) => r.json())
      .then(setS)
      .catch(() => setS({ configured: true, error: "Couldn't reach Rafterlore. Try again." }));
  }, []);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (new URLSearchParams(window.location.search).get("connect") === "failed") setErr("Connecting Yahoo didn't go through. Try again.");
    try {
      setAcked(localStorage.getItem(USE_ACK_KEY) === USE_ACK_VERSION);
    } catch {}
  }, [load]);
  const open = async (key: string) => {
    setBusy(key);
    setErr(null);
    const { ok, j } = await post({ start: key, ack: USE_ACK_VERSION });
    setBusy(null);
    if (!ok || !j.id) return setErr(j.error ?? "That didn't work. Try again.");
    router.push(`/y/${j.id}`);
  };
  const disconnect = async () => {
    if (!window.confirm("Disconnect Yahoo? Your Yahoo leagues stay on Rafterlore for their other members; you'll stop seeing them until you reconnect.")) return;
    await fetch("/api/yahoo/disconnect", { method: "POST" }).catch(() => {});
    load();
  };

  if (!s) return <div className="min-h-[12rem]" aria-busy />;
  if (!s.configured) return <p className="text-[var(--muted)]">Yahoo leagues aren&apos;t switched on yet.</p>;
  const btn = "inline-flex h-12 items-center rounded-full bg-[var(--paper)] px-7 font-semibold text-[var(--bin)] transition-transform duration-150 active:scale-[0.97]";
  return (
    <div className="max-w-2xl">
      {err ? (
        <p role="alert" className="mb-4 text-[var(--paper)]">
          {err}
        </p>
      ) : null}
      {!s.signedIn ? (
        <a href={`/api/auth/google?next=${encodeURIComponent("/l/yahoo")}`} className={btn}>
          Sign in with Google first
        </a>
      ) : !s.connected ? (
        <>
          {s.expired ? <p className="mb-4 text-[var(--muted)]">Your Yahoo connection expired. Connect again.</p> : null}
          <a href="/api/yahoo/connect" className={btn}>
            Connect Yahoo
          </a>
        </>
      ) : s.error ? (
        <p className="text-[var(--muted)]">{s.error}</p>
      ) : (
        <>
          <h2 className="font-display text-3xl font-black">Your Yahoo football leagues</h2>
          {!acked ? (
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--bin-2)] p-4">
              <input
                type="checkbox"
                className="mt-0.5 size-5 shrink-0 accent-[var(--paper)]"
                onChange={(e) => {
                  if (!e.target.checked) return;
                  try {
                    localStorage.setItem(USE_ACK_KEY, USE_ACK_VERSION);
                  } catch {}
                  setAcked(true);
                }}
              />
              <span className="break-words">{USE_ACK_TEXT}</span>
            </label>
          ) : null}
          {s.leagues?.length ? (
            <ul className="mt-4 divide-y divide-[var(--line)] border-y border-[var(--line)]">
              {s.leagues.map((l) => (
                <li key={l.key} className="flex flex-wrap items-center gap-3 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-semibold">{l.name}</p>
                    <p className="text-sm text-[var(--muted)]">
                      {l.season}, {l.teams} teams{l.supported ? "" : ". Only head-to-head points leagues work for now"}
                    </p>
                  </div>
                  {l.supported ? (
                    l.status === "ready" ? (
                      <span className="flex items-center gap-3">
                        <Link href={`/y/${l.key}`} className="rounded-full border border-[var(--line)] px-4 py-1.5 text-sm font-semibold">
                          Open
                        </Link>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm(`Remove ${l.name} from Rafterlore? Its stored data is deleted for every member. Any manager can bring it back later.`)) return;
                            const { ok, j } = await post({ remove: l.key });
                            if (!ok) setErr(j.error ?? "That didn't work.");
                            load();
                          }}
                          className="text-xs font-semibold text-[var(--muted)] underline-offset-4 hover:underline"
                        >
                          Remove
                        </button>
                      </span>
                    ) : (
                      <button type="button" disabled={!!busy || !acked} onClick={() => void open(l.key)} className="rounded-full bg-[var(--paper)] px-4 py-1.5 text-sm font-semibold text-[var(--bin)] disabled:opacity-60">
                        {busy === l.key ? "Starting…" : l.status ? "Finish import" : "Bring it in"}
                      </button>
                    )
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[var(--muted)]">No Yahoo football leagues on this account.</p>
          )}
          <button type="button" onClick={() => void disconnect()} className="mt-6 text-sm font-semibold text-[var(--muted)] underline-offset-4 hover:underline">
            Disconnect Yahoo
          </button>
        </>
      )}
    </div>
  );
}
