"use client";

import Link from "next/link";
import { useState } from "react";

/** Remove (or restore) a league. The server checks the username belongs to one of its managers. */
export function RemoveForm({ leagueId }: { leagueId: string }) {
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const send = async (action: "remove" | "restore") => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/l/${leagueId}/remove`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, action }),
      });
      const j = (await r.json()) as { error?: string; purgeAfter?: string; restored?: boolean };
      if (!r.ok || j.error) setMsg({ ok: false, text: j.error ?? "Something went wrong." });
      else if (j.restored) setMsg({ ok: true, text: "Restored. The league is back on Rafterlore." });
      else
        setMsg({
          ok: true,
          text: `Removed. Its data is deleted for good on ${new Date(j.purgeAfter!).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`,
        });
    } catch {
      setMsg({ ok: false, text: "Couldn't reach Rafterlore. Try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void send("remove");
      }}
      className="max-w-xl"
    >
      <label htmlFor="who" className="font-semibold">
        Your Sleeper username
      </label>
      <p className="mt-1 text-sm text-[var(--muted)]">It has to be a manager in this league, in any season.</p>
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
        <button
          type="submit"
          disabled={busy}
          className="h-[52px] rounded-full bg-[var(--paper)] px-7 font-semibold text-[var(--bin)] transition-transform duration-150 active:scale-[0.97] disabled:opacity-60"
        >
          {busy ? "Working…" : "Remove this league"}
        </button>
        <button
          type="button"
          disabled={busy || !username}
          onClick={() => void send("restore")}
          className="h-[52px] rounded-full border border-[var(--line)] px-7 font-semibold transition-colors hover:border-[var(--muted)] disabled:opacity-50"
        >
          Restore it
        </button>
      </div>
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
    </form>
  );
}
