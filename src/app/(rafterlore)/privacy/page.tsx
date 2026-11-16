import type { Metadata } from "next";
import { Contact, LegalPage } from "@/components/app/legal";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy" updated="November 15, 2026">
      <section>
        <h2>The short version</h2>
        <p>
          Rafterlore has no ads and no tracking cookies, and you can browse every league without an account (the daily games need one). It shows fantasy basketball and
          football league history. For Sleeper leagues that&apos;s data Sleeper already makes public; Yahoo leagues are private and
          shown only to their own managers (see below). It keeps only what it needs.
          The leagues you open are remembered in your browser. If you choose to sign in with Google, they&apos;re kept on your
          account instead, with your Sleeper username.
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
          <li>
            That the recreational-use confirmation was given when a league was first opened: the date and the wording&apos;s
            version, with no details about who gave it.
          </li>
          <li>Daily-game results posted to a league&apos;s standings (manager, day and score), kept for about a year.</li>
          <li>
            When you search a Sleeper username and open one of its leagues, a scrambled (keyed hash) form of that username, so
            we can count how many different people use Rafterlore. The username itself isn&apos;t kept and can&apos;t be read back.
          </li>
        </ul>
        <p>
          For Sleeper leagues we don&apos;t store anything Sleeper doesn&apos;t show publicly. Nowhere do we store emails, phone
          numbers, passwords, chats or payment details.
        </p>
      </section>
      <section>
        <h2>Signing in (optional)</h2>
        <p>
          You can sign in with Google so Rafterlore remembers you on any device. We keep only Google&apos;s id number for
          your account, your first name, the Sleeper username you look up while signed in and the leagues you opened
          (until you remove them). Google tells us your email address when you sign in; we use it only to check whether
          you&apos;re the site&apos;s administrator, and we never store it. We never see your Google password. A sign-in cookie keeps you signed
          in for up to six months. You can sign out, or delete the account and everything it remembered, any time from
          the account menu.
        </p>
        <p>
          Signing in also puts your daily-game scores on your leagues&apos; standings. You prove which Sleeper manager you are
          once, by putting a one-time code in your own team name (the code and that manager&apos;s public Sleeper user id are
          kept for at most a day). Your account then plays as that manager in every league they&apos;re in, and no other
          account can. Deleting the account removes that link.
        </p>
      </section>
      <section>
        <h2>Yahoo leagues (optional)</h2>
        <p>
          If you connect a Yahoo account, Rafterlore uses Yahoo&apos;s official Fantasy Sports API to read the football leagues you
          play in, only when you ask it to. We keep your Yahoo account&apos;s id number and an encrypted access key, so a league you
          brought in can update during the season. We never see your Yahoo password, and we don&apos;t read anything else on your
          Yahoo account.
        </p>
        <p>
          A Yahoo league you bring in is private: only its own managers can see it, after signing in to Rafterlore and connecting
          their Yahoo account. We store its league data (teams, every manager&apos;s Yahoo nickname and Yahoo account id number, records,
          rosters, lineups, drafts and trades), including for managers who never use Rafterlore, and show it to that league&apos;s
          managers only. Disconnecting Yahoo deletes your access key; deleting your Rafterlore account deletes it
          too. Any manager in the league&apos;s current season can remove it from Rafterlore, which deletes its stored data.
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
          Rafterlore doesn&apos;t use tracking cookies or advertising trackers. The only cookies are the ones that keep you
          signed in, if you sign in. Our host&apos;s privacy-friendly analytics (Vercel Web Analytics) counts page views,
          referrers, countries and device types without cookies and without identifying you. Our host may keep standard server logs
          (like any website) to keep the service running.
        </p>
      </section>
      <section>
        <h2>Removing a league</h2>
        <p>
          Any manager in a league can remove it from Rafterlore: <Contact />. To prove the request is theirs, they put a
          one-time code in their own Sleeper team name, which only they or their commissioner can change; Rafterlore
          keeps the code and their public Sleeper user id for at most a day. The league&apos;s pages disappear right
          away, nothing more is saved, and the stored data is deleted for good after seven days. The league won&apos;t be
          imported again.
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
