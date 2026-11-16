import type { Metadata } from "next";
import { Contact, LegalPage } from "@/components/app/legal";

export const metadata: Metadata = { title: "Terms" };

export default function Terms() {
  return (
    <LegalPage title="Terms" updated="November 15, 2026">
      <section>
        <h2>What Rafterlore is</h2>
        <p>
          Rafterlore is a free, non-commercial, independent fantasy sports history, statistics and analytics platform. It
          shows the history of fantasy basketball and football leagues hosted on Sleeper, with daily games for fun. There
          are no payments, ads or paid features.
        </p>
      </section>
      <section>
        <h2>Recreational and informational use</h2>
        <p>
          Rafterlore is an independent platform designed to celebrate fantasy sports history, analyze publicly available
          sports statistics and provide recreational entertainment. Rafterlore does not facilitate, promote or support
          sports wagering. All features, statistics, rankings and analytical tools are provided exclusively for
          recreational and informational purposes and are not intended for wagering-related activities.
        </p>
        <ul>
          <li>
            Rafterlore does not operate, organize or administer fantasy sports competitions. Leagues are run on Sleeper;
            Rafterlore only reads their public history.
          </li>
          <li>
            Rafterlore does not accept wagers, collect entry fees, hold funds, distribute winnings or facilitate any financial
            transaction between league members.
          </li>
          <li>
            Statistics, rankings, records, trade evaluations, lineup numbers and daily-game scores are for recreational and
            informational use only.
          </li>
          <li>Rafterlore does not provide betting advice, sportsbook odds or gambling recommendations.</li>
          <li>You may not use Rafterlore to facilitate sports wagering.</li>
        </ul>
        <p>Before a league is first opened on Rafterlore, the person opening it confirms this use.</p>
      </section>
      <section>
        <h2>Independent</h2>
        <p>
          Rafterlore works with Sleeper leagues but is not affiliated with, endorsed by or sponsored by Sleeper. Sleeper is
          a trademark of its owner. League data comes from Sleeper&apos;s public API.
        </p>
        <p>
          Yahoo leagues are read with Yahoo&apos;s official Fantasy Sports API, with each member&apos;s permission, and shown only to
          that league&apos;s managers. League data from Yahoo Fantasy. Rafterlore is not affiliated with, endorsed by or sponsored
          by Yahoo, and uses Yahoo&apos;s API only for this free, non-commercial site under Yahoo&apos;s API terms.
        </p>
        <p>
          Rafterlore is not affiliated with or endorsed by any professional sports league, team, university or athletic
          governing body. Team, league and player names are used only to describe the statistics shown.
        </p>
      </section>
      <section>
        <h2>Accuracy</h2>
        <p>
          We try to get every number right, but Rafterlore is provided as is, without guarantees. Official records and
          points-for totals come straight from Sleeper. Weekly matchup scores, head-to-head records, trade grades and
          lineup numbers are built from Sleeper&apos;s weekly data, which doesn&apos;t always match the official totals; those
          are marked &ldquo;per Sleeper&rdquo;.
        </p>
      </section>
      <section>
        <h2>Fair use</h2>
        <ul>
          <li>Don&apos;t try to overload the site or Sleeper, or get around the limits on importing leagues.</li>
          <li>Don&apos;t scrape Rafterlore in bulk.</li>
          <li>Only remove a league you manage.</li>
          <li>Don&apos;t use Rafterlore for sports wagering or to settle bets.</li>
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
