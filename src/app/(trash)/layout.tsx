import type { Metadata } from "next";
import { SmoothScroll } from "@/components/smooth-scroll";
import { GlassNav } from "@/components/trash/polish";
import { RicoPeek } from "@/components/trash/rico-peek";
import { Footer } from "@/components/trash/sections";
import { league } from "@/lib/league";
import { HOLIDAY } from "@/lib/holiday";
import { Snowfall } from "@/components/holiday/snowfall";
import { PigRide } from "@/components/pig/pig-ride";

export const metadata: Metadata = {
  // Owner (2026-11-18): this site is the test copy; the league plays on Rafterlore.
  title: "Test Trash Fantasy",
  description:
    "Four seasons, three champions, ninety-three trades. The official home of the Trash fantasy basketball league.",
  icons: { icon: { url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" } },
};

export default function TrashLayout({ children }: { children: React.ReactNode }) {
  const rico = league.managers.find((m) => m.id === "RI3O");
  return (
    <SmoothScroll>
      {HOLIDAY ? <Snowfall /> : null}
      <GlassNav logo="Test Trash Fantasy" />
      {children}
      <Footer />
      <PigRide />
      <RicoPeek trades={rico?.trades ?? 0} record={rico ? `${rico.w}–${rico.l}` : ""} />
    </SmoothScroll>
  );
}
