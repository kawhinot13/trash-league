import Link from "next/link";
import { AppNav } from "@/components/app/chrome";

export default function NotFound() {
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-6xl px-5 pt-36 pb-24 md:px-10">
        <h1 className="font-display text-6xl font-black md:text-8xl">No league here</h1>
        <p className="mt-4 max-w-[52ch] text-lg text-[var(--muted)]">
          That isn&apos;t a Sleeper basketball or football league, or that manager isn&apos;t in it. Look your league up by username instead.
        </p>
        <Link href="/l" className="mt-8 inline-block rounded-full bg-[var(--paper)] px-6 py-3 font-semibold text-[var(--bin)]">
          Find your league
        </Link>
      </main>
    </>
  );
}
