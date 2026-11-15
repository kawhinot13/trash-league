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
  title: "Trash — a fantasy basketball league",
  description:
    "Four seasons, three champions, ninety-three trades. The official home of the Trash fantasy basketball league.",
};

export default function TrashLayout({ children }: { children: React.ReactNode }) {
  const rico = league.managers.find((m) => m.id === "RI3O");
  return (
    <SmoothScroll>
      {HOLIDAY ? <Snowfall /> : null}
      <GlassNav />
      {children}
      <Footer />
      <PigRide />
      <RicoPeek trades={rico?.trades ?? 0} record={rico ? `${rico.w}–${rico.l}` : ""} />
    </SmoothScroll>
  );
}
