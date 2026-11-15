import type { Metadata, Viewport } from "next";
import { AppFooter } from "@/components/app/chrome";
import { PRODUCT, TAGLINE } from "@/lib/app/brand";

export const metadata: Metadata = {
  title: { default: `${PRODUCT}: fantasy basketball league history`, template: `%s · ${PRODUCT}` },
  description: TAGLINE,
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
