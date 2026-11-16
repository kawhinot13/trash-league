import type { Metadata } from "next";
import { Suspense } from "react";
import { Waivers } from "@/components/trash/live-blocks";
import { PageIntro } from "@/components/trash/page-intro";

export const metadata: Metadata = { title: "Waivers — Trash" };

export default function WaiversPage() {
  return (
    <main className="overflow-x-clip">
      <PageIntro title="Waivers">
        Everyone on the wire, ranked for this league&apos;s scoring. Recent form, minutes, games left this week and what the
        rest of Sleeper is grabbing. Refreshed every few minutes.
      </PageIntro>
      <section aria-label="Waiver intel" className="pt-10 pb-14 md:pb-32">
        <Suspense fallback={<p className="mx-auto max-w-6xl px-5 text-[var(--muted)] md:px-10">Loading the wire…</p>}>
          <Waivers />
        </Suspense>
      </section>
    </main>
  );
}
