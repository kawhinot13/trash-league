import Link from "next/link";
import { Suspense } from "react";
import { GlassNav } from "@/components/trash/polish";
import { Footer } from "@/components/trash/sections";

/** The site-wide 404: the Trash site's nav and footer around a short note. */
export default function NotFound() {
  return (
    <>
      <Suspense fallback={null}>
        <GlassNav />
      </Suspense>
      <main className="mx-auto min-h-[70dvh] max-w-6xl px-5 pt-36 pb-24 md:px-10 md:pt-44">
        <p className="text-sm font-semibold tracking-[0.2em] text-[var(--wood)] uppercase">404</p>
        <h1 className="font-display mt-3 text-6xl leading-[0.85] font-black md:text-8xl">Nothing in this bin</h1>
        <p className="mt-5 max-w-[52ch] text-lg text-[var(--muted)]">
          That page doesn&apos;t exist, or it was traded away. Try the front page, or look up any Sleeper league.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="rounded-full bg-[var(--paper)] px-6 py-3 font-semibold text-[var(--bin)]">
            Back to Trash
          </Link>
          <Link href="/l" className="rounded-full border border-[var(--line)] px-6 py-3 font-semibold text-[var(--paper)] hover:bg-white/5">
            Find a league
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
