"use client";

import Link from "next/link";
import { useState } from "react";

type Started = { challengeId: string; code: string; league: string; season: string; expiresAt: string; intent: "remove" | "restore" };

/**
 * Remove or restore a league in two steps: name yourself, then prove it by putting a one-time code
 * in your own team name on Sleeper (a username alone is public and proves nothing).
 */
export function RemoveForm({ leagueId }: { leagueId: string }) {
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState<Started | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const call = async (body: object) => {
    const r = await fetch(`/api/l/${leagueId}/remove`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { ok: r.ok, j: (await r.json()) as Record<string, unknown> };
  };

  const start = async (intent: "remove" | "restore") => {
    setBusy(true);
    setMsg(null);
    try {
      const { ok, j } = await call({ step: "start", username, intent });
      if (!ok) setMsg({ ok: false, text: String(j.error ?? "Something went wrong.") });
      else setStarted({ ...(j as unknown as Omit<Started, "intent">), intent });
    } catch {
      setMsg({ ok: false, text: "Couldn't reach Rafterlore. Try again." });
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!started) return;
    setBusy(true);
    setMsg(null);
    try {
      const { ok, j } = await call({ step: "verify", challengeId: started.challengeId });
      if (!ok) {
        setMsg({ ok: false, text: String(j.error ?? "Something went wrong.") });
        if (!j.retry) setStarted(null);
      } else if (j.restored) {
        setStarted(null);
        setMsg({ ok: true, text: "Restored. The league is back on Rafterlore. You can change your team name back now." });
      } else {
        setStarted(null);
        const day = new Date(String(j.purgeAfter)).toLocaleDateString("en-US", { month: "long", day: "numeric" });
        setMsg({ ok: true, text: `Removed. Its data is deleted for good on ${day}. You can change your team name back now.` });
      }
    } catch {
      setMsg({ ok: false, text: "Couldn't reach Rafterlore. Try again." });
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(started!.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const button =
    "h-[52px] rounded-full px-7 font-semibold transition-transform duration-150 active:scale-[0.97] disabled:opacity-60";

  return (
    <div className="max-w-xl">
      {!started ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void start("remove");
          }}
        >
          <label htmlFor="who" className="font-semibold">
            Your Sleeper username
          </label>
          <p className="mt-1 text-sm text-[var(--muted)]">You need a team in the league&apos;s latest season.</p>
          <input
            id="who"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            className="mt-3 h-[52px] w-full rounded-full border border-[var(--line)] bg-[var(--bin-2)] px-5 text-base focus:border-[var(--wood)] focus:outline-none"
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className={`${button} bg-[var(--paper)] text-[var(--bin)]`}>
              {busy ? "Working…" : "Remove this league"}
            </button>
            <button
              type="button"
              disabled={busy || !username}
              onClick={() => void start("restore")}
              className={`${button} border border-[var(--line)] hover:border-[var(--muted)]`}
            >
              Restore it
            </button>
          </div>
        </form>
      ) : (
        <div>
          <p className="font-semibold">Prove it&apos;s your team</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-[var(--paper)]/85">
            <li>
              In the Sleeper app, open <span className="font-semibold">{started.league}</span> ({started.season}) and change
              your team name to include this code:
            </li>
          </ol>
          <div className="mt-4 flex items-center gap-3">
            <code className="font-display rounded-xl border border-[var(--wood)] bg-[var(--bin-2)] px-5 py-3 text-3xl font-black tracking-wider">
              {started.code}
            </code>
            <button
              type="button"
              onClick={() => void copy()}
              className="h-11 rounded-full border border-[var(--line)] px-4 text-sm font-semibold hover:border-[var(--muted)]"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <ol start={2} className="mt-4 list-decimal space-y-2 pl-5 text-[var(--paper)]/85">
            <li>Save it, then come back here and check. You can change your team name back right after.</li>
          </ol>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Only you (or your commissioner) can change your team name, so this proves the request is really yours. The
            code works for 30 minutes.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" disabled={busy} onClick={() => void verify()} className={`${button} bg-[var(--paper)] text-[var(--bin)]`}>
              {busy ? "Checking Sleeper…" : started.intent === "restore" ? "Check and restore" : "Check and remove"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setStarted(null);
                setMsg(null);
              }}
              className={`${button} border border-[var(--line)] hover:border-[var(--muted)]`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {msg ? (
        <p role="status" className={`mt-6 ${msg.ok ? "text-[var(--paper)]" : "text-[var(--muted)]"}`}>
          {msg.text}
        </p>
      ) : null}
      <p className="mt-10 text-sm text-[var(--muted)]">
        <Link href={`/l/${leagueId}`} className="underline underline-offset-4">
          Back to the league
        </Link>
      </p>
    </div>
  );
}
