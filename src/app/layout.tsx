import type { Metadata, Viewport } from "next";
import { Archivo, Big_Shoulders } from "next/font/google";
import { SmoothScroll } from "@/components/smooth-scroll";
import "lenis/dist/lenis.css";
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
  return (
    <html lang="en" className={`${display.variable} ${body.variable} antialiased`}>
      <body className="min-h-full bg-[var(--bin)] text-[var(--paper)]">
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
