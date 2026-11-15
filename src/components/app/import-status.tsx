"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Progress } from "@/lib/app/jobs";

/**
 * The heavy import (box-score lineup replay, trade grades) runs in the background. This starts it
 * on a league's first visit, shows progress, and refreshes the page when the results land.
 * Polling also keeps the worker going if nothing else has picked the job up.
 */
export function ImportStatus({ leagueId, initial, hasResults }: { leagueId: string; initial: Progress | null; hasResults: boolean }) {
  const router = useRouter();
  const [p, setP] = useState<Progress | null>(initial);
  const [err, setErr] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const r = await fetch(`/api/l/${leagueId}/status`, { cache: "no-store" });
        const j = (await r.json()) as { progress: Progress | null };
        if (stop) return;
        setP(j.progress);
        if (j.progress?.status === "done") {
          router.refresh();
          return;
        }
        if (j.progress?.status === "failed") return;
      } catch {}
      timer = setTimeout(poll, 4000);
    };
    const begin = async () => {
      if (!initial && !hasResults && !started.current) {
        started.current = true;
        try {
          const r = await fetch(`/api/l/${leagueId}/import`, { method: "POST" });
          const j = (await r.json()) as { progress: Progress | null; error?: string };
          if (j.error) setErr(j.error);
          setP(j.progress);
        } catch {
          setErr("Couldn't start the import. Reload the page to try again.");
        }
      }
      timer = setTimeout(poll, 1500);
    };
    if (!initial || initial.status === "queued" || initial.status === "running" || !hasResults) void begin();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [leagueId, initial, hasResults, router]);

  if (err) return <p className="text-sm text-[var(--muted)]">{err}</p>;
  if (!p || (p.status === "done" && hasResults)) return null;
  if (p.status === "failed")
    return (
      <p className="text-sm text-[var(--muted)]">
        The import stopped: {p.error ?? "Sleeper didn't answer"}. It retries tonight, or reload to try now.
      </p>
    );
  const label =
    p.phase === "grade"
      ? "Grading every trade"
      : p.total
        ? `Replaying box scores: ${p.done} of ${p.total} weeks`
        : "Finding every week of every season";
  return (
    <div role="status" aria-live="polite" className="max-w-md">
      <p className="text-sm font-semibold">{label}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bin-3)]">
        <div
          className="h-full origin-left rounded-full bg-[var(--wood)] transition-transform duration-700 ease-out"
          style={{ transform: `scaleX(${Math.max(0.03, p.pct)})` }}
        />
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">Takes a minute or two. You can leave; it keeps going.</p>
    </div>
  );
}
