import { ImageResponse } from "next/og";
import { cacheLife } from "next/cache";
import { PRODUCT } from "@/lib/app/brand";
import { hasDb } from "@/lib/app/db";
import { datasetOf, familyIdOf } from "@/lib/app/store";
import { sleeper, type SLeague } from "@/lib/app/sleeper";
import { isSleeperId } from "@/lib/app/validate";
import type { Dataset } from "@/lib/core/types";

/**
 * Rafterlore's link-preview cards: arena navy, a row of hanging banners (gold for each title
 * won), one big line. Data is read-only: a preview never imports a league or touches rate limits.
 */
export const ogSize = { width: 1200, height: 630 };

export function ogCard(title: string, line: string, banners: { label: string; gold: boolean }[] = []) {
  const big = title.length > 22 ? 84 : title.length > 14 ? 104 : 128;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "linear-gradient(180deg,#1d2b48 0%,#111a2c 55%)", color: "#f3efe6", padding: "0 72px 56px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", height: 170, gap: 18, alignItems: "flex-start", borderTop: "4px solid #3a4a6b" }}>
          {banners.slice(-8).map((b, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 96 }}>
              <div style={{ width: 3, height: 14, background: "#3a4a6b" }} />
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", width: 96, height: 132, paddingTop: 16, fontSize: 22, fontWeight: 800, color: b.gold ? "#111a2c" : "#98a4b9", background: b.gold ? "#e9c46a" : "#18233a", clipPath: "polygon(0 0,100% 0,100% 100%,50% 86%,0 100%)" }}>
                {b.label}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: big, fontWeight: 900, lineHeight: 0.92, letterSpacing: -3 }}>{title}</div>
          <div style={{ fontSize: 34, color: "#98a4b9", marginTop: 24, maxWidth: 1000 }}>{line}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 18, height: 18, borderRadius: 999, background: "#c98a4b" }} />
          <div style={{ fontSize: 30, fontWeight: 800 }}>{PRODUCT}</div>
          <div style={{ fontSize: 24, color: "#98a4b9" }}>fantasy league history</div>
        </div>
      </div>
    ),
    ogSize,
  );
}

/** What a preview needs: the stored dataset if the league is on Rafterlore, else Sleeper's name. */
export async function ogLeague(leagueId: string): Promise<{ name: string; d: Dataset | null } | null> {
  "use cache: remote";
  cacheLife("hours");
  if (!isSleeperId(leagueId)) return null;
  if (hasDb()) {
    const fid = await familyIdOf(leagueId).catch(() => null);
    const d = fid ? await datasetOf(fid).catch(() => null) : null;
    if (d) return { name: d.name, d };
  }
  const l = await sleeper<SLeague | null>(`/v1/league/${leagueId}`).catch(() => null);
  return l ? { name: l.name, d: null } : null;
}

export const bannersOf = (d: Dataset) => d.league.seasons.map((s) => ({ label: `’${s.years.slice(2, 4)}`, gold: !!s.champion }));
