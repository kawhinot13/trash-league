"use client";

import { useEffect } from "react";

/** Asks the server to refresh this league in the background, at most every few minutes per browser. */
export function Freshen({ leagueId }: { leagueId: string }) {
  useEffect(() => {
    const key = `rl:fresh:${leagueId}`;
    try {
      const last = Number(sessionStorage.getItem(key) ?? 0);
      if (Date.now() - last < 5 * 60_000) return;
      sessionStorage.setItem(key, String(Date.now()));
    } catch {}
    void fetch(`/api/l/${leagueId}/refresh`, { method: "POST", keepalive: true }).catch(() => {});
  }, [leagueId]);
  return null;
}
