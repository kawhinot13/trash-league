import { Analytics } from "@vercel/analytics/next";
import type { Viewport } from "next";
import { Archivo, Big_Shoulders } from "next/font/google";
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

export const viewport: Viewport = {
  themeColor: "#0b2419",
};

/** Shared shell only: fonts and global CSS. The Trash site's chrome lives in (trash)/layout.tsx,
 * the multi-league app's in l/layout.tsx, so neither leaks into the other. */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} antialiased`}>
      <body className="min-h-full bg-transparent text-[var(--paper)]">
        {children}
        {/* Vercel Web Analytics: page views without cookies; inert until enabled in the Vercel dashboard. */}
        <Analytics />
      </body>
    </html>
  );
}
