import type { Metadata, Viewport } from "next";
import { AppFooter } from "@/components/app/chrome";
import { PRODUCT, TAGLINE } from "@/lib/app/brand";

export const metadata: Metadata = {
  title: { default: `${PRODUCT}: fantasy league history`, template: `%s · ${PRODUCT}` },
  description: TAGLINE,
  // The ribbon R: green on light browser tabs, white on dark ones (SVG), a PNG fallback, and the
  // green tile for home screens.
  icons: {
    icon: [
      { url: "/brand/rafterlore-icon.svg", type: "image/svg+xml" },
      { url: "/brand/rafterlore-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: { url: "/brand/rafterlore-apple.png", sizes: "180x180" },
  },
  manifest: "/brand/rafterlore.webmanifest",
};
export const viewport: Viewport = { themeColor: "#0b2419" };

/** Rafterlore' shell (/l, /privacy, /terms). None of the Trash site's chrome (nav, Rico, the pig, music) is here. */
export default function RafterloreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rafterlore flex flex-col overflow-x-clip">
      <div className="flex-1">{children}</div>
      <AppFooter />
    </div>
  );
}
