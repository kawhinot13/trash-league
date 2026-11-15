import Link from "next/link";
import { AppNav } from "@/components/app/chrome";

/** Rafterlore's 404 body: its own nav, no holiday decor, no music. */
export function RafterloreNotFound() {
  return (
    <>
      <meta name="robots" content="noindex" />
      <AppNav />
      <main className="mx-auto min-h-[60dvh] max-w-6xl px-5 pt-36 pb-24 md:px-10 md:pt-44">
        <p className="text-sm font-semibold tracking-[0.2em] text-[var(--wood)] uppercase">404</p>
        <h1 className="font-display mt-3 text-6xl leading-[0.85] font-black md:text-8xl">Nothing hanging here</h1>
        <p className="mt-5 max-w-[52ch] text-lg text-[var(--muted)]">That page doesn&apos;t exist. Find your league instead.</p>
        <Link href="/l" className="mt-8 inline-block rounded-full bg-[var(--paper)] px-6 py-3 font-semibold text-[var(--bin)]">
          Find a league
        </Link>
      </main>
    </>
  );
}
