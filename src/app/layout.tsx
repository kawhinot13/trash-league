import type { Metadata, Viewport } from "next";
import { Archivo, Big_Shoulders } from "next/font/google";
import { SmoothScroll } from "@/components/smooth-scroll";
import { GlassNav } from "@/components/trash/polish";
import { RicoPeek } from "@/components/trash/rico-peek";
import { Footer } from "@/components/trash/sections";
import { league } from "@/lib/league";
import "./globals.css";

const display = Big_Shoulders({
  variable: "--font-trash-display",
  subsets: ["latin"],
  weight: ["500", "700", "900"],
  display: "swap",
  adjustFontFallback: false,
});

const body = Archivo({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Trash — a fantasy basketball league",
  description:
    "Four seasons, three champions, ninety-three trades. The official home of the Trash fantasy basketball league.",
};

export const viewport: Viewport = {
  themeColor: "#0f2a20",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const rico = league.managers.find((m) => m.id === "RI3O");
  return (
    <html lang="en" className={`${display.variable} ${body.variable} antialiased`}>
      <body className="min-h-full bg-transparent text-[var(--paper)]">
        <SmoothScroll>
          <GlassNav />
          {children}
          <Footer />
          <RicoPeek trades={rico?.trades ?? 0} record={rico ? `${rico.w}–${rico.l}` : ""} />
        </SmoothScroll>
      </body>
    </html>
  );
}
