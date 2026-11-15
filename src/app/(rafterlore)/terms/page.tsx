import type { Metadata } from "next";
import { Contact, LegalPage } from "@/components/app/legal";

export const metadata: Metadata = { title: "Terms" };

export default function Terms() {
  return (
    <LegalPage title="Terms" updated="November 15, 2026">
      <section>
        <h2>What Rafterlore is</h2>
        <p>
          Rafterlore is a free, non-commercial fan project that shows the history of fantasy basketball and football leagues hosted on
          Sleeper. There are no payments, ads or paid features.
        </p>
      </section>
      <section>
        <h2>Not Sleeper</h2>
        <p>
          Rafterlore works with Sleeper leagues but is not affiliated with, endorsed by or sponsored by Sleeper. Sleeper is
          a trademark of its owner. League data comes from Sleeper&apos;s public API.
        </p>
      </section>
      <section>
        <h2>Accuracy</h2>
        <p>
          We try to get every number right, but Rafterlore is provided as is, without guarantees. Official records and
          points-for totals come straight from Sleeper. Weekly matchup scores, head-to-head records, trade grades and
          lineup numbers are built from Sleeper&apos;s weekly data, which doesn&apos;t always match the official totals; those
          are marked &ldquo;per Sleeper&rdquo;. Don&apos;t settle bets with them.
        </p>
      </section>
      <section>
        <h2>Fair use</h2>
        <ul>
          <li>Don&apos;t try to overload the site or Sleeper, or get around the limits on importing leagues.</li>
          <li>Don&apos;t scrape Rafterlore in bulk.</li>
          <li>Only remove a league you manage.</li>
        </ul>
        <p>We may limit or block access that breaks these rules.</p>
      </section>
      <section>
        <h2>Your league</h2>
        <p>
          Any manager can remove their league from Rafterlore: <Contact />. We may also remove a league or change or stop
          the service at any time.
        </p>
      </section>
      <section>
        <h2>Changes</h2>
        <p>If these terms change, we&apos;ll update this page and the date at the top.</p>
      </section>
    </LegalPage>
  );
}
