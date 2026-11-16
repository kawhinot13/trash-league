import type { Metadata } from "next";
import { AppNav } from "@/components/app/chrome";
import { Intro } from "@/components/app/site";
import { YahooHub } from "@/components/app/yahoo-client";

export const metadata: Metadata = { title: "Yahoo leagues", robots: { index: false } };

export default function YahooPage() {
  return (
    <>
      <AppNav />
      <main className="overflow-x-clip">
        <Intro title="Yahoo leagues">
          Bring in your Yahoo fantasy football league. It stays private: only managers in the league can see it, after signing in and
          connecting their own Yahoo account.
        </Intro>
        <div className="mx-auto max-w-6xl px-5 pb-24 md:px-10">
          <YahooHub />
          <p className="mt-10 max-w-[60ch] text-sm text-[var(--muted)]">
            Rafterlore reads your leagues with Yahoo&apos;s official API, only when you ask. It keeps an encrypted Yahoo access key so the
            league can update during the season; disconnect any time to delete it. League data from Yahoo Fantasy. Rafterlore isn&apos;t
            affiliated with or endorsed by Yahoo.
          </p>
        </div>
      </main>
    </>
  );
}
