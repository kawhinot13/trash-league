"use client";

import { useEffect } from "react";
import { rememberLocal } from "@/components/app/account";

/** Asks the server to refresh this league in the background, at most every few minutes per browser. */
export function Freshen({ leagueId, mine }: { leagueId: string; mine: { id: string; name: string } }) {
  useEffect(() => {
    // Opening a league keeps it in "Your leagues" (this browser; the refresh ping records it on the account).
    rememberLocal({ id: mine.id, name: mine.name });
    const key = `rl:fresh:${leagueId}`;
    try {
      const last = Number(sessionStorage.getItem(key) ?? 0);
      if (Date.now() - last < 5 * 60_000) return;
      sessionStorage.setItem(key, String(Date.now()));
    } catch {}
    void fetch(`/api/l/${leagueId}/refresh`, { method: "POST", keepalive: true }).catch(() => {});
  }, [leagueId, mine.id, mine.name]);
  return null;
}
