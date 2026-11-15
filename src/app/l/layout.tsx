import type { Metadata, Viewport } from "next";
import { AppFooter } from "@/components/app/chrome";
import { PRODUCT, TAGLINE } from "@/lib/app/brand";

export const metadata: Metadata = {
  title: { default: `${PRODUCT}: league history for Sleeper NBA`, template: `%s · ${PRODUCT}` },
  description: TAGLINE,
};
export const viewport: Viewport = { themeColor: "#111a2c" };

/** The multi-league app's shell. None of the Trash site's chrome (nav, Rico, the pig, music) is here. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rafters flex flex-col overflow-x-clip">
      <div className="flex-1">{children}</div>
      <AppFooter />
    </div>
  );
}
