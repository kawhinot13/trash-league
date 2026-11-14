import { ImageResponse } from "next/og";

/** Shared link-preview card: dumpster green, a hardwood stripe, one big line. */
export const ogSize = { width: 1200, height: 630 };

export function ogCard(title: string, line: string) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0f2a20", color: "#f6f3ea", padding: "64px 72px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 22, height: 22, borderRadius: 999, background: "#c98a4b" }} />
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>TRASH</div>
          <div style={{ fontSize: 26, color: "#a4b8ab" }}>fantasy basketball since 2023</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 132, fontWeight: 900, lineHeight: 0.9, letterSpacing: -4 }}>{title}</div>
          <div style={{ fontSize: 36, color: "#a4b8ab", marginTop: 26, maxWidth: 980 }}>{line}</div>
        </div>
        <div style={{ display: "flex", height: 18, background: "#c98a4b", borderRadius: 6 }} />
      </div>
    ),
    ogSize,
  );
}
