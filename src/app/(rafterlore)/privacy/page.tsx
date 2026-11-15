import type { Metadata } from "next";
import { Contact, LegalPage } from "@/components/app/legal";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy" updated="November 15, 2026">
      <section>
        <h2>The short version</h2>
        <p>
          Rafterlore has no accounts, no ads and no tracking cookies. It shows fantasy basketball league history built from
          data Sleeper already makes public, and it keeps only what it needs to do that.
        </p>
      </section>
      <section>
        <h2>What we store</h2>
        <ul>
          <li>
            Public league data from Sleeper for leagues someone opens on Rafterlore: league settings, team names, managers&apos;
            Sleeper display names and avatars, rosters, records, drafts, playoff brackets, trades and weekly lineups.
          </li>
          <li>Each league&apos;s official points-for totals, saved once a night during the season.</li>
          <li>Results we calculate from that data, like trade grades and lineup efficiency.</li>
        </ul>
        <p>
          We don&apos;t store anything Sleeper doesn&apos;t show publicly. No emails, phone numbers, passwords, chats or
          payment details. We never ask you to sign in.
        </p>
      </section>
      <section>
        <h2>Your network address</h2>
        <p>
          To stop anyone importing thousands of leagues, we count how often each network imports new leagues or looks up
          usernames. We keep only a scrambled (hashed) version of the address, never the address itself, and delete it
          after two days.
        </p>
      </section>
      <section>
        <h2>Cookies and tracking</h2>
        <p>
          Rafterlore doesn&apos;t use tracking cookies or third-party analytics. Our host may keep standard server logs
          (like any website) to keep the service running.
        </p>
      </section>
      <section>
        <h2>Removing a league</h2>
        <p>
          Any manager in a league can remove it from Rafterlore: <Contact />. Its pages disappear right away, nothing more
          is saved, and the stored data is deleted for good after seven days. The league won&apos;t be imported again.
        </p>
      </section>
      <section>
        <h2>Sleeper</h2>
        <p>
          Rafterlore works with Sleeper leagues. It is not affiliated with or endorsed by Sleeper. Sleeper&apos;s own privacy
          policy covers your Sleeper account.
        </p>
      </section>
    </LegalPage>
  );
}
